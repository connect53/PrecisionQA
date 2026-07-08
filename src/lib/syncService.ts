import { User, QAField, AssignmentRule, ImportProfile } from "../types";
import * as XLSX from "xlsx";

export interface AuditCase {
  id: string;
  caseId: string;
  agentEmail: string;
  agentName?: string;
  auditDate?: string;
  metadata: Record<string, any>;
  batchId: string;
  importedAt: string;
  status: string;
}

export interface ImportBatch {
  id: string;
  batchName: string;
  importedBy: string;
  importedOn: string;
  totalCases: number;
  importStatus: "success" | "failed" | "processing";
  isActive: boolean;
}

export interface ImportHistory {
  id: string;
  batchName: string;
  importedBy: string;
  importedOn: string;
  totalCases: number;
  status: "success" | "failed";
  errorsCount: number;
  details?: string;
}

export interface ValidationError {
  rowNumber: number;
  caseId: string;
  field: string;
  error: string;
  severity: "error" | "warning";
}

// Default columns we require in PrecisionQA
export const DEFAULT_COLUMNS = [
  { key: "caseId", label: "Case ID", required: true, desc: "Unique identifier for the support ticket" },
  { key: "interactionId", label: "Interaction ID", required: true, desc: "Reference ID of the customer call/chat" },
  { key: "agentName", label: "Agent Name", required: true, desc: "Name of the customer support agent" },
  { key: "agentEmail", label: "Agent Email", required: true, desc: "Email address of the agent" },
  { key: "team", label: "Team", required: true, desc: "Operational team designation" },
  { key: "client", label: "Client", required: true, desc: "Client partner company" },
  { key: "lob", label: "LOB", required: true, desc: "Line of Business segment" },
  { key: "auditDate", label: "Audit Date", required: true, desc: "Date of the customer interaction" },
  { key: "recordingUrl", label: "Recording URL", required: true, desc: "Audio or screen recording hosted link" },
  { key: "transcriptUrl", label: "Transcript URL", required: false, desc: "Written transcript of the session (Optional)" },
  { key: "language", label: "Language", required: true, desc: "Spoken or written interaction language" },
  { key: "metadata", label: "Metadata", required: false, desc: "Custom JSON attributes string (Optional)" }
];

// Helper to check valid URLs
const isValidUrl = (urlStr: string): boolean => {
  if (!urlStr) return false;
  const trimmed = urlStr.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
};

// Key LocalStorage keys
const STORAGE_KEYS = {
  CASES: "precisionqa_audit_cases",
  BATCHES: "precisionqa_import_batches",
  HISTORY: "precisionqa_import_history"
};

export const syncService = {
  // Retrieve active audit cases from Supabase (with localStorage fallback)
  async getAuditCases(): Promise<AuditCase[]> {
    try {
      const response = await fetch("/api/cases");
      if (!response.ok) throw new Error("Failed to fetch cases");
      const cases = await response.json();
      // Sync with localStorage for offline/cache fallback
      localStorage.setItem(STORAGE_KEYS.CASES, JSON.stringify(cases));
      return cases;
    } catch (err) {
      console.warn("Supabase fetch failed, falling back to local:", err);
      const data = localStorage.getItem(STORAGE_KEYS.CASES);
      if (!data) return [];
      try {
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
  },

  // Retrieve import batches from localStorage
  getBatches(): ImportBatch[] {
    const data = localStorage.getItem(STORAGE_KEYS.BATCHES);
    if (!data) {
      // Preseed a default active batch for realistic UI representation on fresh load
      const defaultBatch: ImportBatch = {
        id: "batch-preseed-01",
        batchName: "Initial Workspace Ingest",
        importedBy: "Sarah Jenkins",
        importedOn: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        totalCases: 48,
        importStatus: "success",
        isActive: true
      };
      localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify([defaultBatch]));
      return [defaultBatch];
    }
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  // Retrieve import history from localStorage
  getHistory(): ImportHistory[] {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!data) {
      const defaultHist: ImportHistory = {
        id: "hist-01",
        batchName: "Initial Workspace Ingest",
        importedBy: "Sarah Jenkins",
        importedOn: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        totalCases: 48,
        status: "success",
        errorsCount: 0
      };
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([defaultHist]));
      return [defaultHist];
    }
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  // Extract Google Sheet ID from URL or return the raw string if it looks like an ID
  parseGoogleSheetId(input: string): { sheetId: string | null; gid: string | null; error: string | null } {
    const trimmed = input.trim();
    if (!trimmed) {
      return { sheetId: null, gid: null, error: "Please enter a Google Sheet URL or spreadsheet ID." };
    }

    // Try to extract gid (tab ID) from URL if present
    let gid: string | null = null;
    const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
    if (gidMatch && gidMatch[1]) {
      gid = gidMatch[1];
    }

    // Check if it's a direct Google Sheet URL
    if (trimmed.includes("docs.google.com/spreadsheets")) {
      const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        return { sheetId: match[1], gid, error: null };
      }
      return { sheetId: null, gid: null, error: "Invalid Google Sheets URL format. Could not locate spreadsheet ID." };
    }

    // Check if it is a standard spreadsheet ID format
    if (/^[a-zA-Z0-9-_]{15,100}$/.test(trimmed)) {
      return { sheetId: trimmed, gid, error: null };
    }

    return { sheetId: null, gid: null, error: "Invalid format. Enter a valid Google Sheet URL or dynamic spreadsheet ID." };
  },

  // Read a local file (Excel or CSV) and extract headers and rows
  async readFile(file: File): Promise<{ headers: string[]; rows: any[][] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (jsonData.length === 0) {
            return resolve({ headers: [], rows: [] });
          }
          
          const headers = jsonData[0].map(h => String(h || "").trim());
          const rows = jsonData.slice(1);
          resolve({ headers, rows });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  // Perform validation on the raw rows using dynamic mapping
  validateUniversalRows(
    rows: any[][],
    headers: string[],
    mandatoryMapping: Record<string, string>,
    optionalMapping: Record<string, { mode: "ignore" | "metadata" | "assignment", target?: string }>,
    existingCases: { caseId: string }[]
  ): {
    validatedCases: any[];
    errors: ValidationError[];
    summary: {
      totalRows: number;
      validCount: number;
      invalidCount: number;
      duplicateCount: number;
    };
  } {
    const validatedCases: any[] = [];
    const errors: ValidationError[] = [];
    const seenCaseIdsInSheet = new Map<string, number>();
    const existingCaseIds = new Set(existingCases.map(c => c.caseId));

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const getRawValue = (headerName: string): any => {
        const headerIdx = headers.indexOf(headerName);
        if (headerIdx === -1) return undefined;
        return row[headerIdx];
      };

      const caseId = String(getRawValue(mandatoryMapping["caseId"]) || "").trim();
      const agentEmail = String(getRawValue(mandatoryMapping["agentEmail"]) || "").trim();
      const agentNameRaw = getRawValue(mandatoryMapping["agentName"]);
      const auditDateRaw = getRawValue(mandatoryMapping["auditDate"]);

      let hasRowErrors = false;

      // Mandatory validation
      if (!caseId) {
        errors.push({
          rowNumber: rowNum,
          caseId: `Row-${rowNum}`,
          field: "Case ID",
          error: "Case ID is mandatory.",
          severity: "error"
        });
        hasRowErrors = true;
      }

      if (!agentEmail) {
        errors.push({
          rowNumber: rowNum,
          caseId: caseId || `Row-${rowNum}`,
          field: "Agent Email",
          error: "Agent Email is mandatory.",
          severity: "error"
        });
        hasRowErrors = true;
      }

      // Duplicate check
      if (caseId) {
        if (seenCaseIdsInSheet.has(caseId)) {
          errors.push({
            rowNumber: rowNum,
            caseId,
            field: "Case ID",
            error: `Duplicate Case ID in sheet (previous Row ${seenCaseIdsInSheet.get(caseId)})`,
            severity: "error"
          });
          hasRowErrors = true;
        } else {
          seenCaseIdsInSheet.set(caseId, rowNum);
        }

        if (existingCaseIds.has(caseId)) {
          errors.push({
            rowNumber: rowNum,
            caseId,
            field: "Case ID",
            error: "Case ID already exists in database.",
            severity: "warning"
          });
        }
      }

      if (!hasRowErrors) {
        const metadata: Record<string, any> = {};
        
        // Collect optional fields as metadata or for assignment
        Object.entries(optionalMapping).forEach(([header, config]) => {
          if (config.mode === "metadata" || config.mode === "assignment") {
            metadata[header] = getRawValue(header);
          }
        });

        // Store unmapped headers as generic metadata if they weren't explicitly ignored
        headers.forEach(h => {
          const isMandatory = Object.values(mandatoryMapping).includes(h);
          const isOptionalMapped = optionalMapping[h] !== undefined;
          if (!isMandatory && !isOptionalMapped) {
            metadata[h] = getRawValue(h);
          }
        });

        let parsedDate: string | undefined = undefined;
        if (auditDateRaw) {
          const d = new Date(auditDateRaw);
          if (!isNaN(d.getTime())) {
            parsedDate = d.toISOString();
          }
        }

        validatedCases.push({
          caseId,
          agentEmail,
          agentName: agentNameRaw ? String(agentNameRaw).trim() : undefined,
          auditDate: parsedDate,
          metadata
        });
      }
    });

    const totalRows = rows.length;
    const invalidCount = Array.from(new Set(errors.filter(e => e.severity === "error").map(e => e.rowNumber))).length;
    const validCount = validatedCases.length;

    return {
      validatedCases,
      errors,
      summary: {
        totalRows,
        validCount,
        invalidCount,
        duplicateCount: totalRows - validCount - invalidCount
      }
    };
  },

  // Perform the final ingestion
  async performUniversalImport(
    cases: any[],
    batchName: string,
    qaFormConfig: QAField[],
    mandatoryMapping: Record<string, string>,
    optionalMapping: Record<string, any>,
    currentUser: User,
    onProgress: (p: number) => void
  ): Promise<any> {
    onProgress(10);
    const response = await fetch("/api/universal-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cases,
        batchName,
        qaFormConfig,
        mandatoryMapping,
        optionalMapping,
        userId: currentUser.id,
        userEmail: currentUser.email
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Import failed");
    }

    onProgress(100);
    return response.json();
  },

  // Assignment Logic
  async executeAssignment(
    batchId: string,
    rule: AssignmentRule,
    userId: string
  ): Promise<any> {
    const response = await fetch("/api/universal-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId, rule, userId })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Assignment failed");
    }

    return response.json();
  },

  // Profiles
  async saveProfile(profile: Omit<ImportProfile, "id" | "createdAt">): Promise<ImportProfile> {
    const response = await fetch("/api/import-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
    return response.json();
  },

  async getProfiles(): Promise<ImportProfile[]> {
    const response = await fetch("/api/import-profiles");
    return response.json();
  },

  // Process the full import in asynchronous batched chunks to support 10,000+ rows smoothly
  async performImport(
    casesToImport: Omit<AuditCase, "id" | "batchId" | "importedAt">[],
    batchName: string,
    currentUser: User,
    onProgress: (percent: number) => void
  ): Promise<{ success: boolean; batchId: string; importedCount: number; summary?: any }> {
    onProgress(10); // Starting connection
    
    try {
      // 1. Call the backend API for a robust, transactional Supabase ingest
      const response = await fetch("/api/import-cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cases: casesToImport,
          batchName,
          userId: currentUser.id,
          userEmail: currentUser.email
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const result = await response.json();
      
      onProgress(100);

      // We still update local batches and history for instant UI feedback without a full refresh
      const batches = this.getBatches();
      const newBatch: ImportBatch = {
        id: result.batchId,
        batchName: batchName || `Sync: ${new Date().toLocaleDateString()}`,
        importedBy: currentUser.name,
        importedOn: new Date().toISOString(),
        totalCases: result.summary.imported,
        importStatus: "success",
        isActive: true
      };
      
      // Mark others as inactive
      batches.forEach(b => b.isActive = false);
      batches.push(newBatch);
      localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(batches));

      const history = this.getHistory();
      history.unshift({
        id: "hist-" + Math.random().toString(36).substring(2),
        batchName: newBatch.batchName,
        importedBy: currentUser.name,
        importedOn: new Date().toISOString(),
        totalCases: result.summary.total,
        status: "success",
        errorsCount: result.summary.failed,
        details: `Imported ${result.summary.imported} rows. Skipped ${result.summary.skipped} (duplicates/errors).`
      });
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));

      return { 
        success: true, 
        batchId: result.batchId, 
        importedCount: result.summary.imported,
        summary: result.summary
      };
    } catch (err: any) {
      console.error("Supabase Ingest Error:", err);
      
      const history = this.getHistory();
      history.unshift({
        id: "hist-failed-" + Math.random().toString(36).substring(2),
        batchName: batchName,
        importedBy: currentUser.name,
        importedOn: new Date().toISOString(),
        totalCases: 0,
        status: "failed",
        errorsCount: 1,
        details: `Import Failed: ${err.message}`
      });
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
      
      throw err;
    }
  },

  // High-performance mock data generator for 10,000+ rows
  generateLargeMockData(count: number): { headers: string[]; rows: any[][] } {
    const headers = [
      "Case ID", "Interaction ID", "Agent Name", "Agent Email", 
      "Team", "Client", "LOB", "Audit Date", 
      "Recording URL", "Transcript URL", "Language", "Custom Metadata"
    ];

    const firstNames = ["Daniel", "Elena", "Marcus", "Sophia", "Alex", "Sarah", "Johnathan", "Emma", "Liam", "Olivia"];
    const lastNames = ["Kim", "Rostova", "Chen", "Martinez", "Rivera", "Jenkins", "Vanguard", "Smith", "Johnson", "Davis"];
    const teams = ["Tier 1 Support Team A", "Fintech Escalations", "VIP Elite Support", "Billing & Account Care"];
    const clients = ["E-Commerce Global", "Stripe Fintech LOB", "Vanguard Wealth Management", "HealthPlus Care"];
    const lobs = ["Customer Support", "Fintech Operations", "Billing & Claims", "Premium Care"];
    const languages = ["English", "Spanish", "French", "German"];

    const rows: any[][] = [];

    for (let i = 0; i < count; i++) {
      const caseNum = 100000 + i;
      const caseId = `CS-Q3-${caseNum}`;
      const interactionId = `INT-99-${Math.floor(200000 + Math.random() * 800000)}`;
      
      const agentF = firstNames[i % firstNames.length];
      const agentL = lastNames[Math.floor(Math.random() * lastNames.length)];
      const agentName = `${agentF} ${agentL}`;
      const agentEmail = `${agentF.toLowerCase()}.${agentL.toLowerCase()}@precisionqa.com`;
      
      const team = teams[i % teams.length];
      const client = clients[i % clients.length];
      const lob = lobs[Math.floor(Math.random() * lobs.length)];
      
      // Distribute dates over last 30 days
      const dateOffset = Math.floor(Math.random() * 30);
      const interactionDate = new Date(Date.now() - dateOffset * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      
      const recordingUrl = `https://recordings.precisionqa.com/audio/call-${interactionId}.mp3`;
      const transcriptUrl = i % 3 === 0 ? `https://recordings.precisionqa.com/transcripts/txt-${interactionId}.txt` : "";
      const language = languages[i % languages.length];
      const customMetadata = `{"region":"US-East","priority":"high","index":${i}}`;

      rows.push([
        caseId,
        interactionId,
        agentName,
        agentEmail,
        team,
        client,
        lob,
        interactionDate,
        recordingUrl,
        transcriptUrl,
        language,
        customMetadata
      ]);
    }

    return { headers, rows };
  }
};
