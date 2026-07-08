import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import dotenv from "dotenv";
import { getPool } from "./src/lib/db";
import crypto from "crypto";

dotenv.config();

// Database initialization for new Universal Intake features
async function initializeDatabase() {
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    
    // Create Import Profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.import_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        mandatory_mapping JSONB NOT NULL,
        optional_mapping JSONB NOT NULL,
        qa_form_config JSONB NOT NULL,
        assignment_rules JSONB,
        created_by UUID REFERENCES public.users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create Clients and LOBs tables if missing
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS public.lobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID REFERENCES public.clients(id),
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Ensure scorecard_questions can handle options for dropdowns/multiselect
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scorecard_questions' AND column_name='options') THEN
          ALTER TABLE public.scorecard_questions ADD COLUMN options JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scorecard_questions' AND column_name='description') THEN
          ALTER TABLE public.scorecard_questions ADD COLUMN description TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scorecard_questions' AND column_name='formula') THEN
          ALTER TABLE public.scorecard_questions ADD COLUMN formula TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='scorecard_questions' AND column_name='formula_output_type') THEN
          ALTER TABLE public.scorecard_questions ADD COLUMN formula_output_type TEXT;
        END IF;
        
        -- Add lob_id to audit_cases
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_cases' AND column_name='lob_id') THEN
          ALTER TABLE public.audit_cases ADD COLUMN lob_id UUID;
        END IF;

        -- Add deleted_at to audit_cases
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_cases' AND column_name='deleted_at') THEN
          ALTER TABLE public.audit_cases ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        END IF;

        -- Ensure clients table has unique name for upsert
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='clients') THEN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_name_key') THEN
            ALTER TABLE public.clients ADD CONSTRAINT clients_name_key UNIQUE (name);
          END IF;
        END IF;

        -- Ensure lobs table has unique name/client_id for upsert
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='lobs') THEN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lobs_name_client_id_key') THEN
            ALTER TABLE public.lobs ADD CONSTRAINT lobs_name_client_id_key UNIQUE (name, client_id);
          END IF;
        END IF;
      END $$;
    `);

    // Ensure audit_batches can store QA Form Config used for that batch
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_batches' AND column_name='qa_form_config') THEN
          ALTER TABLE public.audit_batches ADD COLUMN qa_form_config JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_batches' AND column_name='mandatory_mapping') THEN
          ALTER TABLE public.audit_batches ADD COLUMN mandatory_mapping JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_batches' AND column_name='optional_mapping') THEN
          ALTER TABLE public.audit_batches ADD COLUMN optional_mapping JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_batches' AND column_name='deleted_at') THEN
          ALTER TABLE public.audit_batches ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audits' AND column_name='duration_seconds') THEN
          ALTER TABLE public.audits ADD COLUMN duration_seconds INTEGER DEFAULT 0;
        END IF;
      END $$;
    `);

    await client.query("COMMIT");
    console.log("Database initialized with Universal Intake structures.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Database initialization failed:", err);
  } finally {
    client.release();
  }
}

initializeDatabase();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" })); // Support large sheet imports

// UUID Mapping Engine for Demo/Simulated Users
const toUuidMap = new Map<string, string>();
const fromUuidMap = new Map<string, string>();

const DEMO_IDS = [
  "demo-superadmin-uuid",
  "demo-admin-uuid",
  "demo-manager-uuid",
  "demo-auditor-uuid",
  "demo-engineer-uuid",
  "demo-leader-uuid",
  "demo-agent-uuid",
  "demo-client-uuid"
];

for (const id of DEMO_IDS) {
  const hash = crypto.createHash("md5").update(id).digest("hex");
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(12, 15)}-a${hash.slice(15, 18)}-${hash.slice(18, 30)}`;
  toUuidMap.set(id, uuid);
  fromUuidMap.set(uuid, id);
}

const roleMapCache = new Map<string, string>(); // name -> id
const idToRoleCache = new Map<string, string>(); // id -> role_string

export function toUUID(str: string | null | undefined): string | null {
  if (!str) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str.toLowerCase();
  }
  if (toUuidMap.has(str)) {
    return toUuidMap.get(str)!;
  }
  const hash = crypto.createHash("md5").update(str).digest("hex");
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(12, 15)}-a${hash.slice(15, 18)}-${hash.slice(18, 30)}`;
  toUuidMap.set(str, uuid);
  fromUuidMap.set(uuid, str);
  return uuid;
}

export function fromUUID(uuid: string | null | undefined): string | null {
  if (!uuid) return null;
  const normalized = uuid.toLowerCase();
  if (fromUuidMap.has(normalized)) {
    return fromUuidMap.get(normalized)!;
  }
  return uuid;
}

/**
 * Maps a UserRole string from the frontend to a corresponding role_id UUID in the database.
 */
function getRoleIdFromUserRole(role: string): string | null {
  if (!role) return null;
  const normalized = role.toLowerCase().replace(/_/g, "");
  
  // Try cache first (exact match or normalized name)
  if (roleMapCache.has(role)) return roleMapCache.get(role)!;
  if (roleMapCache.has(normalized)) return roleMapCache.get(normalized)!;
  
  // Fallback to deterministic (could fail FK check if DB uses different IDs)
  if (normalized === "teamleader") return toUUID("role-supervisor");
  if (normalized === "qaengineer") return toUUID("role-qaauditor"); 
  
  return toUUID("role-" + normalized);
}

/**
 * Maps a role_id UUID from the database back to a UserRole string for the frontend.
 */
function getUserRoleFromRoleId(roleId: string | null | undefined): string {
  if (!roleId) return "agent";
  const normalizedId = roleId.toLowerCase();
  
  // Try cache first
  if (idToRoleCache.has(normalizedId)) return idToRoleCache.get(normalizedId)!;
  
  const roleIdMap: Record<string, string> = {
    [toUUID("role-superadmin")!]: "super_admin",
    [toUUID("role-admin")!]: "admin",
    [toUUID("role-qamanager")!]: "qa_manager",
    [toUUID("role-qaauditor")!]: "qa_auditor",
    [toUUID("role-supervisor")!]: "team_leader",
    [toUUID("role-agent")!]: "agent",
    [toUUID("role-client")!]: "client"
  };
  
  return roleIdMap[normalizedId] || "agent";
}

export async function ensureUserExists(client: any, userId: string | null | undefined, email?: string, fullName?: string, role?: string) {
  if (!userId) return;
  const uuid = toUUID(userId);
  if (!uuid) return;
  
  const userEmail = email || "user@precisionqa.com";
  const userName = fullName || userEmail.split("@")[0] || "User";
  const normalizedEmail = userEmail.toLowerCase().trim();
  const roleId = getRoleIdFromUserRole(role || "");

  // Safeguard against duplicate emails and key conflict violations (users_email_key)
  const emailCheck = await client.query("SELECT id, role_id FROM public.users WHERE LOWER(email) = LOWER($1)", [normalizedEmail]);
  if (emailCheck.rows.length > 0) {
    const existingId = emailCheck.rows[0].id;
    const existingRoleId = emailCheck.rows[0].role_id;
    
    if (existingId !== uuid) {
      try {
        // Attempt to align/update the existing user ID to match the authenticated user UUID
        await client.query(`
          UPDATE public.users SET 
            id = $1, 
            full_name = COALESCE($2, full_name), 
            role_id = COALESCE(role_id, $4),
            updated_at = NOW() 
          WHERE id = $3
        `, [uuid, userName, existingId, roleId]);
      } catch (updateErr: any) {
        console.warn("[ensureUserExists] Could not update existing user ID due to constraint references. Retrying with tombstone-archive strategy:", updateErr.message);
        // Rename existing email to free up constraint and insert new user record
        const archivedEmail = `archived_${Date.now()}_${normalizedEmail}`;
        await client.query("UPDATE public.users SET email = $1, is_active = false, updated_at = NOW() WHERE id = $2", [archivedEmail, existingId]);
        
        await client.query(`
          INSERT INTO public.users (id, email, full_name, role_id, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, true, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET 
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role_id = COALESCE(public.users.role_id, EXCLUDED.role_id),
            updated_at = NOW()
        `, [uuid, normalizedEmail, userName, roleId]);
      }
    } else {
      // ID matches, just update name/email/role (if role is missing)
      await client.query(`
        UPDATE public.users SET 
          email = $1,
          full_name = COALESCE($2, full_name),
          role_id = COALESCE(role_id, $4),
          updated_at = NOW()
        WHERE id = $3
      `, [normalizedEmail, userName, uuid, roleId]);
    }
  } else {
    // No existing user with this email, safe to insert/update by ID
    await client.query(`
      INSERT INTO public.users (id, email, full_name, role_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET 
        email = COALESCE(EXCLUDED.email, public.users.email),
        full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
        role_id = COALESCE(public.users.role_id, EXCLUDED.role_id),
        updated_at = NOW()
    `, [uuid, normalizedEmail, userName, roleId]);
  }
}

function normalizeObject(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(newObj)) {
    const val = newObj[key];
    if (typeof val === "string") {
      const lowerKey = key.toLowerCase().replace(/_/g, "");
      const isIdKey = 
        lowerKey === "userid" || 
        lowerKey === "agentid" || 
        lowerKey === "auditorid" || 
        lowerKey === "assignedby" || 
        lowerKey === "assignedto" || 
        lowerKey === "resolvedby";
      if (isIdKey) {
        newObj[key] = toUUID(val);
      }
    } else if (typeof val === "object") {
      newObj[key] = normalizeObject(val);
    }
  }
  return newObj;
}

function normalizeKeys(obj: any): any {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    const newKey = toUUID(key) || key;
    newObj[newKey] = obj[key];
  }
  return newObj;
}

function denormalizeRow(row: any): any {
  if (!row || typeof row !== "object") return row;
  const newRow = { ...row };
  for (const key of Object.keys(newRow)) {
    const lowerKey = key.toLowerCase().replace(/_/g, "");
    const isIdKey = 
      lowerKey.endsWith("id") || 
      lowerKey.endsWith("by") || 
      lowerKey.endsWith("to") || 
      lowerKey === "userid" || 
      lowerKey === "user_id" || 
      lowerKey === "agent" || 
      lowerKey === "auditor" ||
      lowerKey === "manager";
      
    if (isIdKey && typeof newRow[key] === "string") {
      newRow[key] = fromUUID(newRow[key]);
    }
  }
  return newRow;
}

function denormalizeRows(rows: any[]): any[] {
  if (!Array.isArray(rows)) return rows;
  return rows.map(denormalizeRow);
}

// Request normalization middleware
app.use((req: any, res: any, next: any) => {
  if (req.query) {
    req.query = normalizeObject(req.query);
  }
  if (req.body) {
    req.body = normalizeObject(req.body);
  }
  if (req.params) {
    req.params = normalizeObject(req.params);
  }
  next();
});

// Response denormalization middleware
app.use((req: any, res: any, next: any) => {
  const originalJson = res.json;
  res.json = function(body: any) {
    if (body) {
      if (Array.isArray(body)) {
        body = denormalizeRows(body);
      } else if (typeof body === "object") {
        body = denormalizeRow(body);
        for (const k of Object.keys(body)) {
          if (Array.isArray(body[k])) {
            body[k] = denormalizeRows(body[k]);
          } else if (typeof body[k] === "object") {
            body[k] = denormalizeRow(body[k]);
          }
        }
      }
    }
    return originalJson.call(this, body);
  };
  next();
});

// 1. API: Import Audit Cases from Google Sheets
app.post("/api/import-cases", async (req, res) => {
  console.log("/api/import-cases: Request received");
  const { cases, batchName, userId, userEmail } = req.body;

  if (!cases || !Array.isArray(cases) || cases.length === 0) {
    console.error("/api/import-cases: No cases provided");
    return res.status(400).json({ error: "No valid cases provided for import." });
  }

  const startTime = Date.now();
  const db = getPool();
  const client = await db.connect();

  const summary = {
    total: cases.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    duplicates: 0,
    errors: [] as { row: number; caseId: string; reason: string }[],
    durationMs: 0
  };

  try {
    await client.query("BEGIN");
    console.log("/api/import-cases: Transaction started");

    // 1. Ensure the user exists in our public.users table (Upsert)
    console.log("/api/import-cases: Upserting user", userEmail);
    let dbUserId = userId;
    const userUpsertRes = await client.query(
      `INSERT INTO public.users (id, email, full_name, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, updated_at = NOW()
       RETURNING id`,
      [userId, userEmail, userEmail.split("@")[0]] // Default name from email if not provided
    );
    dbUserId = userUpsertRes.rows[0].id;

    // 2. Create the Batch record
    console.log("/api/import-cases: Creating batch", batchName);
    const batchRes = await client.query(
      `INSERT INTO public.audit_batches (name, source, status, created_by, created_at, updated_at) 
       VALUES ($1, 'google_sheets', 'processing', $2, NOW(), NOW()) 
       RETURNING id`,
      [batchName || `Sheet Import ${new Date().toISOString()}`, dbUserId]
    );
    const batchId = batchRes.rows[0].id;
    console.log("/api/import-cases: Batch created", batchId);

    // 3. Process cases
    console.log("/api/import-cases: Processing cases", cases.length);
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const rowNumber = i + 2; 

      try {
        // Resolve Client (Upsert)
        const clientRes = await client.query(
          "INSERT INTO public.clients (name, created_by, is_active, created_at, updated_at) VALUES ($1, $2, true, NOW(), NOW()) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW() RETURNING id",
          [c.client, dbUserId]
        );
        const clientId = clientRes.rows[0].id;

        // Resolve LOB (Upsert)
        const lobRes = await client.query(
          "INSERT INTO public.lobs (name, client_id, created_by, is_active, created_at, updated_at) VALUES ($1, $2, $3, true, NOW(), NOW()) ON CONFLICT (name, client_id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW() RETURNING id",
          [c.lob, clientId, dbUserId]
        );
        const lobId = lobRes.rows[0].id;

        // Resolve Agent
        let agentId = null;
        if (c.agentEmail) {
          const agentRes = await client.query("SELECT id FROM public.users WHERE email = $1", [c.agentEmail]);
          if (agentRes.rows.length > 0) {
            agentId = agentRes.rows[0].id;
          }
        }

        // Check for duplicates
        const dupCheck = await client.query(
          "SELECT id FROM public.audit_cases WHERE external_case_id = $1 AND lob_id = $2 AND deleted_at IS NULL",
          [c.caseId, lobId]
        );

        if (dupCheck.rows.length > 0) {
          summary.duplicates++;
          summary.skipped++;
          continue;
        }

        // Handle date parsing safely
        const auditDate = new Date(c.auditDate);
        const validDate = isNaN(auditDate.getTime()) ? new Date() : auditDate;

        // Insert Case
        await client.query(
          `INSERT INTO public.audit_cases 
           (batch_id, lob_id, external_case_id, agent_id, case_date, transcript_url, metadata, status, channel, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sheets', NOW(), NOW())`,
          [
            batchId,
            lobId,
            c.caseId,
            agentId,
            validDate,
            c.transcriptUrl || null,
            JSON.stringify({
              interactionId: c.interactionId,
              recordingUrl: c.recordingUrl,
              language: c.language,
              originalSheetData: typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata
            }),
            agentId ? 'assigned' : 'unassigned'
          ]
        );

        summary.imported++;
      } catch (rowErr: any) {
        console.error("/api/import-cases: Error processing row", rowNumber, rowErr);
        // In a true transaction, we might want to fail the whole thing, 
        // but let's follow the user's "Do not insert partial data" by failing the transaction if any row really fails database-wise
        throw new Error(`Row ${rowNumber} failed: ${rowErr.message}`);
      }
    }

    // Finalize batch
    await client.query("UPDATE public.audit_batches SET status = 'completed' WHERE id = $1", [batchId]);

    // Clean up previous active cases
    console.log("/api/import-cases: Cleaning up old cases");
    await client.query(`
      DELETE FROM public.audit_cases 
      WHERE batch_id != $1 
      AND id NOT IN (SELECT case_id FROM public.audits)
    `, [batchId]);

    await client.query("COMMIT");
    console.log("/api/import-cases: Transaction committed");
    
    summary.durationMs = Date.now() - startTime;
    res.json({ success: true, batchId, summary });

  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("/api/import-cases: Import Transaction Failed, rolled back:", err);
    res.status(500).json({ error: "Import failed. Transaction rolled back.", details: err.message });
  } finally {
    client.release();
  }
});

// 2. API: Fetch Reference Data for Validation
app.get("/api/reference-data", async (req, res) => {
  const db = getPool();
  try {
    const clientsRes = await db.query("SELECT name FROM public.clients WHERE deleted_at IS NULL");
    const lobsRes = await db.query("SELECT name FROM public.lobs WHERE deleted_at IS NULL");
    const teamsRes = await db.query("SELECT name FROM public.teams WHERE deleted_at IS NULL");
    const usersRes = await db.query("SELECT email FROM public.users WHERE deleted_at IS NULL");
    
    res.json({
      clients: clientsRes.rows.map(r => r.name.toLowerCase()),
      lobs: lobsRes.rows.map(r => r.name.toLowerCase()),
      teams: teamsRes.rows.map(r => r.name.toLowerCase()),
      users: usersRes.rows.map(r => r.email.toLowerCase()),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch reference data" });
  }
});

// 3. API: Fetch Audit Cases from Supabase
app.get("/api/cases", async (req, res) => {
  const db = getPool();
  try {
    const result = await db.query(`
      SELECT 
        c.id,
        c.batch_id as "batchId",
        c.external_case_id as "caseId",
        c.metadata->>'interactionId' as "interactionId",
        COALESCE(u.full_name, c.metadata->>'agentNameRaw') as "agentName",
        u.email as "agentEmail",
        t.name as "team",
        cl.name as "client",
        l.name as "lob",
        c.case_date as "auditDate",
        c.metadata->>'recordingUrl' as "recordingUrl",
        c.transcript_url as "transcriptUrl",
        c.metadata->>'language' as "language",
        c.metadata->'originalSheetData' as "metadata",
        c.created_at as "importedAt"
      FROM public.audit_cases c
      LEFT JOIN public.users u ON c.agent_id = u.id
      LEFT JOIN public.lobs l ON c.lob_id = l.id
      LEFT JOIN public.clients cl ON l.client_id = cl.id
      LEFT JOIN public.team_members tm ON u.id = tm.user_id
      LEFT JOIN public.teams t ON tm.team_id = t.id
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error("Fetch Cases Failed:", err);
    res.status(500).json({ error: "Failed to fetch cases from database." });
  }
});

// Fetch all batches
app.get("/api/batches", async (req, res) => {
  const db = getPool();
  try {
    const result = await db.query(`
      SELECT 
        ab.id,
        ab.name,
        ab.source,
        ab.status,
        ab.created_at as "createdAt",
        COALESCE(COUNT(c.id), 0)::integer as "caseCount"
      FROM public.audit_batches ab
      LEFT JOIN public.audit_cases c ON c.batch_id = ab.id AND c.deleted_at IS NULL
      WHERE ab.deleted_at IS NULL
      GROUP BY ab.id, ab.name, ab.source, ab.status, ab.created_at
      ORDER BY ab.created_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error("Fetch Batches Failed:", err);
    res.status(500).json({ error: "Failed to fetch batches." });
  }
});

// Delete a batch and its associated cases
app.delete("/api/batches/:batchId", async (req, res) => {
  const db = getPool();
  const { batchId } = req.params;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    
    const uuidBatchId = toUUID(batchId);

    // Soft delete associated cases
    await client.query(`
      UPDATE public.audit_cases 
      SET deleted_at = NOW() 
      WHERE batch_id = $1
    `, [uuidBatchId]);

    // Soft delete the batch itself
    await client.query(`
      UPDATE public.audit_batches 
      SET deleted_at = NOW() 
      WHERE id = $1
    `, [uuidBatchId]);

    await client.query("COMMIT");
    res.json({ success: true, message: `Batch ${batchId} and its associated cases have been deleted.` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Delete Batch Failed:", err);
    res.status(500).json({ error: "Failed to delete batch", details: err.message });
  } finally {
    client.release();
  }
});

// --- UNIVERSAL DATA INTAKE ENGINE ENDPOINTS ---

// 1. Universal Import
app.post("/api/universal-import", async (req, res) => {
  console.log("/api/universal-import: Request received");
  const { cases, batchName, qaFormConfig, mandatoryMapping, optionalMapping, userId, userEmail } = req.body;
  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    console.log("/api/universal-import: Transaction started");

    // a. Ensure user exists
    console.log("/api/universal-import: Ensuring user exists:", userEmail);
    await ensureUserExists(client, userId, userEmail);

    // b. Create Scorecard (QA Form)
    const scorecardId = crypto.randomUUID();
    console.log("/api/universal-import: Creating scorecard:", scorecardId);
    await client.query(`
      INSERT INTO public.scorecards (id, name, description, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, true, NOW(), NOW())
    `, [scorecardId, `Import Batch Form: ${batchName}`, `Auto-generated QA form for batch ${batchName}`]);

    // Add sections and questions
    const sectionId = crypto.randomUUID();
    console.log("/api/universal-import: Creating section:", sectionId);
    await client.query(`
      INSERT INTO public.scorecard_sections (id, scorecard_id, name, weight, order_index, created_at, updated_at)
      VALUES ($1, $2, 'Standard Audit', 100, 1, NOW(), NOW())
    `, [sectionId, scorecardId]);

    console.log("/api/universal-import: Inserting scorecard questions, count:", qaFormConfig?.length);
    for (const q of qaFormConfig || []) {
      await client.query(`
        INSERT INTO public.scorecard_questions (id, section_id, question_text, description, weight, question_type, is_critical, order_index, options, formula, formula_output_type, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      `, [crypto.randomUUID(), sectionId, q.name, q.description, q.weight, q.type, q.critical, q.orderIndex, JSON.stringify(q.options || []), q.formula || null, q.formulaOutputType || null]);
    }

    // c. Create Batch
    const batchId = crypto.randomUUID();
    console.log("/api/universal-import: Creating batch:", batchId);
    await client.query(`
      INSERT INTO public.audit_batches (id, name, source, status, created_by, qa_form_config, mandatory_mapping, optional_mapping, created_at, updated_at)
      VALUES ($1, $2, 'universal_engine', 'completed', $3, $4, $5, $6, NOW(), NOW())
    `, [batchId, batchName, toUUID(userId), JSON.stringify(qaFormConfig), JSON.stringify(mandatoryMapping), JSON.stringify(optionalMapping)]);

    // d. Resolve Default LOB for Universal Intake
    console.log("/api/universal-import: Resolving client 'Universal Intake'");
    let clientId = null;
    const clientCheck = await client.query("SELECT id FROM public.clients WHERE name = $1 LIMIT 1", ['Universal Intake']);
    if (clientCheck.rows.length > 0) {
      clientId = clientCheck.rows[0].id;
    } else {
      const insertClient = await client.query(
        "INSERT INTO public.clients (name, created_by, is_active, created_at, updated_at) VALUES ($1, $2, true, NOW(), NOW()) RETURNING id",
        ['Universal Intake', toUUID(userId)]
      );
      clientId = insertClient.rows[0].id;
    }

    console.log("/api/universal-import: Resolving lob 'General' for clientId:", clientId);
    let lobId = null;
    const lobCheck = await client.query("SELECT id FROM public.lobs WHERE name = $1 AND client_id = $2 LIMIT 1", ['General', clientId]);
    if (lobCheck.rows.length > 0) {
      lobId = lobCheck.rows[0].id;
    } else {
      const insertLob = await client.query(
        "INSERT INTO public.lobs (name, client_id, created_by, is_active, created_at, updated_at) VALUES ($1, $2, $3, true, NOW(), NOW()) RETURNING id",
        ['General', clientId, toUUID(userId)]
      );
      lobId = insertLob.rows[0].id;
    }

    // e. Ingest Cases
    console.log("/api/universal-import: Ingesting cases, count:", cases?.length);
    for (const c of cases || []) {
      // Resolve agent ID if email exists
      let agentId = null;
      if (c.agentEmail) {
        const agentRes = await client.query("SELECT id FROM public.users WHERE email = $1", [c.agentEmail.toLowerCase().trim()]);
        if (agentRes.rows.length > 0) {
          agentId = agentRes.rows[0].id;
        }
      }

      // Safe date parsing on server
      let validDate = new Date();
      if (c.auditDate) {
        const d = new Date(c.auditDate);
        if (!isNaN(d.getTime())) {
          validDate = d;
        }
      }

      await client.query(`
        INSERT INTO public.audit_cases (batch_id, lob_id, external_case_id, agent_id, case_date, metadata, status, channel, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'universal', NOW(), NOW())
      `, [
        batchId,
        lobId,
        c.caseId, 
        agentId, 
        validDate, 
        JSON.stringify({ ...c.metadata, agentNameRaw: c.agentName }), 
        agentId ? 'assigned' : 'unassigned'
      ]);
    }

    await client.query("COMMIT");
    console.log("/api/universal-import: Transaction committed. Ingested successfully.");
    res.json({ success: true, batchId, importedCount: cases?.length || 0 });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Universal Import Failed, rolled back:", err);
    res.status(500).json({ error: "Import failed", details: err.message });
  } finally {
    client.release();
  }
});

// 2. Universal Assignment Execution
app.post("/api/universal-assign", async (req, res) => {
  const { batchId, rule, userId } = req.body;
  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Fetch cases for this batch
    const casesRes = await client.query("SELECT id, metadata FROM public.audit_cases WHERE batch_id = $1", [batchId]);
    const cases = casesRes.rows;

    if (cases.length === 0) {
      throw new Error("No cases found for this batch.");
    }

    let assignments: { caseId: string; auditorId: string }[] = [];

    if (rule.mode === "random") {
      const auditors = rule.auditorIds || [];
      if (auditors.length === 0) throw new Error("No auditors selected for distribution.");

      cases.forEach((c, i) => {
        const auditorId = auditors[i % auditors.length];
        assignments.push({ caseId: c.id, auditorId });
      });
    } else if (rule.mode === "header_based") {
      const headerColumn = rule.headerColumn;
      const mappings = rule.mappings || {}; // Value -> Auditor IDs

      cases.forEach(c => {
        const metadata = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata;
        const val = String(metadata[headerColumn!] || "");
        const auditorsForVal = mappings[val] || [];
        
        if (auditorsForVal.length > 0) {
          // Simple random pick from auditors assigned to this value
          const auditorId = auditorsForVal[Math.floor(Math.random() * auditorsForVal.length)];
          assignments.push({ caseId: c.id, auditorId });
        }
      });
    }

    // Execute updates
    for (const a of assignments) {
      await client.query(`
        UPDATE public.audit_cases 
        SET auditor_id = $1, status = 'assigned', assigned_by = $2, updated_at = NOW() 
        WHERE id = $3
      `, [toUUID(a.auditorId), toUUID(userId), a.caseId]);
    }

    await client.query("COMMIT");
    res.json({ success: true, assignedCount: assignments.length });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Universal Assignment Failed:", err);
    res.status(500).json({ error: "Assignment failed", details: err.message });
  } finally {
    client.release();
  }
});

// 3. Import Profiles Management
app.post("/api/import-profiles", async (req, res) => {
  const { name, mandatoryMapping, optionalMapping, qaFormConfig, assignmentRules, userId } = req.body;
  const db = getPool();
  try {
    const result = await db.query(`
      INSERT INTO public.import_profiles (name, mandatory_mapping, optional_mapping, qa_form_config, assignment_rules, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, JSON.stringify(mandatoryMapping), JSON.stringify(optionalMapping), JSON.stringify(qaFormConfig), JSON.stringify(assignmentRules), toUUID(userId)]);
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save profile" });
  }
});

app.get("/api/import-profiles", async (req, res) => {
  const db = getPool();
  try {
    const result = await db.query("SELECT * FROM public.import_profiles ORDER BY created_at DESC");
    res.json(result.rows.map(r => ({
      ...r,
      mandatoryMapping: r.mandatory_mapping,
      optionalMapping: r.optional_mapping,
      qaFormConfig: r.qa_form_config,
      assignmentRules: r.assignment_rules
    })));
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

// --- SMART ASSIGNMENT ENGINE ENDPOINTS ---

// 1. Fetch Assignment Summary Stats
app.get("/api/assignment/summary", async (req, res) => {
  const db = getPool();
  try {
    const totalCasesRes = await db.query(`SELECT count(*) as count FROM public.audit_cases WHERE deleted_at IS NULL`);
    const assignedCasesRes = await db.query(`SELECT count(*) as count FROM public.audit_cases WHERE auditor_id IS NOT NULL AND deleted_at IS NULL`);
    const unassignedCasesRes = await db.query(`SELECT count(*) as count FROM public.audit_cases WHERE auditor_id IS NULL AND deleted_at IS NULL`);
    const completedAuditsRes = await db.query(`SELECT count(*) as count FROM public.audit_cases WHERE status = 'audited' AND deleted_at IS NULL`);
    
    const avgTimeRes = await db.query(`
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))), 0) as avg_seconds 
      FROM public.audit_cases 
      WHERE status = 'assigned' AND deleted_at IS NULL
    `);
    
    const activeAuditorsRes = await db.query(`
      SELECT count(DISTINCT auditor_id) as count 
      FROM public.audit_cases 
      WHERE auditor_id IS NOT NULL AND deleted_at IS NULL
    `);

    res.json({
      totalCases: parseInt(totalCasesRes.rows[0].count || "0"),
      assignedCases: parseInt(assignedCasesRes.rows[0].count || "0"),
      unassignedCases: parseInt(unassignedCasesRes.rows[0].count || "0"),
      completedAudits: parseInt(completedAuditsRes.rows[0].count || "0"),
      avgAssignmentTime: parseFloat(avgTimeRes.rows[0].avg_seconds || "0"),
      activeAuditorsCount: parseInt(activeAuditorsRes.rows[0].count || "0"),
    });
  } catch (err: any) {
    console.error("Fetch Assignment Summary Failed:", err);
    res.status(500).json({ error: "Failed to fetch assignment summary" });
  }
});

// 2. Fetch QA Auditors Stats and Availability
app.get("/api/assignment/auditors", async (req, res) => {
  const db = getPool();
  try {
    const auditorsRes = await db.query(`
      SELECT 
        u.id,
        u.email,
        u.full_name as "fullName",
        u.avatar_url as "avatarUrl",
        u.is_active as "isActive",
        t.name as "teamName"
      FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      LEFT JOIN public.team_members tm ON u.id = tm.user_id
      LEFT JOIN public.teams t ON tm.team_id = t.id
      WHERE r.name IN ('QA Auditor', 'QA Manager', 'Admin') AND u.deleted_at IS NULL
    `);

    const capacitiesRes = await db.query(`SELECT value FROM public.settings WHERE key = 'auditor_capacities'`);
    let capacities = capacitiesRes.rows.length > 0 ? capacitiesRes.rows[0].value : {};
    capacities = normalizeKeys(capacities);

    const auditorsWithStats = await Promise.all(auditorsRes.rows.map(async (auditor) => {
      const todayAssignedRes = await db.query(`
        SELECT count(*) as count 
        FROM public.audit_cases 
        WHERE auditor_id = $1 AND deleted_at IS NULL AND updated_at >= CURRENT_DATE
      `, [auditor.id]);

      const pendingAuditsRes = await db.query(`
        SELECT count(*) as count 
        FROM public.audit_cases 
        WHERE auditor_id = $1 AND status = 'assigned' AND deleted_at IS NULL
      `, [auditor.id]);

      const completedTodayRes = await db.query(`
        SELECT count(*) as count 
        FROM public.audits 
        WHERE auditor_id = $1 AND created_at >= CURRENT_DATE
      `, [auditor.id]);

      const dailyCapacity = capacities[auditor.id] !== undefined ? parseInt(capacities[auditor.id]) : 40;

      const todayAssigned = parseInt(todayAssignedRes.rows[0].count || "0");
      const pendingAudits = parseInt(pendingAuditsRes.rows[0].count || "0");
      const completedToday = parseInt(completedTodayRes.rows[0].count || "0");

      return {
        ...auditor,
        todayAssigned,
        pendingAudits,
        completedToday,
        dailyCapacity,
        capacityPercent: dailyCapacity > 0 ? Math.round((todayAssigned / dailyCapacity) * 100) : 0,
        availabilityStatus: todayAssigned >= dailyCapacity ? "At Capacity" : (auditor.isActive ? "Available" : "Offline"),
      };
    }));

    res.json(auditorsWithStats);
  } catch (err: any) {
    console.error("Fetch Assignment Auditors Failed:", err);
    res.status(500).json({ error: "Failed to fetch auditors stats" });
  }
});

// 3. Update QA Auditor capacities
app.post("/api/assignment/capacities", async (req, res) => {
  const db = getPool();
  const { capacities } = req.body;
  if (!capacities || typeof capacities !== "object") {
    return res.status(400).json({ error: "Invalid capacities payload." });
  }

  try {
    await db.query(`
      INSERT INTO public.settings (key, value, description)
      VALUES ('auditor_capacities', $1, 'Configured daily capacities for QA Auditors')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [JSON.stringify(capacities)]);

    res.json({ success: true, message: "Capacities updated successfully." });
  } catch (err: any) {
    console.error("Save Capacities Failed:", err);
    res.status(500).json({ error: "Failed to save daily capacities" });
  }
});

// 4. Fetch cases list with details and compute synthetic priorities
app.get("/api/assignment/cases", async (req, res) => {
  const db = getPool();
  try {
    const result = await db.query(`
      SELECT 
        c.id,
        c.batch_id as "batchId",
        ab.name as "batchName",
        c.external_case_id as "caseId",
        c.metadata->>'interactionId' as "interactionId",
        COALESCE(u.full_name, c.metadata->>'agentNameRaw') as "agentName",
        u.email as "agentEmail",
        t.name as "team",
        cl.name as "client",
        l.name as "lob",
        c.case_date as "auditDate",
        c.metadata->>'recordingUrl' as "recordingUrl",
        c.transcript_url as "transcriptUrl",
        c.metadata->>'language' as "language",
        c.status,
        c.auditor_id as "auditorId",
        aud.full_name as "auditorName",
        c.created_at as "importedAt",
        c.metadata
      FROM public.audit_cases c
      LEFT JOIN public.users u ON c.agent_id = u.id
      LEFT JOIN public.lobs l ON c.lob_id = l.id
      LEFT JOIN public.clients cl ON l.client_id = cl.id
      LEFT JOIN public.team_members tm ON u.id = tm.user_id
      LEFT JOIN public.teams t ON tm.team_id = t.id
      LEFT JOIN public.audit_batches ab ON c.batch_id = ab.id
      LEFT JOIN public.users aud ON c.auditor_id = aud.id
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `);

    const cases = result.rows.map(c => {
      let priority = "Medium";
      if (c.language && c.language !== "English" && c.language !== "en") {
        priority = "High";
      } else if (c.caseId && c.caseId.charCodeAt(0) % 3 === 0) {
        priority = "High";
      } else if (c.caseId && c.caseId.charCodeAt(0) % 5 === 0) {
        priority = "Low";
      }

      return {
        ...c,
        priority
      };
    });

    res.json(cases);
  } catch (err: any) {
    console.error("Fetch Assignment Cases Failed:", err);
    res.status(500).json({ error: "Failed to fetch assignment cases." });
  }
});

// 5. Bulk Assign / Reassign cases to auditors
app.post("/api/assignment/assign", async (req, res) => {
  const db = getPool();
  const client = await db.connect();
  const { assignments, userId } = req.body;
  
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: "No assignments provided." });
  }

  try {
    await client.query("BEGIN");

    const auditStatusMap: Record<string, string> = {};
    let assignedCount = 0;
    let unassignedCount = 0;

    for (const item of assignments) {
      const { caseId, auditorId, reason } = item;
      const status = auditorId ? "assigned" : "unassigned";

      // Fetch the original state to detect reassignment
      const originalRes = await client.query(`
        SELECT c.auditor_id, c.external_case_id as "caseName", u.full_name as "auditorName" 
        FROM public.audit_cases c
        LEFT JOIN public.users u ON c.auditor_id = u.id
        WHERE c.id = $1
      `, [caseId]);
      
      const originalAuditorId = originalRes.rows[0]?.auditor_id;
      const originalAuditorName = originalRes.rows[0]?.auditorName;
      const caseName = originalRes.rows[0]?.caseName || "Unknown Case";
      
      let isReassignment = false;
      if (originalAuditorId && auditorId && originalAuditorId !== auditorId) {
        isReassignment = true;
      }

      await client.query(`
        UPDATE public.audit_cases 
        SET auditor_id = $1, status = $2, assigned_by = $3, updated_at = NOW() 
        WHERE id = $4
      `, [auditorId || null, status, userId || null, caseId]);

      // Write a detailed single-case log to capture the audit trail
      const auditLogDesc = isReassignment 
        ? `Reassigned case ${caseName} from ${originalAuditorName || "unnamed"} to auditor ${auditorId}`
        : (auditorId ? `Assigned case ${caseName} to auditor` : `Unassigned case ${caseName}`);

      await client.query(`
        INSERT INTO public.activity_logs (user_id, action_category, description, payload)
        VALUES ($1, 'case_assignment_detail', $2, $3)
      `, [
        userId || null,
        auditLogDesc,
        JSON.stringify({
          caseId,
          caseName,
          assignedBy: userId || null,
          assignedTo: auditorId || null,
          previousAuditorId: originalAuditorId || null,
          previousAuditorName: originalAuditorName || null,
          isReassignment,
          reason: reason || (isReassignment ? "Workload Balancing Adjustment" : "Initial Direct Allocation"),
          timestamp: new Date().toISOString()
        })
      ]);

      if (auditorId) {
        assignedCount++;
        auditStatusMap[auditorId] = (auditStatusMap[auditorId] || "") + caseId + ",";
      } else {
        unassignedCount++;
      }
    }

    const desc = `Processed assignment action: ${assignedCount} cases allocated, ${unassignedCount} cases returned to pool.`;
    await client.query(`
      INSERT INTO public.activity_logs (user_id, action_category, description, payload)
      VALUES ($1, 'case_assignment', $2, $3)
    `, [userId || null, desc, JSON.stringify({ assignedCount, unassignedCount, timestamp: new Date().toISOString() })]);

    for (const auditorId of Object.keys(auditStatusMap)) {
      const casesList = auditStatusMap[auditorId].split(",").filter(Boolean);
      const title = "New Cases Assigned";
      const content = `You have been assigned ${casesList.length} new audit cases to process.`;
      
      await client.query(`
        INSERT INTO public.notifications (user_id, title, content, type)
        VALUES ($1, $2, $3, 'assignment')
      `, [auditorId, title, content]);
    }

    await client.query("COMMIT");
    res.json({ success: true, message: `Successfully processed ${assignments.length} assignments.` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Assignment Transaction Failed:", err);
    res.status(500).json({ error: "Failed to process assignments.", details: err.message });
  } finally {
    client.release();
  }
});

// 6. Fetch Assignment History / Detail Activity Log
app.get("/api/assignment/history", async (req, res) => {
  const db = getPool();
  try {
    const result = await db.query(`
      SELECT 
        al.id,
        al.user_id as "userId",
        u.full_name as "userName",
        u.email as "userEmail",
        al.description,
        al.payload,
        al.created_at as "createdAt"
      FROM public.activity_logs al
      LEFT JOIN public.users u ON al.user_id = u.id
      WHERE al.action_category = 'case_assignment_detail'
      ORDER BY al.created_at DESC
      LIMIT 150
    `);
    
    // Join names for assignedTo and previousAuditor from the payload using user IDs
    const usersRes = await db.query("SELECT id, full_name as name FROM public.users");
    const userMap: Record<string, string> = {};
    usersRes.rows.forEach(r => {
      userMap[r.id] = r.name;
    });

    const enrichedHistory = result.rows.map(row => {
      let payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
      if (payload) {
        if (payload.assignedTo && userMap[payload.assignedTo]) {
          payload.assignedToName = userMap[payload.assignedTo];
        }
        if (payload.assignedBy && userMap[payload.assignedBy]) {
          payload.assignedByName = userMap[payload.assignedBy];
        }
      }
      return {
        ...row,
        payload
      };
    });

    res.json(enrichedHistory);
  } catch (err: any) {
    console.error("Fetch Assignment History Failed:", err);
    res.status(500).json({ error: "Failed to fetch assignment history log." });
  }
});

// 7. Complete an audit case directly
app.post("/api/assignment/complete-case", async (req, res) => {
  const db = getPool();
  const { caseId, score, comments, auditorId } = req.body;
  if (!caseId) {
    return res.status(400).json({ error: "Missing case ID parameter." });
  }

  try {
    // Check if the case exists and get info
    const caseRes = await db.query(`SELECT agent_id, auditor_id, external_case_id FROM public.audit_cases WHERE id = $1`, [caseId]);
    if (caseRes.rows.length === 0) {
      return res.status(404).json({ error: "Audit case not found." });
    }

    const { agent_id, auditor_id, external_case_id } = caseRes.rows[0];
    const finalAuditorId = auditorId || auditor_id;

    if (!finalAuditorId) {
      return res.status(400).json({ error: "This case has no assigned auditor. Assign it first." });
    }

    // Update case status to 'audited'
    await db.query(`
      UPDATE public.audit_cases 
      SET status = 'audited', updated_at = NOW() 
      WHERE id = $1
    `, [caseId]);

    // Create corresponding audit record to satisfy db schema
    const auditId = crypto.randomUUID();
    const scRes = await db.query(`SELECT id FROM public.scorecards LIMIT 1`);
    const scorecardId = scRes.rows[0]?.id || "00000000-0000-0000-0000-000000000001";

    await db.query(`
      INSERT INTO public.audits (
        id, case_id, scorecard_id, auditor_id, agent_id, raw_score, weighted_score, 
        status, is_critical_failed, answers, feedback_status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', false, $8, 'pending', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [
      auditId, caseId, scorecardId, finalAuditorId, agent_id || "00000000-0000-0000-0000-000000000001", 
      score || 100, score || 100, JSON.stringify({ comments: comments || "Excellent call flow execution." })
    ]);

    // Also log this as an action
    await db.query(`
      INSERT INTO public.activity_logs (user_id, action_category, description, payload)
      VALUES ($1, 'audit_completion', $2, $3)
    `, [
      finalAuditorId, 
      `Completed quality audit for case ${external_case_id}`, 
      JSON.stringify({ caseId, score, comments })
    ]);

    res.json({ success: true, message: "Audit completed successfully." });
  } catch (err: any) {
    console.error("Complete Case Audit Failed:", err);
    res.status(500).json({ error: "Failed to submit audit completion", details: err.message });
  }
});

// GET /api/audit/scorecard
app.get("/api/audit/scorecard", async (req, res) => {
  const db = getPool();
  const { caseId } = req.query;
  try {
    if (caseId) {
      // Check if this case belongs to an import batch with a qa_form_config
      const batchRes = await db.query(`
        SELECT ab.id, ab.name, ab.qa_form_config
        FROM public.audit_cases c
        JOIN public.audit_batches ab ON c.batch_id = ab.id
        WHERE c.id = $1 AND ab.qa_form_config IS NOT NULL
      `, [caseId]);

      if (batchRes.rows.length > 0 && batchRes.rows[0].qa_form_config) {
        const batch = batchRes.rows[0];
        const rawFields = typeof batch.qa_form_config === "string"
          ? JSON.parse(batch.qa_form_config)
          : batch.qa_form_config;

        if (Array.isArray(rawFields) && rawFields.length > 0) {
          const sections = [
            {
              id: "batch_assessment_section",
              name: "Scorecard Assessment",
              weight: 100,
              order_index: 1,
              questions: rawFields.map((field: any, idx: number) => {
                let qType = "binary";
                if (field.type === "yes_no" || field.type === "binary") qType = "binary";
                else if (field.type === "rating_5" || field.type === "rating") qType = "rating";
                else if (field.type === "dropdown") qType = "dropdown";
                else if (field.type === "multi_select" || field.type === "multiselect") qType = "multiselect";
                else if (field.type === "percentage") qType = "percentage";
                else if (field.type === "formula") qType = "formula";
                else qType = "binary";

                return {
                  id: field.id || `q_${idx}`,
                  sectionId: "batch_assessment_section",
                  questionText: field.name || `Question ${idx + 1}`,
                  helpText: field.description || "",
                  weight: Number(field.weight) || 10,
                  questionType: qType,
                  isCritical: !!field.critical || !!field.isCritical,
                  orderIndex: field.orderIndex !== undefined ? field.orderIndex : idx,
                  formula: field.formula || null,
                  formulaOutputType: field.formulaOutputType || null,
                  options: field.options || ["Yes", "No"]
                };
              })
            }
          ];

          return res.json({
            id: `batch_${batch.id}`,
            name: batch.name || "Batch Scorecard",
            description: `Auto-generated scorecard layout for import batch ${batch.name}`,
            passing_score: 80.00,
            sections
          });
        }
      }
    }

    // Default: Fetch active scorecard
    let scorecardRes = await db.query(`SELECT id, name, description, passing_score FROM public.scorecards WHERE deleted_at IS NULL AND is_active = true LIMIT 1`);
    
    let scorecardId = "";
    if (scorecardRes.rows.length === 0) {
      // If no active scorecard, let's create a robust fallback enterprise scorecard!
      console.log("No active scorecard found. Creating fallback enterprise scorecard...");
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        
        // Find first available LOB ID if any
        const lobRes = await client.query("SELECT id FROM public.lobs LIMIT 1");
        const lobId = lobRes.rows.length > 0 ? lobRes.rows[0].id : null;
        
        scorecardId = crypto.randomUUID();
        await client.query(`
          INSERT INTO public.scorecards (id, name, description, lob_id, passing_score, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 80.00, true, NOW(), NOW())
        `, [scorecardId, "Enterprise Customer Experience Scorecard", "Standard scorecard for assessing soft skills, technical correctness, and regulatory compliance on customer interactions.", lobId]);
        
        // Sections
        const sec1Id = crypto.randomUUID();
        const sec2Id = crypto.randomUUID();
        const sec3Id = crypto.randomUUID();
        
        await client.query(`
          INSERT INTO public.scorecard_sections (id, scorecard_id, name, weight, order_index, created_at, updated_at)
          VALUES 
            ($1, $4, 'Compliance & Verification', 30.00, 1, NOW(), NOW()),
            ($2, $4, 'Communication & Empathy', 30.00, 2, NOW(), NOW()),
            ($3, $4, 'Technical Knowledge & Resolution', 40.00, 3, NOW(), NOW())
        `, [sec1Id, sec2Id, sec3Id, scorecardId]);
        
        // Questions
        const q1Id = crypto.randomUUID();
        const q2Id = crypto.randomUUID();
        const q3Id = crypto.randomUUID();
        const q4Id = crypto.randomUUID();
        const q5Id = crypto.randomUUID();
        const q6Id = crypto.randomUUID();
        const q7Id = crypto.randomUUID();
        const q8Id = crypto.randomUUID();
        const q9Id = crypto.randomUUID();
        
        await client.query(`
          INSERT INTO public.scorecard_questions (id, section_id, question_text, help_text, weight, question_type, is_critical, order_index, created_at, updated_at)
          VALUES 
            ($1, $10, 'Identity Verification: Did the agent verify customer identity details (Name, Account #)?', 'Verification of identity is mandatory prior to disclosing sensitive account specifics.', 10.00, 'binary', true, 1, NOW(), NOW()),
            ($2, $10, 'Mandatory Disclosure: Did the agent state the call recording notice?', 'Must state: "This call may be recorded for quality and security purposes."', 10.00, 'binary', false, 2, NOW(), NOW()),
            ($3, $10, 'Data Privacy & Security: Did the agent avoid PCI-DSS violations (repeating credit card or passwords)?', 'PINs, credit cards, or passwords must never be spoken or written down.', 10.00, 'binary', true, 3, NOW(), NOW()),
            
            ($4, $11, 'Professional Tone & Warmth: Rate the agent''s emotional intelligence and demeanor.', 'Greeting, empathy level, helpfulness, and concluding check.', 10.00, 'rating', false, 1, NOW(), NOW()),
            ($5, $11, 'Active Listening: Did the agent refrain from interrupting and show attentiveness?', 'Reflecting customer sentiments, using active listening markers.', 10.00, 'radio', false, 2, NOW(), NOW()),
            ($6, $11, 'Empathy & Rapport Level: Assess empathy towards customer pain points.', 'Demonstrating alignment with the customer''s situation.', 10.00, 'percentage', false, 3, NOW(), NOW()),
            
            ($7, $12, 'Issue Identification: Did the agent accurately diagnose the root issue?', 'Ensuring agent correctly isolates why the customer called.', 15.00, 'dropdown', false, 1, NOW(), NOW()),
            ($8, $12, 'Technical Solution Correctness: Was the resolution or troubleshooting step accurate?', 'Giving incorrect information counts as critical failure.', 15.00, 'binary', true, 2, NOW(), NOW()),
            ($9, $12, 'After Call Work (ACW) Actions: Post-call wrap-up activities performed.', 'Documenting notes, scheduling follow-ups, setting reminders.', 10.00, 'multiselect', false, 3, NOW(), NOW())
        `, [
          q1Id, q2Id, q3Id, q4Id, q5Id, q6Id, q7Id, q8Id, q9Id,
          sec1Id, sec2Id, sec3Id
        ]);
        
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
      
      scorecardRes = await db.query(`SELECT id, name, description, passing_score FROM public.scorecards WHERE id = $1`, [scorecardId]);
    } else {
      scorecardId = scorecardRes.rows[0].id;
    }
    
    // Fetch sections and questions
    const sectionsRes = await db.query(`
      SELECT id, name, weight, order_index 
      FROM public.scorecard_sections 
      WHERE scorecard_id = $1 
      ORDER BY order_index ASC
    `, [scorecardId]);
    
    const questionsRes = await db.query(`
      SELECT q.id, q.section_id as "sectionId", q.question_text as "questionText", q.help_text as "helpText", 
             q.weight, q.question_type as "questionType", q.is_critical as "isCritical", q.order_index as "orderIndex",
             q.formula, q.formula_output_type as "formulaOutputType", q.options
      FROM public.scorecard_questions q
      JOIN public.scorecard_sections s ON q.section_id = s.id
      WHERE s.scorecard_id = $1
      ORDER BY s.order_index ASC, q.order_index ASC
    `, [scorecardId]);
    
    // Assemble
    const scorecard = {
      ...scorecardRes.rows[0],
      sections: sectionsRes.rows.map(sec => ({
        ...sec,
        questions: questionsRes.rows.filter(q => q.sectionId === sec.id)
      }))
    };
    
    res.json(scorecard);
  } catch (err: any) {
    console.error("Fetch/Create Scorecard Failed:", err);
    res.status(500).json({ error: "Failed to load scorecard structure.", details: err.message });
  }
});

// GET /api/audit/draft/:caseId
app.get("/api/audit/draft/:caseId", async (req, res) => {
  const db = getPool();
  const { caseId } = req.params;
  try {
    const result = await db.query(`
      SELECT id, scorecard_id as "scorecardId", auditor_id as "auditorId", agent_id as "agentId", 
             raw_score as "rawScore", weighted_score as "weightedScore", status, 
             is_critical_failed as "isCriticalFailed", general_comments as "generalComments", 
             coaching_notes as "coachingNotes", answers
      FROM public.audits
      WHERE case_id = $1 AND status = 'draft'
      LIMIT 1
    `, [caseId]);
    
    if (result.rows.length === 0) {
      return res.json(null);
    }
    
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("Fetch Audit Draft Failed:", err);
    res.status(500).json({ error: "Failed to fetch audit draft." });
  }
});

// GET /api/audit/results/:caseId
app.get("/api/audit/results/:caseId", async (req, res) => {
  const db = getPool();
  const { caseId } = req.params;
  try {
    const result = await db.query(`
      SELECT id, scorecard_id as "scorecardId", auditor_id as "auditorId", agent_id as "agentId", 
             raw_score as "rawScore", weighted_score as "weightedScore", status, 
             is_critical_failed as "isCriticalFailed", general_comments as "generalComments", 
             coaching_notes as "coachingNotes", answers, locked_at as "lockedAt"
      FROM public.audits
      WHERE case_id = $1
      LIMIT 1
    `, [caseId]);
    
    if (result.rows.length === 0) {
      return res.json(null);
    }
    
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("Fetch Audit Results Failed:", err);
    res.status(500).json({ error: "Failed to fetch audit results." });
  }
});

// POST /api/audit/save
app.post("/api/audit/save", async (req, res) => {
  const db = getPool();
  const { 
    caseId, scorecardId, auditorId, agentId, rawScore, weightedScore, 
    isCriticalFailed, answers, generalComments, coachingNotes, status = 'draft'
  } = req.body;
  
  if (!caseId || !auditorId) {
    return res.status(400).json({ error: "Missing required fields (caseId, auditorId)." });
  }
  
  try {
    let realScorecardId = scorecardId;
    if (typeof realScorecardId === "string" && realScorecardId.startsWith("batch_")) {
      const fbScorecard = await db.query("SELECT id FROM public.scorecards WHERE deleted_at IS NULL LIMIT 1");
      if (fbScorecard.rows.length > 0) {
        realScorecardId = fbScorecard.rows[0].id;
      }
    }
    // Fetch agent_id from case if not provided
    let finalAgentId = agentId;
    if (!finalAgentId) {
      const caseRes = await db.query(`SELECT agent_id FROM public.audit_cases WHERE id = $1`, [caseId]);
      if (caseRes.rows.length > 0 && caseRes.rows[0].agent_id) {
        finalAgentId = caseRes.rows[0].agent_id;
      }
    }
    finalAgentId = finalAgentId || '00000000-0000-0000-0000-000000000001';
    
    const existCheck = await db.query(`SELECT id FROM public.audits WHERE case_id = $1`, [caseId]);
    
    let auditId;
    if (existCheck.rows.length > 0) {
      auditId = existCheck.rows[0].id;
      await db.query(`
        UPDATE public.audits
        SET raw_score = $1, weighted_score = $2, is_critical_failed = $3, answers = $4,
            general_comments = $5, coaching_notes = $6, status = $7, updated_at = NOW(),
            auditor_id = $8, agent_id = $9
        WHERE id = $10
      `, [
        rawScore || 0, weightedScore || 0, !!isCriticalFailed, JSON.stringify(answers || []),
        generalComments || "", coachingNotes || "", status, auditorId, finalAgentId, auditId
      ]);
    } else {
      auditId = crypto.randomUUID();
      await db.query(`
        INSERT INTO public.audits (
          id, case_id, scorecard_id, auditor_id, agent_id, raw_score, weighted_score, 
          status, is_critical_failed, answers, general_comments, coaching_notes, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      `, [
        auditId, caseId, realScorecardId, auditorId, finalAgentId, rawScore || 0, weightedScore || 0, 
        status, !!isCriticalFailed, JSON.stringify(answers || []), generalComments || "", coachingNotes || ""
      ]);
    }
    
    res.json({ success: true, auditId });
  } catch (err: any) {
    console.error("Save Audit Draft Failed:", err);
    res.status(500).json({ error: "Failed to save audit draft.", details: err.message });
  }
});

// POST /api/audit/submit
app.post("/api/audit/submit", async (req, res) => {
  const db = getPool();
  const { 
    caseId, scorecardId, auditorId, agentId, rawScore, weightedScore, 
    isCriticalFailed, answers, generalComments, coachingNotes, durationSeconds
  } = req.body;
  
  if (!caseId || !auditorId) {
    return res.status(400).json({ error: "Missing required fields (caseId, auditorId)." });
  }
  
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    
    // 1. Fetch case info to notify agent
    const caseRes = await client.query(`
      SELECT c.external_case_id, COALESCE(u.full_name, c.metadata->>'agentNameRaw') as "agentName", u.id as "agentId"
      FROM public.audit_cases c
      LEFT JOIN public.users u ON c.agent_id = u.id
      WHERE c.id = $1
    `, [caseId]);
    
    if (caseRes.rows.length === 0) {
      throw new Error("Audit case not found.");
    }
    
    const { external_case_id } = caseRes.rows[0];
    const targetAgentId = agentId || caseRes.rows[0].agentId || '00000000-0000-0000-0000-000000000001';
    
    // 2. Update case status to 'audited'
    await client.query(`
      UPDATE public.audit_cases 
      SET status = 'audited', updated_at = NOW() 
      WHERE id = $1
    `, [caseId]);
    
    // 3. Upsert the finalized audit with status = 'submitted' (Locked)
    let realScorecardId = scorecardId;
    if (typeof realScorecardId === "string" && realScorecardId.startsWith("batch_")) {
      const fbScorecard = await client.query("SELECT id FROM public.scorecards WHERE deleted_at IS NULL LIMIT 1");
      if (fbScorecard.rows.length > 0) {
        realScorecardId = fbScorecard.rows[0].id;
      }
    }
    const existCheck = await client.query(`SELECT id FROM public.audits WHERE case_id = $1`, [caseId]);
    
    let auditId;
    if (existCheck.rows.length > 0) {
      auditId = existCheck.rows[0].id;
      await client.query(`
        UPDATE public.audits
        SET raw_score = $1, weighted_score = $2, is_critical_failed = $3, answers = $4,
            general_comments = $5, coaching_notes = $6, status = 'submitted', updated_at = NOW(),
            auditor_id = $7, agent_id = $8, locked_at = NOW(), duration_seconds = COALESCE($9, duration_seconds, 0)
        WHERE id = $10
      `, [
        rawScore, weightedScore, !!isCriticalFailed, JSON.stringify(answers || []),
        generalComments, coachingNotes, auditorId, targetAgentId, durationSeconds || 0, auditId
      ]);
    } else {
      auditId = crypto.randomUUID();
      await client.query(`
        INSERT INTO public.audits (
          id, case_id, scorecard_id, auditor_id, agent_id, raw_score, weighted_score, 
          status, is_critical_failed, answers, general_comments, coaching_notes, locked_at, duration_seconds, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted', $8, $9, $10, $11, NOW(), $12, NOW(), NOW())
      `, [
        auditId, caseId, realScorecardId, auditorId, targetAgentId, rawScore, weightedScore, 
        !!isCriticalFailed, JSON.stringify(answers || []), generalComments, coachingNotes, durationSeconds || 0
      ]);
    }
    
    // 4. Create Notification for the Agent (if agent is assigned)
    if (targetAgentId) {
      const notifTitle = "Quality Evaluation Completed";
      const notifContent = `Your quality evaluation for Case ${external_case_id} has been submitted with a score of ${weightedScore}%. Click to view your scorecard details.`;
      
      await client.query(`
        INSERT INTO public.notifications (user_id, title, content, type, is_read, created_at)
        VALUES ($1, $2, $3, 'feedback_received', false, NOW())
      `, [targetAgentId, notifTitle, notifContent]);
    }
    
    // 5. Create Activity Log
    await client.query(`
      INSERT INTO public.activity_logs (user_id, action_category, description, payload, created_at)
      VALUES ($1, 'audit_submission', $2, $3, NOW())
    `, [
      auditorId, 
      `Submitted quality evaluation for case ${external_case_id}`, 
      JSON.stringify({ caseId, score: weightedScore, isCriticalFailed })
    ]);
    
    await client.query("COMMIT");
    res.json({ success: true, auditId });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Submit Audit Failed:", err);
    res.status(500).json({ error: "Failed to submit finalized audit evaluation.", details: err.message });
  } finally {
    client.release();
  }
});

// Lazy Gemini API Initializer to prevent startup crashes when API key is unconfigured
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// 1. API: Generate architecture blueprints for future Precision360 modules
app.post("/api/generate-blueprint", async (req, res) => {
  const { moduleName, moduleDescription } = req.body;

  if (!moduleName || moduleName.trim() === "") {
    return res.status(400).json({ error: "Module Name is required." });
  }

  const normalizedModuleName = moduleName.trim();
  const normalizedDesc = moduleDescription?.trim() || `Enterprise module for ${normalizedModuleName}`;

  const ai = getAiClient();

  if (!ai) {
    // Elegant fallbacks for local/preview development without active API keys
    console.warn("GEMINI_API_KEY not found. Operating in local simulated mode.");
    
    // Generate high-fidelity mockup blueprint dynamically using deterministic JS templates
    const folderSlug = normalizedModuleName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const sqlTableName = `${folderSlug.replace(/-/g, "_")}`;

    const mockBlueprint = {
      isSimulated: true,
      moduleName: normalizedModuleName,
      folderTree: {
        name: `src/app/(dashboard)/${folderSlug}`,
        type: "folder",
        description: `Direct Next.js App Router workspace housing the ${normalizedModuleName} screens.`,
        children: [
          {
            name: "page.tsx",
            type: "file",
            description: `Main dashboard screen for ${normalizedModuleName}, featuring metrics and grid list views.`,
            code: `import React, { Suspense } from 'react';
import LoadingSkeleton from '@/src/components/ui/LoadingSkeleton';

export default async function ${normalizedModuleName.replace(/\s+/g, '')}Page() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">${normalizedModuleName}</h1>
        <p className="text-sm text-slate-500">${normalizedDesc}</p>
      </div>
      
      {/* Dynamic module widgets */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
        <p className="text-sm text-slate-600">The ${normalizedModuleName} workspace layout was generated using the Precision360 standards.</p>
      </div>
    </div>
  );
}`
          },
          {
            name: "loading.tsx",
            type: "file",
            description: "Default Next.js loading wrapper mapping to high-contrast skeleton states.",
            code: `import LoadingSkeleton from '@/src/components/ui/LoadingSkeleton';

export default function Loading() {
  return <LoadingSkeleton count={5} />;
}`
          }
        ]
      },
      dbSchema: {
        tableName: `core.${sqlTableName}`,
        description: `Persistent transactional storage module mapping directly to ${normalizedModuleName} events.`,
        sql: `CREATE TABLE core.${sqlTableName} (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES core.users(id) ON DELETE CASCADE,
    details JSONB NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE core.${sqlTableName} ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant Data Isolation Policy
CREATE POLICY "Tenant Isolation: ${normalizedModuleName}" ON core.${sqlTableName}
    FOR ALL USING (tenant_id = auth.jwt() ->> 'tenant_id');`
      },
      zodSchema: `import { z } from 'zod';

export const ${folderSlug.replace(/-(.)/g, (_, c) => c.toUpperCase())}Schema = z.object({
  tenantId: z.string().uuid(),
  createdBy: z.string().uuid(),
  details: z.record(z.string(), z.any()),
  createdAt: z.string().datetime().optional()
});

export type ${normalizedModuleName.replace(/\s+/g, '')}Input = z.infer<typeof ${folderSlug.replace(/-(.)/g, (_, c) => c.toUpperCase())}Schema>;`
    };

    return res.json(mockBlueprint);
  }

  try {
    const prompt = `
      You are an expert SaaS Architect designing the scalability layer for the "Precision360" enterprise monorepo platform.
      The user wants to expand the platform by architecting a brand new feature module: "${normalizedModuleName}".
      Description of this feature: "${normalizedDesc}".

      Generate a highly-polished, enterprise-ready architectural expansion kit for this module that conforms strictly to:
      1. Next.js App Router conventions (layouts, folder groups, sub-routing, clean naming)
      2. Supabase / Postgres Database architecture (with strict tenant isolation, foreign keys, and RLS policies)
      3. Zod validation schemas for forms and API validation.

      Provide your response in raw JSON format matching this schema (do NOT wrap in markdown code blocks, just pure JSON):
      {
        "isSimulated": false,
        "moduleName": "${normalizedModuleName}",
        "folderTree": {
          "name": "src/app/(dashboard)/[module-folder-name]",
          "type": "folder",
          "description": "Folder description matching standard Next.js route groups.",
          "children": [
            {
              "name": "filename.tsx",
              "type": "file",
              "description": "Short explanation of purpose",
              "code": "Full, realistic TypeScript component code matching the module rules..."
            }
          ]
        },
        "dbSchema": {
          "tableName": "core or qa schema table name",
          "description": "Purpose of the database table",
          "sql": "Complete CREATE TABLE statement with foreign keys and ALTER TABLE ENABLE RLS / CREATE POLICY tenant isolation statements..."
        },
        "zodSchema": "Complete Zod code snippet with TypeScript inference definitions..."
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const outputText = response.text;
    const cleanOutput = JSON.parse(outputText);
    return res.json(cleanOutput);
  } catch (err: any) {
    console.error("AI Generation Error:", err);
    return res.status(500).json({ error: "AI Generation failed.", details: err.message });
  }
});

// ============================================================================
// DYNAMIC PRECISION QA AI ASSISTANT ENDPOINTS
// ============================================================================

// 1. AI Co-Audit Evaluator (supports standard gemini-3.5-flash and gemini-3.1-pro-preview with high thinking)
app.post("/api/ai/evaluate-case", async (req, res) => {
  const { caseId, questions, depth } = req.body;
  if (!caseId || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: "caseId and an array of scorecard questions are required." });
  }

  const db = getPool();
  let caseRecord: any = null;
  try {
    const caseRes = await db.query(`
      SELECT 
        c.id, 
        c.external_case_id as "caseId", 
        c.metadata, 
        COALESCE(u.full_name, c.metadata->>'agentNameRaw') as "agentName", 
        cl.name as "client", 
        l.name as "lob", 
        c.transcript_url as "transcriptUrl"
      FROM public.audit_cases c
      LEFT JOIN public.users u ON c.agent_id = u.id
      LEFT JOIN public.lobs l ON c.lob_id = l.id
      LEFT JOIN public.clients cl ON l.client_id = cl.id
      WHERE c.id = $1
    `, [caseId]);
    if (caseRes.rows.length > 0) {
      caseRecord = caseRes.rows[0];
    }
  } catch (dbErr) {
    console.error("Database fetch error for AI Evaluation:", dbErr);
  }

  // Retrieve transcript dialogue from case details, fallback to realistic mock dialogue
  const transcriptText = caseRecord?.metadata?.transcript || caseRecord?.metadata?.dialogue || caseRecord?.metadata?.conversation || `
Customer: Hello! I'm calling about my account balance. I think there was a double payment or error on the 1st of July.
Representative: Hello, thank you for calling. I can certainly help you with that balance dispute today. May I please have your full name and the last four digits of your account number to locate your record?
Customer: Sure, my name is John Smith and the last four digits are 9876.
Representative: Thank you, Mr. Smith. I have verified your identity. Let me review your transaction history. Ah, yes, I see two identical payments of $120.00 posted on July 1st.
Customer: Yes! One of them was supposed to be voided because the system glitched.
Representative: I completely understand. I will initiate a refund request for the duplicate transaction right away. It should reflect in your bank account in 2 to 3 business days.
Customer: Excellent. That is all I needed.
Representative: Is there anything else I can assist you with today, Mr. Smith?
Customer: No, that covers it. Thank you so much!
Representative: You're very welcome. Thank you for choosing us, have a wonderful day!
  `;

  const ai = getAiClient();
  if (!ai) {
    // Elegant fallback simulation when Gemini API key is missing
    console.log("Gemini API is not configured; returning simulated draft evaluation.");
    const answers = questions.map((q: any) => {
      let val = "Yes";
      if (q.questionType === "rating") val = "5";
      else if (q.questionType === "dropdown") val = q.options?.[0] || "Pass";
      return {
        questionId: q.id,
        value: val,
        comment: `[Grounded AI Co-Audit] The dialogue shows the agent successfully met the requirements for "${q.questionText}". Direct evidence: "I have verified your identity. Let me review your transaction history."`
      };
    });
    return res.json({
      answers,
      generalComments: "The representative successfully verified the caller's identity, maintained an empathetic tone, and resolved the balance issue efficiently.",
      strengths: "The agent used appropriate security protocols and resolved the dispute quickly without putting the caller on hold.",
      opportunities: "Could improve active listening slightly by confirming the refund amount prior to initiating the request."
    });
  }

  try {
    const systemInstruction = `
You are an expert Enterprise Quality Auditor on the PrecisionQA platform.
Your task is to analyze the provided case interaction transcript and evaluate it against the given list of scorecard questions.
For each question:
1. Provide the evaluated answer value ("Yes", "No", rating stars "1"-"5", or a matching dropdown option).
2. Write a highly specific, professional, and compliant audit justification comment citing direct evidence or quotes from the transcript.
Also generate an overall summary of compliance findings (generalComments), a list of agent strengths, and opportunities for coaching.
Do not invent facts outside the transcript.
    `;

    const contents = `
Interaction Transcript:
${transcriptText}

Scorecard Questions to Evaluate:
${JSON.stringify(questions, null, 2)}
    `;

    const isHighThinking = depth === "high_thinking";
    const modelName = isHighThinking ? "gemini-3.1-pro-preview" : "gemini-3.5-flash";

    console.log(`[AI Evaluation] Dispatching to ${modelName} (Depth: ${depth || "standard"})`);

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        answers: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              questionId: { type: Type.STRING },
              value: { type: Type.STRING, description: "Answer value like 'Yes', 'No', a rating number '1'-'5', or option matching the question type." },
              comment: { type: Type.STRING, description: "Detailed auditor comment justifying the grade based strictly on transcript evidence." }
            },
            required: ["questionId", "value", "comment"]
          }
        },
        generalComments: { type: Type.STRING, description: "Overall operational compliance summary of the audit." },
        strengths: { type: Type.STRING, description: "Distinct strengths displayed by the representative." },
        opportunities: { type: Type.STRING, description: "Constructive opportunities or tips for agent coaching." }
      },
      required: ["answers", "generalComments", "strengths", "opportunities"]
    };

    const config: any = {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    };

    if (isHighThinking) {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH
      };
      // Do NOT set maxOutputTokens for thinking mode to allow model space to process
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.error("AI Evaluation failed:", err);
    return res.status(500).json({ error: "AI Evaluation failed to generate.", details: err.message });
  }
});

// 2. Regulatory & Compliance Policy Search (Grounded via Google Search)
app.post("/api/ai/compliance-search", async (req, res) => {
  const { query } = req.body;
  if (!query || query.trim() === "") {
    return res.status(400).json({ error: "Query is required." });
  }

  const ai = getAiClient();
  if (!ai) {
    console.log("Gemini API key is unconfigured. Returning simulated compliance policy guidelines.");
    return res.json({
      text: `### [Offline Compliance Mode: Gemini API Key Missing]
Based on typical industry regulatory frameworks (HIPAA Security Rule, PCI-DSS v4.0, GLBA, and SOC 2 Type II), quality audits must verify strict data privacy, call authentication, and cryptographic standards.
1. **Identity Authentication**: Always verify full name and at least one secondary identifier (account number, PIN, DOB) before releasing details.
2. **Cardholder Data (PCI)**: Reps must never record CVV2 or plain text card numbers. Scribes and recording systems must mask these details.
3. **Disclosure Requirements**: Terms, cancellation policies, and refund durations must be clearly stated during active transaction processing.
*To activate live regulatory web search, configure your GEMINI_API_KEY inside Settings > Secrets.*`,
      sources: [
        { title: "HIPAA Security Standards (HHS)", uri: "https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html" },
        { title: "PCI DSS v4.0 Official Standards", uri: "https://www.pcisecuritystandards.org/" }
      ]
    });
  }

  try {
    console.log("[AI Search] Dispatching search grounding query to gemini-3.5-flash");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are an expert Enterprise Compliance, Quality Assurance, and Policy Specialist on the PrecisionQA platform. 
Provide a detailed, structured, and compliant answer to this operational quality query using real-time Google Search grounding data. 
Make sure your tone is professional, authoritative, and helpful for a QA Auditor or Manager.
Query: ${query}`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || "No insights found.";
    
    // Extract Grounding Chunks & Sources
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((chunk: any) => ({
      title: chunk.web?.title || "Web Source",
      uri: chunk.web?.uri || "#"
    })).filter((s: any) => s.uri !== "#");

    return res.json({ text, sources });
  } catch (err: any) {
    console.error("AI Compliance Search failed:", err);
    return res.status(500).json({ error: "AI Compliance Search failed.", details: err.message });
  }
});

// 3. AI Scorecard Draft Generator (uses gemini-3.1-flash-lite for instant turnaround)
app.post("/api/ai/generate-scorecard", async (req, res) => {
  const { industry, lob, goal } = req.body;
  if (!industry || !lob) {
    return res.status(400).json({ error: "Industry and Line of Business (LOB) are required." });
  }

  const ai = getAiClient();
  if (!ai) {
    console.log("Gemini API key is unconfigured. Returning simulated LOB scorecard template.");
    return res.json({
      sections: [
        {
          name: "Standard Communication & Brand Protocol",
          weight: 40,
          questions: [
            { questionText: "Did the representative state the brand greeting clearly?", helpText: "Greeting must match specified brand script.", questionType: "binary", weight: 20 },
            { questionText: "Did the representative confirm caller identification?", helpText: "Verified name and last 4 digits.", questionType: "binary", weight: 20 }
          ]
        },
        {
          name: "Industry Compliance & Security Checklist",
          weight: 60,
          questions: [
            { questionText: `Adhered to ${industry} regulatory privacy norms?`, helpText: "No unencrypted disclosures or plain credentials.", questionType: "binary", weight: 30, isCritical: true },
            { questionText: "Did the representative summarize resolution and key disclosures?", helpText: "Set clear customer expectations.", questionType: "binary", weight: 30 }
          ]
        }
      ]
    });
  }

  try {
    console.log(`[AI Scorecard] Generating template for ${industry} - ${lob} using gemini-3.1-flash-lite`);
    const systemInstruction = `
You are an expert SaaS QA Form Designer. Generate a highly comprehensive, custom-tailored scorecard outline matching the specified industry and business operations.
Requirements:
1. Divide the scorecard into 2-3 logical, professional sections (e.g., Compliance, Soft Skills, Technical/Operational Resolution).
2. Ensure sections weights sum exactly to 100%.
3. Add 2-3 concrete, specific, actionable questions under each section, detailing professional questionText and helpText instructions.
4. Set questionType to 'binary' (for Yes/No), 'rating' (for stars), or 'dropdown' (for standard grading).
5. Mark critical items (like compliance failures or verification skips) with isCritical: true.
    `;

    const contents = `
Industry Sector: ${industry}
Line of Business / Department: ${lob}
Scorecard Goal & Directives: ${goal || "General operational audit & resolution compliance"}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  weight: { type: Type.INTEGER, description: "Weight of the section out of 100. Sum of section weights must be 100" },
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        questionText: { type: Type.STRING },
                        helpText: { type: Type.STRING },
                        questionType: { type: Type.STRING, description: "Must be 'binary', 'rating', or 'dropdown'" },
                        weight: { type: Type.INTEGER, description: "Weight of the question within the section." },
                        isCritical: { type: Type.BOOLEAN, description: "True if failure on this question causes immediate critical failure of entire evaluation." }
                      },
                      required: ["questionText", "helpText", "questionType", "weight"]
                    }
                  }
                },
                required: ["name", "weight", "questions"]
              }
            }
          },
          required: ["sections"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (err: any) {
    console.error("AI Scorecard generation failed:", err);
    return res.status(500).json({ error: "Failed to generate AI scorecard template.", details: err.message });
  }
});

// 4. AI Coaching and Team Analytics Insights
app.post("/api/ai/analytics-insights", async (req, res) => {
  const { stats } = req.body;
  
  const ai = getAiClient();
  if (!ai) {
    return res.json({
      insights: [
        "Quality Trend: Audit compliance is averaging 88.5%, showing high alignment with soft skills metrics.",
        "Operational Risk: Skip-rate on critical authentication checkmarks rose by 1.2% in the recent retail batch.",
        "Coaching Recommendation: Plan a 10-minute micro-coaching sprint regarding secure PCI cardholder masking during phone disputes."
      ]
    });
  }

  try {
    console.log("[AI Insights] Analyzing operational metrics with gemini-3.5-flash");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are an expert Performance Coach & Operational Quality Analyst on the PrecisionQA platform.
Given the following aggregated performance statistics from recent audits, compile 3 distinct, actionable, high-level operational insights, coaching opportunities, or performance trends.
Ensure recommendations are specific and direct. Return them as a flat JSON array of strings.

Aggregated Statistics:
${JSON.stringify(stats, null, 2)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const insights = JSON.parse(response.text || "[]");
    return res.json({ insights });
  } catch (err: any) {
    console.error("AI Analytics Insights failed:", err);
    return res.status(500).json({ error: "AI Analytics Insights failed to compile.", details: err.message });
  }
});

// ============================================================================
// ENTERPRISE AGENT FEEDBACK & DISPUTE PORTAL API ENDPOINTS
// ============================================================================

// Schema verification/migration runner
async function verifyDatabaseSchema() {
  const db = getPool();
  try {
    console.log("[Schema Migration] Verifying disputes table has challenged_questions and attachment_url...");
    await db.query(`
      ALTER TABLE public.disputes 
      ADD COLUMN IF NOT EXISTS challenged_questions JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT;
    `);
    console.log("[Schema Migration] Disputes table columns verified successfully!");

    // Check if roles are empty, if so, insert defaults
    const rolesCheck = await db.query("SELECT COUNT(*) FROM public.roles");
    if (parseInt(rolesCheck.rows[0].count) === 0) {
      console.log("[Schema Migration] Seeding default roles...");
      const defaultRoles = [
        { name: "Super Admin", desc: "Highest clearance administrative account with full system controls." },
        { name: "Admin", desc: "Local tenant administrative account with configuration rights." },
        { name: "QA Manager", desc: "Quality Assurance management of workflows, scorecards and assignments." },
        { name: "QA Auditor", desc: "Quality Assurance grading, dispute reviews and calibration." },
        { name: "Supervisor", desc: "Operations supervisor with oversight over agent performance." },
        { name: "Agent", desc: "Front-line support representative subject to auditing." },
        { name: "Client", desc: "External client representative with limited dashboard views." }
      ];
      for (const r of defaultRoles) {
        await db.query("INSERT INTO public.roles (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING", [
          toUUID("role-" + r.name.toLowerCase().replace(/\s+/g, "")),
          r.name,
          r.desc
        ]);
      }
    }

    // ALWAYS Populate Role Caches from Database
    const allRoles = await db.query("SELECT id, name FROM public.roles");
    roleMapCache.clear();
    idToRoleCache.clear();
    allRoles.rows.forEach(r => {
      const normalizedName = r.name.toLowerCase().replace(/_/g, "").replace(/\s+/g, "");
      roleMapCache.set(r.name, r.id);
      roleMapCache.set(normalizedName, r.id);
      
      // Map ID back to frontend role string
      let roleString = normalizedName;
      if (normalizedName === "superadmin") roleString = "super_admin";
      if (normalizedName === "qamanager") roleString = "qa_manager";
      if (normalizedName === "qaauditor") roleString = "qa_auditor";
      if (normalizedName === "teamleader" || normalizedName === "supervisor") roleString = "team_leader";
      
      idToRoleCache.set(r.id.toLowerCase(), roleString);
    });
    console.log(`[Cache] Synchronized ${allRoles.rows.length} enterprise roles.`);

    // Check if permissions are empty, if so, insert defaults
    const permCheck = await db.query("SELECT COUNT(*) FROM public.permissions");
    if (parseInt(permCheck.rows[0].count) === 0) {
      console.log("[Schema Migration] Seeding default permissions...");
      const defaultPerms = [
        { name: "Can Import Cases", desc: "Permission to run manual Google Sheets and API imports." },
        { name: "Can Assign", desc: "Permission to configure, trigger or override QA auto-assignments." },
        { name: "Can Audit", desc: "Permission to perform active agent call/chat/email auditing." },
        { name: "Can Modify Scores", desc: "Permission to edit, recalibrate or override locked scores." },
        { name: "Can View Reports", desc: "Permission to view operational reports and dashboards." },
        { name: "Can Manage Users", desc: "Permission to invite, edit and deactivate platform users." },
        { name: "Can Configure Scorecards", desc: "Permission to build and manage dynamic scorecard templates." },
        { name: "Can Close Disputes", desc: "Permission to arbitrate, approve or reject agent disputes." }
      ];
      for (const p of defaultPerms) {
        await db.query("INSERT INTO public.permissions (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING", [
          toUUID("perm-" + p.name.toLowerCase().replace(/\s+/g, "")),
          p.name,
          p.desc
        ]);
      }

      // Sync role permissions for default roles (Super Admin gets all, Admin gets all, others get relevant)
      const allRoles = await db.query("SELECT id, name FROM public.roles");
      
      // Update cache
      roleMapCache.clear();
      idToRoleCache.clear();
      allRoles.rows.forEach(r => {
        const normalizedName = r.name.toLowerCase().replace(/_/g, "").replace(/\s+/g, "");
        roleMapCache.set(r.name, r.id);
        roleMapCache.set(normalizedName, r.id);
        
        // Map ID back to frontend role string
        let roleString = normalizedName;
        if (normalizedName === "superadmin") roleString = "super_admin";
        if (normalizedName === "qamanager") roleString = "qa_manager";
        if (normalizedName === "qaauditor") roleString = "qa_auditor";
        if (normalizedName === "teamleader" || normalizedName === "supervisor") roleString = "team_leader";
        
        idToRoleCache.set(r.id.toLowerCase(), roleString);
      });

      const allPerms = await db.query("SELECT id, name FROM public.permissions");
      
      for (const role of allRoles.rows) {
        const rName = role.name.toLowerCase();
        for (const perm of allPerms.rows) {
          const pName = perm.name.toLowerCase();
          let link = false;
          if (rName === "super admin" || rName === "admin") {
            link = true;
          } else if (rName === "qa manager") {
            // QA Managers handle everything except perhaps deep system settings in some setups, 
            // but for PrecisionQA they need to manage users and scorecards.
            link = true; 
          } else if (rName === "qa auditor") {
            link = pName.includes("audit") || pName.includes("view reports") || pName.includes("disputes");
          } else if (rName === "supervisor") {
            // Supervisors (Team Leads) need to manage their agents (users) and see performance.
            link = pName.includes("view reports") || pName.includes("audit") || pName.includes("manage users");
          } else if (rName === "agent") {
            link = pName.includes("view reports");
          }
          if (link) {
            await db.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
              role.id,
              perm.id
            ]);
          }
        }
      }
    }

    const seedSetting = async (key: string, value: any, description: string) => {
      await db.query(`
        INSERT INTO public.settings (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO NOTHING
      `, [key, JSON.stringify(value), description]);
    };

    // Default Dispute Categories
    await seedSetting("admin_dispute_categories", [
      { id: "wrong_score", name: "Wrong Score", desc: "The score was applied incorrectly based on standard guidelines." },
      { id: "recording_issue", name: "Recording Issue", desc: "Incomplete audio or transcript data was provided during audit." },
      { id: "policy_change", name: "Policy Change", desc: "A recent policy amendment makes the current guideline obsolete." },
      { id: "insufficient_evidence", name: "Insufficient Evidence", desc: "The auditor did not provide concrete proof/notes for the deduction." },
      { id: "others", name: "Others", desc: "General dispute category for other edge cases." }
    ], "Configured categories for agent dispute logs");

    // Default Audit Categories
    await seedSetting("admin_audit_categories", [
      { id: "voice", name: "Voice", desc: "Standard inbound/outbound telephonic voice interaction." },
      { id: "chat", name: "Chat", desc: "Live-chat or synchronous web-chat support." },
      { id: "email", name: "Email", desc: "Asynchronous email-based ticketing workflow." },
      { id: "sales", name: "Sales", desc: "Direct sales and pitching customer interactions." },
      { id: "retention", name: "Retention", desc: "Customer retention and churn prevention interactions." },
      { id: "compliance", name: "Compliance", desc: "Strict adherence to regulatory policy checks." },
      { id: "collections", name: "Collections", desc: "Accounts receivable and payment collection workflows." }
    ], "Active categories for QA scoring templates");

    // Default Processes
    await seedSetting("admin_processes", [
      { id: "voice_support", name: "Inbound Voice Support", code: "PR-VOICE", desc: "Inbound voice interactions" },
      { id: "chat_support", name: "Live Chat Support", code: "PR-CHAT", desc: "Real-time web chat support" },
      { id: "email_support", name: "Email Ticketing Support", code: "PR-EMAIL", desc: "Back office email ticketing" },
      { id: "social_support", name: "Social Media Support", code: "PR-SOCIAL", desc: "Public social channels monitoring" }
    ], "Operational business processes mapped to LOBs");

    // Default Shifts
    await seedSetting("admin_shifts", [
      { id: "shift_day", name: "Morning Day Shift", startTime: "08:00", endTime: "17:00", breakDuration: "60m", weeklyOff: ["Sunday"], timezone: "UTC" },
      { id: "shift_afternoon", name: "Afternoon Shift", startTime: "14:00", endTime: "23:00", breakDuration: "60m", weeklyOff: ["Sunday"], timezone: "UTC" },
      { id: "shift_night", name: "Graveyard Night Shift", startTime: "22:00", endTime: "07:00", breakDuration: "60m", weeklyOff: ["Saturday", "Sunday"], timezone: "UTC" }
    ], "Operational employee rosters and shifts");

    // Default Attendance Rules
    await seedSetting("admin_attendance_rules", {
      minWorkingHours: "8.0",
      lateMarkThreshold: "15",
      halfDayThreshold: "4.0",
      absentThreshold: "3.0",
      autoCloseSessions: true,
      supervisorModification: true,
      manualOverride: true
    }, "Global system logic rules for assignment and tracking");

    // Default Holidays
    await seedSetting("admin_holidays", [
      { id: "holiday_newyear", name: "New Year's Day", date: "2026-01-01", type: "regional", isOptional: false },
      { id: "holiday_labor", name: "Labor Day", date: "2026-05-01", type: "regional", isOptional: false },
      { id: "holiday_independence", name: "Independence Day", date: "2026-07-04", type: "regional", isOptional: true },
      { id: "holiday_christmas", name: "Christmas Day", date: "2026-12-25", type: "regional", isOptional: false }
    ], "Active corporate holiday calendar events");

    // Default Notification Templates
    await seedSetting("admin_notification_templates", [
      { id: "assignment", subject: "New QA Case Assigned: {caseId}", body: "Hello {userName},\n\nYou have been assigned a new QA auditing case: {caseId} under the {lobName} Line of Business. Please complete this audit by {dueDate}.\n\nBest Regards,\nPrecisionQA System", variables: ["caseId", "userName", "lobName", "dueDate"] },
      { id: "feedback", subject: "QA Audit Feedback Released: Case #{caseId}", body: "Hello {userName},\n\nYour recent interaction has been audited by {auditorName}. Your final score is {score}%. Please log in to review your coaching notes and general feedback.\n\nBest Regards,\nPrecisionQA System", variables: ["caseId", "userName", "auditorName", "score"] },
      { id: "dispute", subject: "Dispute Escalation Raised: Case #{caseId}", body: "Hello {userName},\n\nAn agent has raised a dispute on Case #{caseId}. Detail: {reason}.\n\nPlease review this in your Disputes Dashboard.\n\nBest Regards,\nPrecisionQA System", variables: ["caseId", "userName", "reason"] },
      { id: "reminder", subject: "Pending Audit Case Reminder: Case #{caseId}", body: "Hello {userName},\n\nThis is a friendly reminder that you have a pending audit assignment (Case #{caseId}) that is due soon. Please review and complete this as soon as possible.\n\nBest Regards,\nPrecisionQA System", variables: ["caseId", "userName"] },
      { id: "password_reset", subject: "Reset Your PrecisionQA Password", body: "Hello {userName},\n\nA password reset request was initiated for your account. Please click the link below to set a new password:\n\n{resetLink}\n\nIf you did not request this, please ignore this email.\n\nBest Regards,\nPrecisionQA System", variables: ["userName", "resetLink"] },
      { id: "welcome", subject: "Welcome to PrecisionQA: Account Created", body: "Hello {userName},\n\nWelcome to PrecisionQA! Your enterprise account has been successfully configured. Your temporary password is {tempPassword}.\n\nPlease log in to change your password and complete your profile.\n\nBest Regards,\nPrecisionQA System", variables: ["userName", "tempPassword"] }
    ], "System messaging subject and body templates");

    // Default System Settings
    await seedSetting("admin_system_settings", {
      companyName: "PrecisionQA Enterprise LOB",
      logo: "",
      theme: "light",
      timezone: "America/New_York",
      currency: "USD",
      language: "en",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "12h",
      sessionTimeout: "12 hours"
    }, "Branding and localization presets");

    console.log("[Schema Migration] Database seeding and triggers executed successfully!");
  } catch (err: any) {
    console.error("[Schema Migration] Failed to verify database schema columns:", err.message);
  }
}

// 1. GET /api/feedback/audits - Fetch completed audits
app.get("/api/feedback/audits", async (req, res) => {
  const db = getPool();
  const { userId, role } = req.query;

  if (!userId || !role) {
    return res.status(400).json({ error: "Missing required parameters (userId, role)." });
  }

  try {
    let query = `
      SELECT 
        a.id as "auditId",
        a.case_id as "caseId",
        c.external_case_id as "externalCaseId",
        cl.name as "clientName",
        l.name as "lobName",
        c.case_date as "auditDate",
        a.raw_score as "rawScore",
        a.weighted_score as "weightedScore",
        a.status as "auditStatus",
        a.is_critical_failed as "isCriticalFailed",
        a.general_comments as "generalComments",
        a.coaching_notes as "coachingNotes",
        a.answers as "answers",
        a.feedback_status as "feedbackStatus",
        a.feedback_viewed_at as "feedbackViewedAt",
        a.feedback_acknowledged_at as "feedbackAcknowledgedAt",
        a.feedback_agent_comments as "feedbackAgentComments",
        a.created_at as "createdAt",
        a.locked_at as "lockedAt",
        a.duration_seconds as "durationSeconds",
        COALESCE(u.full_name, c.metadata->>'agentNameRaw') as "agentName",
        u.email as "agentEmail",
        aud.full_name as "auditorName",
        aud.email as "auditorEmail",
        sc.name as "scorecardName"
      FROM public.audits a
      JOIN public.audit_cases c ON a.case_id = c.id
      LEFT JOIN public.users u ON a.agent_id = u.id
      LEFT JOIN public.lobs l ON c.lob_id = l.id
      LEFT JOIN public.clients cl ON l.client_id = cl.id
      LEFT JOIN public.users aud ON a.auditor_id = aud.id
      LEFT JOIN public.scorecards sc ON a.scorecard_id = sc.id
      WHERE a.status != 'draft'
    `;

    const params: any[] = [];
    if (role === "agent") {
      query += ` AND a.agent_id = $1`;
      params.push(toUUID(userId as string));
    }

    query += ` ORDER BY a.created_at DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error("Fetch Completed Audits Failed:", err);
    res.status(500).json({ error: "Failed to fetch completed audits." });
  }
});

// 2. POST /api/feedback/acknowledge - Acknowledge an audit
app.post("/api/feedback/acknowledge", async (req, res) => {
  const db = getPool();
  const { auditId, userId, comments } = req.body;

  if (!auditId || !userId) {
    return res.status(400).json({ error: "Missing required body parameters (auditId, userId)." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const resolvedUserId = toUUID(userId);
    await ensureUserExists(client, resolvedUserId);

    // 1. Update the audit's feedback status
    const updateRes = await client.query(`
      UPDATE public.audits
      SET status = 'acknowledged',
          feedback_status = 'acknowledged',
          feedback_acknowledged_at = NOW(),
          feedback_agent_comments = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING case_id, auditor_id, agent_id, weighted_score
    `, [comments || "", auditId]);

    if (updateRes.rows.length === 0) {
      throw new Error("Audit record not found.");
    }

    const { case_id, auditor_id, agent_id, weighted_score } = updateRes.rows[0];

    // 2. Get case details
    const caseRes = await client.query(`
      SELECT external_case_id FROM public.audit_cases WHERE id = $1
    `, [case_id]);
    const externalCaseId = caseRes.rows[0]?.external_case_id || "Unknown";

    // 3. Get agent name
    const agentRes = await client.query(`
      SELECT full_name FROM public.users WHERE id = $1
    `, [agent_id]);
    const agentName = agentRes.rows[0]?.full_name || "An Agent";

    // 4. Create notification for the auditor
    if (auditor_id) {
      const notifTitle = "Feedback Acknowledged";
      const notifContent = `Agent ${agentName} has acknowledged feedback for Case ${externalCaseId} with score ${weighted_score}%.`;
      await client.query(`
        INSERT INTO public.notifications (user_id, title, content, type, is_read, created_at)
        VALUES ($1, $2, $3, 'feedback_acknowledged', false, NOW())
      `, [auditor_id, notifTitle, notifContent]);
    }

    // 5. Create activity log
    await client.query(`
      INSERT INTO public.activity_logs (user_id, action_category, description, payload, created_at)
      VALUES ($1, 'feedback_acknowledgement', $2, $3, NOW())
    `, [
      resolvedUserId,
      `Agent acknowledged feedback for Case ${externalCaseId}`,
      JSON.stringify({ auditId, comments, score: weighted_score })
    ]);

    await client.query("COMMIT");
    res.json({ success: true, message: "Feedback acknowledged successfully." });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Acknowledge Feedback Failed:", err);
    res.status(500).json({ error: "Failed to acknowledge feedback.", details: err.message });
  } finally {
    client.release();
  }
});

// 3. POST /api/feedback/dispute - Create a new dispute
app.post("/api/feedback/dispute", async (req, res) => {
  const db = getPool();
  const { auditId, userId, reasonCategory, description, challengedQuestions, attachmentUrl } = req.body;

  if (!auditId || !userId || !reasonCategory || !description) {
    return res.status(400).json({ error: "Missing required body parameters (auditId, userId, reasonCategory, description)." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const resolvedUserId = toUUID(userId);
    await ensureUserExists(client, resolvedUserId);

    // 1. Update audit status to disputed
    const auditRes = await client.query(`
      UPDATE public.audits
      SET status = 'disputed',
          feedback_status = 'disputed',
          updated_at = NOW()
      WHERE id = $1
      RETURNING case_id, auditor_id, agent_id, weighted_score
    `, [auditId]);

    if (auditRes.rows.length === 0) {
      throw new Error("Audit record not found.");
    }

    const { case_id, auditor_id, agent_id, weighted_score } = auditRes.rows[0];

    // 2. Update audit case status to disputed
    await client.query(`
      UPDATE public.audit_cases
      SET status = 'disputed',
          updated_at = NOW()
      WHERE id = $1
    `, [case_id]);

    // 3. Create public.disputes entry (using UUID)
    const disputeId = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.disputes (
        id, audit_id, agent_id, reason_category, description, 
        status, challenged_questions, attachment_url, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, NOW(), NOW())
    `, [
      disputeId, auditId, agent_id, reasonCategory, description,
      JSON.stringify(challengedQuestions || []), attachmentUrl || ""
    ]);

    // 4. Get case external ID
    const caseRes = await client.query(`
      SELECT external_case_id FROM public.audit_cases WHERE id = $1
    `, [case_id]);
    const externalCaseId = caseRes.rows[0]?.external_case_id || "Unknown";

    // 5. Get agent name
    const agentRes = await client.query(`
      SELECT full_name FROM public.users WHERE id = $1
    `, [agent_id]);
    const agentName = agentRes.rows[0]?.full_name || "An Agent";

    // 6. Notify auditor
    if (auditor_id) {
      const notifTitle = "Audit Evaluation Disputed";
      const notifContent = `Agent ${agentName} has raised an official dispute for Case ${externalCaseId} (${reasonCategory}).`;
      await client.query(`
        INSERT INTO public.notifications (user_id, title, content, type, is_read, created_at)
        VALUES ($1, $2, $3, 'dispute_raised', false, NOW())
      `, [auditor_id, notifTitle, notifContent]);
    }

    // 7. Activity Log
    await client.query(`
      INSERT INTO public.activity_logs (user_id, action_category, description, payload, created_at)
      VALUES ($1, 'dispute_raised', $2, $3, NOW())
    `, [
      resolvedUserId,
      `Agent raised a dispute for Case ${externalCaseId}`,
      JSON.stringify({ auditId, disputeId, reasonCategory, score: weighted_score })
    ]);

    await client.query("COMMIT");
    res.json({ success: true, disputeId, message: "Dispute submitted successfully." });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Raise Dispute Failed:", err);
    res.status(500).json({ error: "Failed to raise dispute.", details: err.message });
  } finally {
    client.release();
  }
});

// 4. GET /api/feedback/disputes - Fetch disputes with full joins
app.get("/api/feedback/disputes", async (req, res) => {
  const db = getPool();
  const { userId, role } = req.query;

  if (!userId || !role) {
    return res.status(400).json({ error: "Missing required parameters (userId, role)." });
  }

  try {
    let query = `
      SELECT 
        d.id as "disputeId",
        d.audit_id as "auditId",
        d.agent_id as "agentId",
        d.reason_category as "reasonCategory",
        d.description as "description",
        d.status as "disputeStatus",
        d.resolution_summary as "resolutionSummary",
        d.resolved_by as "resolvedBy",
        d.resolved_at as "resolvedAt",
        d.challenged_questions as "challengedQuestions",
        d.attachment_url as "attachmentUrl",
        d.created_at as "createdAt",
        d.updated_at as "updatedAt",
        COALESCE(u.full_name, c.metadata->>'agentNameRaw') as "agentName",
        u.email as "agentEmail",
        aud.id as "auditorId",
        aud.full_name as "auditorName",
        res.full_name as "resolverName",
        c.external_case_id as "externalCaseId",
        cl.name as "clientName",
        l.name as "lobName",
        c.case_date as "auditDate",
        a.raw_score as "rawScore",
        a.weighted_score as "weightedScore",
        a.answers as "answers",
        a.general_comments as "generalComments",
        a.coaching_notes as "coachingNotes"
      FROM public.disputes d
      JOIN public.audits a ON d.audit_id = a.id
      JOIN public.audit_cases c ON a.case_id = c.id
      LEFT JOIN public.users u ON d.agent_id = u.id
      LEFT JOIN public.lobs l ON c.lob_id = l.id
      LEFT JOIN public.clients cl ON l.client_id = cl.id
      LEFT JOIN public.users aud ON a.auditor_id = aud.id
      LEFT JOIN public.users res ON d.resolved_by = res.id
    `;

    const params: any[] = [];
    if (role === "agent") {
      query += ` WHERE d.agent_id = $1`;
      params.push(toUUID(userId as string));
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error("Fetch Disputes Failed:", err);
    res.status(500).json({ error: "Failed to fetch disputes." });
  }
});

// 5. GET /api/feedback/disputes/:disputeId/comments - Fetch comments for a dispute
app.get("/api/feedback/disputes/:disputeId/comments", async (req, res) => {
  const db = getPool();
  const { disputeId } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        dc.id,
        dc.comment_text as "commentText",
        dc.created_at as "createdAt",
        u.id as "userId",
        u.full_name as "userName",
        u.avatar_url as "avatarUrl",
        r.name as "userRole"
      FROM public.dispute_comments dc
      JOIN public.users u ON dc.user_id = u.id
      LEFT JOIN public.roles r ON u.role_id = r.id
      WHERE dc.dispute_id = $1
      ORDER BY dc.created_at ASC
    `, [disputeId]);

    res.json(result.rows);
  } catch (err: any) {
    console.error("Fetch Dispute Comments Failed:", err);
    res.status(500).json({ error: "Failed to fetch comments." });
  }
});

// 6. POST /api/feedback/disputes/:disputeId/comments - Add comment
app.post("/api/feedback/disputes/:disputeId/comments", async (req, res) => {
  const db = getPool();
  const { disputeId } = req.params;
  const { userId, commentText } = req.body;

  if (!userId || !commentText) {
    return res.status(400).json({ error: "Missing required body fields (userId, commentText)." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const resolvedUserId = toUUID(userId);
    await ensureUserExists(client, resolvedUserId);

    const commentId = crypto.randomUUID();
    const commentRes = await client.query(`
      INSERT INTO public.dispute_comments (id, dispute_id, user_id, comment_text, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, created_at
    `, [commentId, disputeId, resolvedUserId, commentText]);

    const comment = commentRes.rows[0];

    // Get commenter's name
    const userRes = await client.query("SELECT full_name, role_id FROM public.users WHERE id = $1", [resolvedUserId]);
    const commenterName = userRes.rows[0]?.full_name || "Someone";

    // Determine other party to notify
    const disputeRes = await client.query(`
      SELECT d.agent_id, a.auditor_id, c.external_case_id
      FROM public.disputes d
      JOIN public.audits a ON d.audit_id = a.id
      JOIN public.audit_cases c ON a.case_id = c.id
      WHERE d.id = $1
    `, [disputeId]);

    if (disputeRes.rows.length > 0) {
      const { agent_id, auditor_id, external_case_id } = disputeRes.rows[0];
      const targetUserId = (resolvedUserId === agent_id) ? auditor_id : agent_id;

      if (targetUserId) {
        await client.query(`
          INSERT INTO public.notifications (user_id, title, content, type, is_read, created_at)
          VALUES ($1, $2, $3, 'dispute_comment', false, NOW())
        `, [
          targetUserId, 
          "New Dispute Comment", 
          `${commenterName} left a comment on Case ${external_case_id}'s dispute.`
        ]);
      }
    }

    await client.query("COMMIT");
    res.json({ success: true, comment });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Add Dispute Comment Failed:", err);
    res.status(500).json({ error: "Failed to post comment.", details: err.message });
  } finally {
    client.release();
  }
});

// 7. POST /api/feedback/disputes/:disputeId/resolve - Resolve dispute
app.post("/api/feedback/disputes/:disputeId/resolve", async (req, res) => {
  const db = getPool();
  const { disputeId } = req.params;
  const { action, comments, userId, newScore } = req.body; // action: 'resolved_approved' or 'resolved_rejected'

  if (!action || !userId) {
    return res.status(400).json({ error: "Missing required body fields (action, userId)." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const resolvedUserId = toUUID(userId);
    await ensureUserExists(client, resolvedUserId);

    // 1. Update dispute status
    const disputeRes = await client.query(`
      UPDATE public.disputes
      SET status = $1,
          resolution_summary = $2,
          resolved_by = $3,
          resolved_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
      RETURNING audit_id, agent_id
    `, [action, comments || "", resolvedUserId, disputeId]);

    if (disputeRes.rows.length === 0) {
      throw new Error("Dispute not found.");
    }

    const { audit_id, agent_id } = disputeRes.rows[0];

    // 2. Fetch current audit details
    const auditRes = await client.query(`
      SELECT case_id, weighted_score FROM public.audits WHERE id = $1
    `, [audit_id]);
    const { case_id, weighted_score: originalScore } = auditRes.rows[0];

    const finalScore = (action === "resolved_approved" && typeof newScore === "number") ? newScore : originalScore;

    // 3. Update audit status to locked, feedback_status to the resolution action, and score if approved
    await client.query(`
      UPDATE public.audits
      SET status = 'locked', -- Locked final score!
          feedback_status = $1,
          raw_score = $2,
          weighted_score = $2,
          locked_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
    `, [action, finalScore, audit_id]);

    // 4. Update audit case status back to audited (or resolved)
    await client.query(`
      UPDATE public.audit_cases
      SET status = 'audited',
          updated_at = NOW()
      WHERE id = $1
    `, [case_id]);

    // 5. Get case details for notification
    const caseRes = await client.query(`
      SELECT external_case_id FROM public.audit_cases WHERE id = $1
    `, [case_id]);
    const externalCaseId = caseRes.rows[0]?.external_case_id || "Unknown";

    // 6. Notify Agent
    const resolutionLabel = action === "resolved_approved" ? "Approved" : "Rejected";
    await client.query(`
      INSERT INTO public.notifications (user_id, title, content, type, is_read, created_at)
      VALUES ($1, $2, $3, 'dispute_resolved', false, NOW())
    `, [
      agent_id,
      `Audit Dispute Resolved`,
      `Your dispute for Case ${externalCaseId} has been ${resolutionLabel}. Final score is locked at ${finalScore}%.`
    ]);

    // 7. Activity Log
    await client.query(`
      INSERT INTO public.activity_logs (user_id, action_category, description, payload, created_at)
      VALUES ($1, 'dispute_resolution', $2, $3, NOW())
    `, [
      resolvedUserId,
      `Resolved dispute for Case ${externalCaseId} as ${action}`,
      JSON.stringify({ disputeId, auditId: audit_id, action, finalScore })
    ]);

    await client.query("COMMIT");
    res.json({ success: true, message: `Dispute resolved successfully as ${action}.` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Resolve Dispute Failed:", err);
    res.status(500).json({ error: "Failed to resolve dispute.", details: err.message });
  } finally {
    client.release();
  }
});

// 8. GET /api/notifications - Get user notifications
app.get("/api/notifications", async (req, res) => {
  const db = getPool();
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing required parameter: userId." });
  }

  try {
    const resolvedUserId = toUUID(userId as string);
    const result = await db.query(`
      SELECT id, title, content, type, is_read as "isRead", action_url as "actionUrl", created_at as "createdAt"
      FROM public.notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 40
    `, [resolvedUserId]);

    res.json(result.rows);
  } catch (err: any) {
    console.error("Fetch Notifications Failed:", err);
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

// 9. POST /api/notifications/:id/read - Mark notification as read
app.post("/api/notifications/:id/read", async (req, res) => {
  const db = getPool();
  const { id } = req.params;

  try {
    await db.query(`
      UPDATE public.notifications
      SET is_read = true
      WHERE id = $1
    `, [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Mark Notification Read Failed:", err);
    res.status(500).json({ error: "Failed to update notification." });
  }
});

// ============================================================================
// ENTERPRISE MASTER CONFIGURATION MODULE API ENDPOINTS
// ============================================================================

// 1. GET /api/admin/config - Fetch all configuration entities and logs
app.get("/api/admin/config", async (req, res) => {
  const db = getPool();
  try {
    // Run all queries in parallel for ultra-high performance
    const [
      clientsRes,
      lobsRes,
      teamsRes,
      usersRes,
      rolesRes,
      permissionsRes,
      rolePermsRes,
      scorecardsRes,
      settingsRes,
      logsRes
    ] = await Promise.all([
      db.query(`SELECT id, name, description, is_active as "isActive" FROM public.clients WHERE deleted_at IS NULL ORDER BY name ASC`),
      db.query(`SELECT id, client_id as "clientId", name, description, is_active as "isActive" FROM public.lobs WHERE deleted_at IS NULL ORDER BY name ASC`),
      db.query(`SELECT id, name, description, manager_id as "managerId" FROM public.teams WHERE deleted_at IS NULL ORDER BY name ASC`),
      db.query(`SELECT id, email, full_name as "fullName", role_id as "roleId", is_active as "isActive", avatar_url as "avatarUrl" FROM public.users WHERE deleted_at IS NULL ORDER BY full_name ASC`),
      db.query(`SELECT id, name, description FROM public.roles ORDER BY name ASC`),
      db.query(`SELECT id, name, description FROM public.permissions ORDER BY name ASC`),
      db.query(`SELECT role_id as "roleId", permission_id as "permissionId" FROM public.role_permissions`),
      db.query(`SELECT id, name, description, lob_id as "lobId", passing_score as "passingScore", is_active as "isActive" FROM public.scorecards WHERE deleted_at IS NULL ORDER BY name ASC`),
      db.query(`SELECT key, value FROM public.settings WHERE key LIKE 'admin_%' OR key = 'auditor_capacities'`),
      db.query(`
        SELECT l.id, l.user_id as "userId", u.full_name as "userName", u.email as "userEmail", l.action_category as "action", l.description, l.payload, l.created_at as "createdAt"
        FROM public.activity_logs l
        LEFT JOIN public.users u ON l.user_id = u.id
        WHERE l.action_category IN ('admin_configuration', 'admin_change') OR l.action_category LIKE 'admin%'
        ORDER BY l.created_at DESC
        LIMIT 100
      `)
    ]);

    // Build key-value settings map
    const settingsMap: any = {};
    for (const row of settingsRes.rows) {
      settingsMap[row.key] = row.value;
    }

    res.json({
      success: true,
      clients: clientsRes.rows,
      lobs: lobsRes.rows,
      teams: teamsRes.rows,
      users: usersRes.rows,
      roles: rolesRes.rows,
      permissions: permissionsRes.rows,
      rolePermissions: rolePermsRes.rows,
      scorecards: scorecardsRes.rows,
      processes: settingsMap["admin_processes"] || [],
      shifts: settingsMap["admin_shifts"] || [],
      attendanceRules: settingsMap["admin_attendance_rules"] || {},
      holidays: settingsMap["admin_holidays"] || [],
      disputeCategories: settingsMap["admin_dispute_categories"] || [],
      auditCategories: settingsMap["admin_audit_categories"] || [],
      notificationTemplates: settingsMap["admin_notification_templates"] || [],
      systemSettings: settingsMap["admin_system_settings"] || {},
      userMetadata: settingsMap["admin_user_metadata"] || {},
      settings: settingsMap,
      departments: settingsMap["admin_departments"] || [],
      locations: settingsMap["admin_locations"] || [],
      designations: settingsMap["admin_designations"] || [],
      auditTypes: settingsMap["admin_audit_types"] || [],
      businessUnits: settingsMap["admin_business_units"] || [],
      skills: settingsMap["admin_skills"] || [],
      languages: settingsMap["admin_languages"] || [],
      campaigns: settingsMap["admin_campaigns"] || [],
      projects: settingsMap["admin_projects"] || [],
      referenceLists: settingsMap["admin_reference_lists"] || [],
      dropdownLibraries: settingsMap["admin_dropdown_libraries"] || [],
      formulaLibraries: settingsMap["admin_formula_libraries"] || [],
      importProfiles: settingsMap["admin_import_profiles"] || [],
      workflowTemplates: settingsMap["admin_workflow_templates"] || [],
      formTemplates: settingsMap["admin_form_templates"] || [],
      assignmentProfiles: settingsMap["admin_assignment_profiles"] || [],
      holidayCalendars: settingsMap["admin_holiday_calendars"] || [],
      activityLogs: logsRes.rows
    });
  } catch (err: any) {
    console.error("Fetch Admin Config Failed:", err);
    res.status(500).json({ error: "Failed to fetch administrative configuration.", details: err.message });
  }
});

// --- PRECISION FORM STUDIO API ENDPOINTS ---

// GET /api/form-studio/scorecards
app.get("/api/form-studio/scorecards", async (req, res) => {
  const db = getPool();
  try {
    const scorecardsRes = await db.query(`
      SELECT id, name, description, lob_id as "lobId", passing_score as "passingScore", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      FROM public.scorecards 
      WHERE deleted_at IS NULL 
      ORDER BY name ASC
    `);

    // Fetch all sections
    const sectionsRes = await db.query(`
      SELECT id, scorecard_id as "scorecardId", name, weight, order_index as "orderIndex"
      FROM public.scorecard_sections
      ORDER BY order_index ASC
    `);

    // Fetch all questions
    const questionsRes = await db.query(`
      SELECT id, section_id as "sectionId", question_text as "questionText", help_text as "helpText", 
             weight, question_type as "questionType", is_critical as "isCritical", order_index as "orderIndex",
             options, description, formula, formula_output_type as "formulaOutputType"
      FROM public.scorecard_questions
      ORDER BY order_index ASC
    `);

    // Map together
    const scorecards = scorecardsRes.rows.map(sc => {
      // Parse description for JSON metadata
      let meta: any = { description: sc.description || "", version: "1.0", status: sc.isActive ? "published" : "draft", tags: [], client: "", process: "", category: "" };
      if (sc.description) {
        try {
          const parsed = JSON.parse(sc.description);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            meta = {
              description: parsed.description || "",
              version: parsed.version || "1.0",
              status: parsed.status || (sc.isActive ? "published" : "draft"),
              tags: parsed.tags || [],
              client: parsed.client || "",
              process: parsed.process || "",
              category: parsed.category || ""
            };
          }
        } catch (e) {
          // Keep default meta
        }
      }

      const scSections = sectionsRes.rows.filter(sec => sec.scorecardId === sc.id);
      const sections = scSections.map(sec => {
        // Parse section name/description if nested
        let secDesc = "";
        let secName = sec.name;
        let isCollapsible = true;
        let isHidden = false;
        let visibilityRule = null;
        try {
          const parsedName = JSON.parse(sec.name);
          if (parsedName && typeof parsedName === "object") {
            secName = parsedName.name || sec.name;
            secDesc = parsedName.description || "";
            isCollapsible = parsedName.collapsible !== false;
            isHidden = parsedName.hidden || false;
            visibilityRule = parsedName.visibilityRule || null;
          }
        } catch (e) {
          // Simple string name
        }

        const secQuestions = questionsRes.rows.filter(q => q.sectionId === sec.id).map(q => {
          // Parse options if stored as string/array
          let opts = q.options;
          if (typeof opts === "string") {
            try { opts = JSON.parse(opts); } catch (e) { opts = []; }
          }
          
          // Parse extra question properties from description JSON if exists
          let qDesc = q.description || "";
          let tooltip = "";
          let placeholder = "";
          let defaultValue = "";
          let readOnly = false;
          let hidden = false;
          let negativeMarks = 0;
          let validationRules = null;
          let lookupConfig = null;

          if (q.description) {
            try {
              const parsedDesc = JSON.parse(q.description);
              if (parsedDesc && typeof parsedDesc === "object") {
                qDesc = parsedDesc.description || "";
                tooltip = parsedDesc.tooltip || "";
                placeholder = parsedDesc.placeholder || "";
                defaultValue = parsedDesc.defaultValue || "";
                readOnly = parsedDesc.readOnly || false;
                hidden = parsedDesc.hidden || false;
                negativeMarks = parsedDesc.negativeMarks || 0;
                validationRules = parsedDesc.validationRules || null;
                lookupConfig = parsedDesc.lookupConfig || null;
              }
            } catch (e) {
              // Standard text
            }
          }

          return {
            ...q,
            options: Array.isArray(opts) ? opts : [],
            description: qDesc,
            tooltip,
            placeholder,
            defaultValue,
            readOnly,
            hidden,
            negativeMarks,
            validationRules,
            lookupConfig
          };
        });

        return {
          ...sec,
          name: secName,
          description: secDesc,
          collapsible: isCollapsible,
          hidden: isHidden,
          visibilityRule,
          questions: secQuestions
        };
      });

      return {
        id: sc.id,
        name: sc.name,
        passingScore: parseFloat(sc.passingScore) || 80.0,
        isActive: sc.isActive,
        lobId: sc.lobId,
        createdAt: sc.createdAt,
        updatedAt: sc.updatedAt,
        ...meta,
        sections
      };
    });

    res.json(scorecards);
  } catch (err: any) {
    console.error("Fetch form-studio scorecards failed:", err);
    res.status(500).json({ error: "Failed to load forms.", details: err.message });
  }
});

// GET /api/form-studio/scorecards/:id
app.get("/api/form-studio/scorecards/:id", async (req, res) => {
  const db = getPool();
  const { id } = req.params;
  try {
    const scorecardRes = await db.query(`
      SELECT id, name, description, lob_id as "lobId", passing_score as "passingScore", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      FROM public.scorecards 
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);

    if (scorecardRes.rows.length === 0) {
      return res.status(404).json({ error: "Form not found." });
    }

    const sc = scorecardRes.rows[0];

    // Fetch sections
    const sectionsRes = await db.query(`
      SELECT id, name, weight, order_index as "orderIndex"
      FROM public.scorecard_sections
      WHERE scorecard_id = $1
      ORDER BY order_index ASC
    `, [sc.id]);

    // Fetch questions
    const questionsRes = await db.query(`
      SELECT q.id, q.section_id as "sectionId", q.question_text as "questionText", q.help_text as "helpText", 
             q.weight, q.question_type as "questionType", q.is_critical as "isCritical", q.order_index as "orderIndex",
             q.options, q.description, q.formula, q.formula_output_type as "formulaOutputType"
      FROM public.scorecard_questions q
      JOIN public.scorecard_sections s ON q.section_id = s.id
      WHERE s.scorecard_id = $1
      ORDER BY q.order_index ASC
    `, [sc.id]);

    // Parse description for JSON metadata
    let meta: any = { description: sc.description || "", version: "1.0", status: sc.isActive ? "published" : "draft", tags: [], client: "", process: "", category: "" };
    if (sc.description) {
      try {
        const parsed = JSON.parse(sc.description);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          meta = {
            description: parsed.description || "",
            version: parsed.version || "1.0",
            status: parsed.status || (sc.isActive ? "published" : "draft"),
            tags: parsed.tags || [],
            client: parsed.client || "",
            process: parsed.process || "",
            category: parsed.category || ""
          };
        }
      } catch (e) {
        // Keep default meta
      }
    }

    const sections = sectionsRes.rows.map(sec => {
      // Parse section name/description if nested
      let secDesc = "";
      let secName = sec.name;
      let isCollapsible = true;
      let isHidden = false;
      let visibilityRule = null;
      try {
        const parsedName = JSON.parse(sec.name);
        if (parsedName && typeof parsedName === "object") {
          secName = parsedName.name || sec.name;
          secDesc = parsedName.description || "";
          isCollapsible = parsedName.collapsible !== false;
          isHidden = parsedName.hidden || false;
          visibilityRule = parsedName.visibilityRule || null;
        }
      } catch (e) {
        // Simple string name
      }

      const secQuestions = questionsRes.rows.filter(q => q.sectionId === sec.id).map(q => {
        let opts = q.options;
        if (typeof opts === "string") {
          try { opts = JSON.parse(opts); } catch (e) { opts = []; }
        }
        
        let qDesc = q.description || "";
        let tooltip = "";
        let placeholder = "";
        let defaultValue = "";
        let readOnly = false;
        let hidden = false;
        let negativeMarks = 0;
        let validationRules = null;
        let lookupConfig = null;

        if (q.description) {
          try {
            const parsedDesc = JSON.parse(q.description);
            if (parsedDesc && typeof parsedDesc === "object") {
              qDesc = parsedDesc.description || "";
              tooltip = parsedDesc.tooltip || "";
              placeholder = parsedDesc.placeholder || "";
              defaultValue = parsedDesc.defaultValue || "";
              readOnly = parsedDesc.readOnly || false;
              hidden = parsedDesc.hidden || false;
              negativeMarks = parsedDesc.negativeMarks || 0;
              validationRules = parsedDesc.validationRules || null;
              lookupConfig = parsedDesc.lookupConfig || null;
            }
          } catch (e) {
            // Standard text
          }
        }

        return {
          ...q,
          options: Array.isArray(opts) ? opts : [],
          description: qDesc,
          tooltip,
          placeholder,
          defaultValue,
          readOnly,
          hidden,
          negativeMarks,
          validationRules,
          lookupConfig
        };
      });

      return {
        ...sec,
        name: secName,
        description: secDesc,
        collapsible: isCollapsible,
        hidden: isHidden,
        visibilityRule,
        questions: secQuestions
      };
    });

    res.json({
      id: sc.id,
      name: sc.name,
      passingScore: parseFloat(sc.passingScore) || 80.0,
      isActive: sc.isActive,
      lobId: sc.lobId,
      createdAt: sc.createdAt,
      updatedAt: sc.updatedAt,
      ...meta,
      sections
    });
  } catch (err: any) {
    console.error("Fetch form-studio single scorecard failed:", err);
    res.status(500).json({ error: "Failed to load form details.", details: err.message });
  }
});

// POST /api/form-studio/scorecards
app.post("/api/form-studio/scorecards", async (req, res) => {
  const db = getPool();
  const { id, name, description, client, lobId, process, category, version, status, tags, passingScore, sections, userId } = req.body;

  if (!name || !userId) {
    return res.status(400).json({ error: "Missing required parameters (name, userId)." });
  }

  const clientDb = await db.connect();
  try {
    await clientDb.query("BEGIN");

    const resolvedUserId = toUUID(userId);
    await ensureUserExists(clientDb, resolvedUserId, "admin@precisionqa.com", "Admin");

    const formId = id || crypto.randomUUID();
    const isActive = status === "published";

    // Serialize advanced metadata into description
    const serializedDescription = JSON.stringify({
      description: description || "",
      client: client || "",
      process: process || "",
      category: category || "",
      version: version || "1.0",
      status: status || "draft",
      tags: tags || []
    });

    const validatedLobId = lobId ? toUUID(lobId) : null;

    // 1. Upsert scorecard
    await clientDb.query(`
      INSERT INTO public.scorecards (id, name, description, lob_id, passing_score, is_active, updated_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name, 
        description = EXCLUDED.description, 
        lob_id = EXCLUDED.lob_id, 
        passing_score = EXCLUDED.passing_score, 
        is_active = EXCLUDED.is_active, 
        updated_at = NOW()
    `, [formId, name, serializedDescription, validatedLobId, passingScore || 80.0, isActive, resolvedUserId]);

    // If updating, delete existing questions & sections to avoid conflicts or leftovers
    if (id) {
      await clientDb.query(`
        DELETE FROM public.scorecard_questions 
        WHERE section_id IN (SELECT id FROM public.scorecard_sections WHERE scorecard_id = $1)
      `, [formId]);

      await clientDb.query(`
        DELETE FROM public.scorecard_sections 
        WHERE scorecard_id = $1
      `, [formId]);
    }

    // 2. Insert sections and questions
    if (sections && Array.isArray(sections)) {
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        const secId = sec.id || crypto.randomUUID();

        // Serialize section extra properties inside name
        const serializedName = JSON.stringify({
          name: sec.name,
          description: sec.description || "",
          collapsible: sec.collapsible !== false,
          hidden: sec.hidden || false,
          visibilityRule: sec.visibilityRule || null
        });

        await clientDb.query(`
          INSERT INTO public.scorecard_sections (id, scorecard_id, name, weight, order_index, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `, [secId, formId, serializedName, sec.weight || 0, i + 1]);

        if (sec.questions && Array.isArray(sec.questions)) {
          for (let j = 0; j < sec.questions.length; j++) {
            const q = sec.questions[j];
            const qId = q.id || crypto.randomUUID();

            // Serialize extra question properties into description JSON
            const serializedQDesc = JSON.stringify({
              description: q.description || "",
              tooltip: q.tooltip || "",
              placeholder: q.placeholder || "",
              defaultValue: q.defaultValue || "",
              readOnly: q.readOnly || false,
              hidden: q.hidden || false,
              negativeMarks: q.negativeMarks || 0,
              validationRules: q.validationRules || null,
              lookupConfig: q.lookupConfig || null
            });

            await clientDb.query(`
              INSERT INTO public.scorecard_questions (
                id, section_id, question_text, help_text, weight, question_type, 
                is_critical, order_index, options, description, formula, formula_output_type, created_at, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            `, [
              qId, secId, q.questionText, q.helpText || "", q.weight || 0, q.questionType || "text",
              q.isCritical || false, j + 1, JSON.stringify(q.options || []), serializedQDesc,
              q.formula || null, q.formulaOutputType || null
            ]);
          }
        }
      }
    }

    await clientDb.query("COMMIT");
    res.json({ success: true, formId });
  } catch (err: any) {
    await clientDb.query("ROLLBACK");
    console.error("Save form-studio scorecard failed:", err);
    res.status(500).json({ error: "Failed to save form.", details: err.message });
  } finally {
    clientDb.release();
  }
});

// POST /api/form-studio/scorecards/:id/clone
app.post("/api/form-studio/scorecards/:id/clone", async (req, res) => {
  const db = getPool();
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing required parameter (userId)." });
  }

  const clientDb = await db.connect();
  try {
    await clientDb.query("BEGIN");

    const resolvedUserId = toUUID(userId);
    
    // Fetch source scorecard
    const scRes = await clientDb.query("SELECT * FROM public.scorecards WHERE id = $1 AND deleted_at IS NULL", [id]);
    if (scRes.rows.length === 0) {
      return res.status(404).json({ error: "Source scorecard not found." });
    }
    const sourceSc = scRes.rows[0];

    // Create cloned scorecard
    const newFormId = crypto.randomUUID();
    let originalName = sourceSc.name;
    let clonedName = originalName.includes(" (Copy)") ? originalName + " Copy" : originalName + " (Copy)";

    // Update the description metadata to change status to draft and update name
    let updatedDesc = sourceSc.description;
    try {
      const parsed = JSON.parse(sourceSc.description);
      if (parsed && typeof parsed === "object") {
        parsed.status = "draft";
        updatedDesc = JSON.stringify(parsed);
      }
    } catch (e) {}

    await clientDb.query(`
      INSERT INTO public.scorecards (id, name, description, lob_id, passing_score, is_active, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, false, $6, NOW(), NOW())
    `, [newFormId, clonedName, updatedDesc, sourceSc.lob_id, sourceSc.passing_score, resolvedUserId]);

    // Fetch and clone sections
    const secRes = await clientDb.query("SELECT * FROM public.scorecard_sections WHERE scorecard_id = $1", [id]);
    for (const sec of secRes.rows) {
      const newSecId = crypto.randomUUID();
      await clientDb.query(`
        INSERT INTO public.scorecard_sections (id, scorecard_id, name, weight, order_index, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [newSecId, newFormId, sec.name, sec.weight, sec.order_index]);

      // Fetch and clone questions
      const qRes = await clientDb.query("SELECT * FROM public.scorecard_questions WHERE section_id = $1", [sec.id]);
      for (const q of qRes.rows) {
        const newQId = crypto.randomUUID();
        await clientDb.query(`
          INSERT INTO public.scorecard_questions (
            id, section_id, question_text, help_text, weight, question_type, 
            is_critical, order_index, options, description, formula, formula_output_type, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        `, [
          newQId, newSecId, q.question_text, q.help_text, q.weight, q.question_type,
          q.is_critical, q.order_index, JSON.stringify(q.options), q.description,
          q.formula, q.formula_output_type
        ]);
      }
    }

    await clientDb.query("COMMIT");
    res.json({ success: true, formId: newFormId });
  } catch (err: any) {
    await clientDb.query("ROLLBACK");
    console.error("Clone form-studio scorecard failed:", err);
    res.status(500).json({ error: "Failed to clone form.", details: err.message });
  } finally {
    clientDb.release();
  }
});

// DELETE /api/form-studio/scorecards/:id
app.delete("/api/form-studio/scorecards/:id", async (req, res) => {
  const db = getPool();
  const { id } = req.params;
  try {
    await db.query(`
      UPDATE public.scorecards 
      SET deleted_at = NOW(), is_active = false
      WHERE id = $1
    `, [toUUID(id)]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete scorecard failed:", err);
    res.status(500).json({ error: "Failed to delete form.", details: err.message });
  }
});

// 2. POST /api/admin/save - Single unified endpoint to update/upsert any admin configuration module
app.post("/api/admin/save", async (req, res) => {
  const db = getPool();
  const { type, payload, userId, userEmail, oldVal, newVal, description } = req.body;

  if (!type || !userId) {
    return res.status(400).json({ error: "Missing required parameters (type, userId)." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const resolvedUserId = toUUID(userId);
    await ensureUserExists(client, resolvedUserId, userEmail, userEmail ? userEmail.split("@")[0] : undefined);

    const action = req.body.action || "save";
    let actionDescription = description || `${action === "delete" ? "Deleted" : "Updated"} administrative setting for ${type}`;
    
    if (action === "delete") {
      const { id } = payload;
      console.log(`[Admin Save] Delete action triggered for type: ${type}, ID: ${id}`);
      
      if (!id && !["processes", "notification_templates", "audit_categories", "dispute_categories", "shifts", "holidays", "attendance_rules", "system_settings"].includes(type)) {
        throw new Error(`Deletion requires a valid ID for type: ${type}`);
      }

      if (type === "client") {
        await client.query("UPDATE public.clients SET deleted_at = NOW(), is_active = false WHERE id = $1", [toUUID(id)]);
        actionDescription = `Soft deleted client: ${id}`;
      } else if (type === "lob") {
        await client.query("UPDATE public.lobs SET deleted_at = NOW(), is_active = false WHERE id = $1", [toUUID(id)]);
        actionDescription = `Soft deleted Line of Business: ${id}`;
      } else if (type === "team") {
        await client.query("UPDATE public.teams SET deleted_at = NOW() WHERE id = $1", [toUUID(id)]);
        actionDescription = `Soft deleted Team: ${id}`;
      } else if (type === "user") {
        await client.query("UPDATE public.users SET deleted_at = NOW(), is_active = false WHERE id = $1", [toUUID(id)]);
        actionDescription = `Soft deleted user profile: ${id}`;
      } else if (type === "scorecards") {
        await client.query("UPDATE public.scorecards SET deleted_at = NOW(), is_active = false WHERE id = $1", [toUUID(id)]);
        actionDescription = `Soft deleted scorecard template: ${id}`;
      } else {
        // Handle deletion from JSONB arrays in settings
        const keyName = `admin_${type}`;
        console.log(`[Admin Save] Deleting from settings array: ${keyName}, ID: ${id}`);
        const settingsRes = await client.query("SELECT value FROM public.settings WHERE key = $1", [keyName]);
        if (settingsRes.rows.length > 0) {
          let items = settingsRes.rows[0].value || [];
          if (Array.isArray(items)) {
            const originalCount = items.length;
            // If deleting by ID (for shifts, holidays etc)
            if (id) {
              items = items.filter((item: any) => (item.id !== id && item.key !== id));
            } 
            
            console.log(`[Admin Save] Array filtered: ${originalCount} -> ${items.length} items`);
            
            await client.query(`
              UPDATE public.settings SET value = $1, updated_at = NOW() WHERE key = $2
            `, [JSON.stringify(items), keyName]);
          }
        }
        actionDescription = `Deleted item from ${type} configuration`;
      }
    } else if (type === "client") {
      const { id, name, description: desc, isActive } = payload;
      const targetId = toUUID(id) || crypto.randomUUID();
      await client.query(`
        INSERT INTO public.clients (id, name, description, is_active, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = EXCLUDED.is_active, updated_at = NOW()
      `, [targetId, name, desc, isActive === undefined ? true : isActive]);
      actionDescription = id ? `Modified client profile: ${name}` : `Created new client: ${name}`;

    } else if (type === "lob") {
      const { id, clientId, name, description: desc, isActive } = payload;
      const targetId = toUUID(id) || crypto.randomUUID();
      await client.query(`
        INSERT INTO public.lobs (id, client_id, name, description, is_active, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET client_id = EXCLUDED.client_id, name = EXCLUDED.name, description = EXCLUDED.description, is_active = EXCLUDED.is_active, updated_at = NOW()
      `, [targetId, toUUID(clientId), name, desc, isActive === undefined ? true : isActive]);
      actionDescription = id ? `Modified Line of Business: ${name}` : `Created new Line of Business: ${name}`;

    } else if (type === "team") {
      const { id, name, description: desc, managerId } = payload;
      const targetId = toUUID(id) || crypto.randomUUID();
      await client.query(`
        INSERT INTO public.teams (id, name, description, manager_id, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, manager_id = EXCLUDED.manager_id, updated_at = NOW()
      `, [targetId, name, desc, toUUID(managerId) || null]);
      actionDescription = id ? `Modified Team settings: ${name}` : `Created new Team: ${name}`;

    } else if (type === "user") {
      const { id, email, fullName, roleId, isActive, avatarUrl, employeeId, team, lob, phone, status } = payload;
      let targetId = toUUID(id);
      const normalizedEmail = email ? email.toLowerCase().trim() : "";
      
      // If email is specified, look up if a user record already exists with this email address (case-insensitive)
      if (normalizedEmail) {
        const existingUserRes = await client.query(
          "SELECT id FROM public.users WHERE LOWER(email) = LOWER($1)",
          [normalizedEmail]
        );
        if (existingUserRes.rows.length > 0) {
          targetId = existingUserRes.rows[0].id;
        }
      }
      
      if (!targetId) {
        targetId = crypto.randomUUID();
      }
      
      // Upsert into users table safely
      await client.query(`
        INSERT INTO public.users (id, email, full_name, role_id, is_active, avatar_url, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET 
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name, 
          role_id = EXCLUDED.role_id, 
          is_active = EXCLUDED.is_active, 
          avatar_url = EXCLUDED.avatar_url, 
          updated_at = NOW()
      `, [targetId, normalizedEmail, fullName, toUUID(roleId) || null, isActive === undefined ? true : isActive, avatarUrl || ""]);

      // Update the user details metadata in public.settings
      const metaRes = await client.query("SELECT value FROM public.settings WHERE key = 'admin_user_metadata'");
      let metaMap = metaRes.rows.length > 0 ? metaRes.rows[0].value : {};
      metaMap[targetId] = {
        employeeId: employeeId || "",
        team: team || "",
        lob: lob || "",
        phone: phone || "",
        status: status || "active",
        employeeCode: payload.employeeCode || "",
        client: payload.client || "",
        process: payload.process || ""
      };
      
      await client.query(`
        INSERT INTO public.settings (key, value, description)
        VALUES ('admin_user_metadata', $1, 'Custom enterprise metadata attributes for users')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [JSON.stringify(metaMap)]);

      actionDescription = id ? `Modified user profile: ${fullName} (${email})` : `Invited and configured new user: ${fullName} (${email})`;

    } else if (type === "role_permissions") {
      const { roleId, permissionIds } = payload;
      await client.query("DELETE FROM public.role_permissions WHERE role_id = $1", [toUUID(roleId)]);
      for (const permId of permissionIds) {
        await client.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ($1, $2)", [toUUID(roleId), toUUID(permId)]);
      }
      actionDescription = `Updated Permission Matrix access map for Role ID: ${roleId}`;

    } else if (type === "custom_roles") {
      // Support adding custom roles directly inside the settings table to avoid auth.users/public.roles breaking
      await client.query(`
        INSERT INTO public.settings (key, value, description)
        VALUES ('admin_custom_roles', $1, 'Custom defined enterprise roles')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [JSON.stringify(payload)]);
      actionDescription = "Updated enterprise custom roles matrix";

    } else {
      // Save directly into the appropriate settings key
      const keyName = `admin_${type}`;
      await client.query(`
        INSERT INTO public.settings (key, value, description)
        VALUES ($1, $2, 'Enterprise settings configuration')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [keyName, JSON.stringify(payload)]);
      actionDescription = `Updated global configuration: ${type}`;
    }

    // Write persistent change log into public.activity_logs
    await client.query(`
      INSERT INTO public.activity_logs (user_id, action_category, description, payload, created_at)
      VALUES ($1, 'admin_configuration', $2, $3, NOW())
    `, [
      resolvedUserId,
      actionDescription,
      JSON.stringify({
        type,
        oldVal: oldVal || null,
        newVal: newVal || payload,
        timestamp: new Date().toISOString()
      })
    ]);

    await client.query("COMMIT");
    res.json({ success: true, message: "Configuration updated and audited successfully." });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Save Admin Config Failed:", err);
    res.status(500).json({ error: "Failed to apply configuration change.", details: err.message });
  } finally {
    client.release();
  }
});

// WORKFLOW AUTOMATION ENGINE ENDPOINTS
app.get("/api/workflows", async (req, res) => {
  const db = getPool();
  try {
    const result = await db.query("SELECT value FROM public.settings WHERE key = 'admin_workflows'");
    if (result.rows.length === 0) {
      return res.json([]);
    }
    res.json(result.rows[0].value || []);
  } catch (err: any) {
    console.error("Fetch Workflows Failed:", err);
    res.status(500).json({ error: "Failed to load workflows.", details: err.message });
  }
});

app.post("/api/workflows/transition", async (req, res) => {
  const db = getPool();
  const { caseId, targetStageId, comments, userId, userEmail } = req.body;

  if (!caseId || !targetStageId || !userId) {
    return res.status(400).json({ error: "Missing required parameters (caseId, targetStageId, userId)." });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // 1. Fetch the active case details
    const caseRes = await client.query(`
      SELECT id, lob_id, agent_id, auditor_id, status, metadata, external_case_id
      FROM public.audit_cases
      WHERE id = $1 AND deleted_at IS NULL
    `, [caseId]);

    if (caseRes.rows.length === 0) {
      throw new Error("Audit case not found.");
    }

    const caseData = caseRes.rows[0];
    const originalMetadata = caseData.metadata || {};
    const currentStatus = caseData.status;

    // 2. Fetch all configured workflows
    const wfRes = await client.query("SELECT value FROM public.settings WHERE key = 'admin_workflows'");
    const workflows = wfRes.rows.length > 0 ? (wfRes.rows[0].value || []) : [];

    // Find the workflow for this LOB / process
    let activeWorkflow = workflows.find((w: any) => w.status === "published" && w.lob === caseData.lob_id);
    if (!activeWorkflow) {
      // Fallback to first published workflow
      activeWorkflow = workflows.find((w: any) => w.status === "published");
    }

    // Default Stages map (Fallback if no active workflow configured)
    const defaultStages = [
      { id: "Imported", name: "Imported", statusMap: "unassigned" },
      { id: "Assigned", name: "Assigned", statusMap: "assigned" },
      { id: "In Progress", name: "In Progress", statusMap: "assigned" },
      { id: "Audit Completed", name: "Audit Completed", statusMap: "audited" },
      { id: "Feedback Shared", name: "Feedback Shared", statusMap: "audited" },
      { id: "Acknowledged", name: "Acknowledged", statusMap: "audited" },
      { id: "Dispute Raised", name: "Dispute Raised", statusMap: "disputed" },
      { id: "Dispute Under Review", name: "Dispute Under Review", statusMap: "disputed" },
      { id: "Supervisor Review", name: "Supervisor Review", statusMap: "disputed" },
      { id: "Approved", name: "Approved", statusMap: "audited" },
      { id: "Rejected", name: "Rejected", statusMap: "audited" },
      { id: "Final Score Locked", name: "Final Score Locked", statusMap: "audited" },
      { id: "Closed", name: "Closed", statusMap: "audited" },
      { id: "Archived", name: "Archived", statusMap: "audited" }
    ];

    let targetStageName = targetStageId;
    let mappedPhysicalStatus = "assigned";

    if (activeWorkflow) {
      const stage = activeWorkflow.stages.find((s: any) => s.id === targetStageId);
      if (stage) {
        targetStageName = stage.name;
        // Map dynamic stage name or type to existing physical status values
        const sNameLower = stage.name.toLowerCase();
        if (sNameLower.includes("import") || sNameLower.includes("unassigned")) {
          mappedPhysicalStatus = "unassigned";
        } else if (sNameLower.includes("assign") || sNameLower.includes("progress")) {
          mappedPhysicalStatus = "assigned";
        } else if (sNameLower.includes("dispute") || sNameLower.includes("review")) {
          mappedPhysicalStatus = "disputed";
        } else {
          mappedPhysicalStatus = "audited";
        }
      }
    } else {
      const defStage = defaultStages.find((s) => s.id === targetStageId);
      if (defStage) {
        targetStageName = defStage.name;
        mappedPhysicalStatus = defStage.statusMap;
      }
    }

    // 3. Update the state transition timeline
    const workflowState = originalMetadata.workflowState || {
      currentStageId: "Imported",
      currentStageName: "Imported",
      history: []
    };

    const previousStageId = workflowState.currentStageId;
    const previousStageName = workflowState.currentStageName;

    // Append history transition
    const transitionRecord = {
      id: crypto.randomUUID(),
      fromStageId: previousStageId,
      fromStageName: previousStageName,
      toStageId: targetStageId,
      toStageName: targetStageName,
      user: userEmail || "System Automation",
      userId: userId,
      date: new Date().toISOString(),
      comments: comments || ""
    };

    workflowState.currentStageId = targetStageId;
    workflowState.currentStageName = targetStageName;
    workflowState.history = [...(workflowState.history || []), transitionRecord];

    const updatedMetadata = {
      ...originalMetadata,
      workflowState
    };

    // 4. Execute transition SQL updates
    await client.query(`
      UPDATE public.audit_cases
      SET status = $1, metadata = $2, updated_at = NOW()
      WHERE id = $3
    `, [mappedPhysicalStatus, JSON.stringify(updatedMetadata), caseId]);

    // 5. Check stage-specific Automation Rules
    if (activeWorkflow) {
      const stageConfig = activeWorkflow.stages.find((s: any) => s.id === targetStageId);
      if (stageConfig && stageConfig.automationRules) {
        for (const rule of stageConfig.automationRules) {
          if (rule.actionType === "lock_audit") {
            await client.query(`
              UPDATE public.audits
              SET status = 'locked', locked_at = NOW(), updated_at = NOW()
              WHERE case_id = $1
            `, [caseId]);
          } else if (rule.actionType === "unlock_audit") {
            await client.query(`
              UPDATE public.audits
              SET status = 'draft', locked_at = NULL, updated_at = NOW()
              WHERE case_id = $1
            `, [caseId]);
          }
        }
      }
    }

    // 6. Generate Event-Driven Notification & Activity Log
    const logDesc = `Transitioned Case ${caseData.external_case_id} from "${previousStageName}" to "${targetStageName}". Comment: ${comments || "None"}`;
    await client.query(`
      INSERT INTO public.activity_logs (user_id, action_category, description, payload, created_at)
      VALUES ($1, 'workflow_transition', $2, $3, NOW())
    `, [
      toUUID(userId),
      logDesc,
      JSON.stringify({
        caseId,
        externalCaseId: caseData.external_case_id,
        previousStageId,
        targetStageId,
        comments,
        timestamp: new Date().toISOString()
      })
    ]);

    // Notify respective actors
    const notifyTitle = `Case ${caseData.external_case_id} state changed`;
    const notifyContent = `The audit case has been moved to state "${targetStageName}" by ${userEmail}.`;

    const usersToNotify = [];
    if (caseData.agent_id) usersToNotify.push(caseData.agent_id);
    if (caseData.auditor_id) usersToNotify.push(caseData.auditor_id);

    for (const actorId of usersToNotify) {
      await client.query(`
        INSERT INTO public.notifications (user_id, title, content, type, is_read, action_url, created_at)
        VALUES ($1, $2, $3, 'workflow_transition', false, $4, NOW())
      `, [actorId, notifyTitle, notifyContent, `/audit-queue`]);
    }

    await client.query("COMMIT");
    res.json({
      success: true,
      message: `Successfully transitioned to ${targetStageName}`,
      workflowState,
      physicalStatus: mappedPhysicalStatus
    });

  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Workflow Transition Failed:", err);
    res.status(500).json({ error: "Workflow state transition failed.", details: err.message });
  } finally {
    client.release();
  }
});

// --- AUTH & PROFILE SYNC ENDPOINTS ---

/**
 * Endpoint to sync the authenticated user profile with the database.
 * This ensures roles and basic details are persisted correctly in public.users.
 */
app.post("/api/auth/sync", async (req, res) => {
  const { userId, email, fullName, role } = req.body;
  const db = getPool();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const resolvedUserId = toUUID(userId);
    await ensureUserExists(client, resolvedUserId, email, fullName, role);
    await client.query("COMMIT");
    res.json({ success: true, message: "Profile synced successfully" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Auth sync failed:", err);
    res.status(500).json({ error: "Failed to sync authentication profile" });
  } finally {
    client.release();
  }
});

/**
 * Fetches the current user profile from the database to ensure the latest role/details are used.
 */
app.get("/api/auth/me/:userId", async (req, res) => {
  const { userId } = req.params;
  const db = getPool();
  try {
    const resolvedUserId = toUUID(userId);
    const result = await db.query(`
      SELECT 
        u.id, 
        u.email, 
        u.full_name as "name", 
        u.role_id as "roleId", 
        u.avatar_url as "avatarUrl", 
        u.is_active as "isActive",
        u.created_at as "createdAt"
      FROM public.users u
      WHERE u.id = $1 AND u.deleted_at IS NULL
    `, [resolvedUserId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const dbUser = result.rows[0];
    
    // Map internal roleId back to UserRole string
    const roleString = getUserRoleFromRoleId(dbUser.roleId);
    
    res.json({
      ...dbUser,
      role: roleString
    });
  } catch (err: any) {
    console.error("Fetch profile failed:", err);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Serve UI assets
async function startServer() {
  await verifyDatabaseSchema();
  if (process.env.NODE_ENV !== "production") {
    // Integrate Vite development server
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    // Production serving of built assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Precision360 Server] Running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
  });
}

startServer();
