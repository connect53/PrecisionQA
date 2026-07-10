// PrecisionQA Transparent Client-Side API Proxy / Database Engine Fallback
// Provides a fully-featured, crash-free, persistent administrative database mock
// when running as a client-side SPA (like Netlify) without an active container backend.

import { UserRole } from "../types";

// Setup storage keys
const STORAGE_KEYS = {
  CLIENTS: "precisionqa_clients",
  LOBS: "precisionqa_lobs",
  TEAMS: "precisionqa_teams",
  USERS: "precisionqa_simulated_users",
  ROLES: "precisionqa_roles",
  PERMISSIONS: "precisionqa_permissions",
  ROLE_PERMISSIONS: "precisionqa_role_permissions",
  SETTINGS: "precisionqa_settings",
  SCORECARDS: "precisionqa_scorecards",
  CASES: "precisionqa_audit_cases",
  BATCHES: "precisionqa_import_batches",
  AUDITS: "precisionqa_audits",
  DISPUTES: "precisionqa_disputes",
  DISPUTE_COMMENTS: "precisionqa_dispute_comments",
  NOTIFICATIONS: "precisionqa_notifications",
  ACTIVITY_LOGS: "precisionqa_activity_logs",
  IMPORT_PROFILES: "precisionqa_import_profiles"
};

// ----------------------------------------------------------------------------
// ENTERPRISE SEED DATA (To match PostgreSQL definitions exactly)
// ----------------------------------------------------------------------------
const SEED_ROLES = [
  { id: "role-superadmin", name: "Super Admin", description: "Highest clearance administrative account with full system controls." },
  { id: "role-admin", name: "Admin", description: "Local tenant administrative account with configuration rights." },
  { id: "role-qamanager", name: "QA Manager", description: "Quality Assurance management of workflows, scorecards and assignments." },
  { id: "role-qaauditor", name: "QA Auditor", description: "Quality Assurance grading, dispute reviews and calibration." },
  { id: "role-supervisor", name: "Supervisor", description: "Operations supervisor with oversight over agent performance." },
  { id: "role-agent", name: "Agent", description: "Front-line support representative subject to auditing." },
  { id: "role-client", name: "Client", description: "External client representative with limited dashboard views." }
];

const SEED_PERMISSIONS = [
  { id: "perm-canimportcases", name: "Can Import Cases", description: "Permission to run manual Google Sheets and API imports." },
  { id: "perm-canassign", name: "Can Assign", description: "Permission to configure, trigger or override QA auto-assignments." },
  { id: "perm-canaudit", name: "Can Audit", description: "Permission to perform active agent call/chat/email auditing." },
  { id: "perm-canmodifyscores", name: "Can Modify Scores", description: "Permission to edit, recalibrate or override locked scores." },
  { id: "perm-canviewreports", name: "Can View Reports", description: "Permission to view operational reports and dashboards." },
  { id: "perm-canmanageusers", name: "Can Manage Users", description: "Permission to invite, edit and deactivate platform users." },
  { id: "perm-canconfigurescorecards", name: "Can Configure Scorecards", description: "Permission to build and manage dynamic scorecard templates." },
  { id: "perm-canclosedisputes", name: "Can Close Disputes", description: "Permission to arbitrate, approve or reject agent disputes." }
];

const SEED_ROLE_PERMISSIONS: { roleId: string; permissionId: string }[] = [];

// Populate role-permissions mapping
SEED_ROLES.forEach(r => {
  const rId = r.id;
  const rName = r.name.toLowerCase();

  SEED_PERMISSIONS.forEach(p => {
    const pId = p.id;
    const pName = p.name.toLowerCase();

    let link = false;
    if (rName === "super admin" || rName === "admin" || rName === "qa manager") {
      link = true;
    } else if (rName === "qa auditor") {
      link = pName.includes("audit") || pName.includes("view reports") || pName.includes("disputes");
    } else if (rName === "supervisor") {
      link = pName.includes("view reports") || pName.includes("audit") || pName.includes("manage users");
    } else if (rName === "agent") {
      link = pName.includes("view reports");
    } else if (rName === "client") {
      link = pName.includes("view reports");
    }

    if (link) {
      SEED_ROLE_PERMISSIONS.push({ roleId: rId, permissionId: pId });
    }
  });
});

const SEED_CLIENTS = [
  { id: "client-01", name: "Standard Retail Partner", description: "Enterprise logistics and retail client account", isActive: true },
  { id: "client-02", name: "Aegis Healthcare Corp", description: "HIPAA compliant medical and billing client operations", isActive: true },
  { id: "client-03", name: "Apex Financial Services", description: "High security card services and banking client support", isActive: true }
];

const SEED_LOBS = [
  { id: "lob-01", clientId: "client-01", name: "Customer Experience", description: "Inbound tier 1 support and ticket resolutions", isActive: true },
  { id: "lob-02", clientId: "client-01", name: "VIP Customer Solutions", description: "Dedicated VIP escalations and loyalty management", isActive: true },
  { id: "lob-03", clientId: "client-02", name: "Medical Claims Ingest", description: "Healthcare claims auditing and regulatory compliance", isActive: true },
  { id: "lob-04", clientId: "client-03", name: "Fraud Investigations", description: "Transactional verification and fraud resolution", isActive: true }
];

const SEED_TEAMS = [
  { id: "team-01", name: "Tier 1 Support Team A", description: "Inbound customer support agents group A", managerId: "demo-supervisor-uuid" },
  { id: "team-02", name: "VIP Retention Squad", description: "High performance retention agents", managerId: "demo-supervisor-uuid" },
  { id: "team-03", name: "Medical Claims Unit 4", description: "Dedicated medical claims specialists", managerId: "demo-supervisor-uuid" }
];

const SEED_USERS = [
  {
    id: "demo-superadmin-uuid",
    email: "superadmin@precisionqa.com",
    name: "Alex Rivera",
    role: "super_admin" as UserRole,
    employeeId: "EMP-001",
    team: "Executive Command",
    lob: "Global Platform",
    status: "active" as const,
    lastLogin: new Date().toISOString(),
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80"
  },
  {
    id: "demo-manager-uuid",
    email: "manager@precisionqa.com",
    name: "Sarah Jenkins",
    role: "qa_manager" as UserRole,
    employeeId: "EMP-002",
    team: "Quality Control",
    lob: "Operations Oversight",
    status: "active" as const,
    lastLogin: new Date().toISOString(),
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Sarah%20Jenkins"
  },
  {
    id: "demo-auditor-uuid",
    email: "auditor@precisionqa.com",
    name: "Marcus Aurelius",
    role: "qa_auditor" as UserRole,
    employeeId: "EMP-003",
    team: "Quality Control",
    lob: "Audit Operations",
    status: "active" as const,
    lastLogin: new Date().toISOString(),
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Marcus%20Aurelius"
  },
  {
    id: "demo-supervisor-uuid",
    email: "supervisor@precisionqa.com",
    name: "Diana Prince",
    role: "team_leader" as UserRole,
    employeeId: "EMP-004",
    team: "Tier 1 Support Team A",
    lob: "Customer Experience",
    status: "active" as const,
    lastLogin: new Date().toISOString(),
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Diana%20Prince"
  },
  {
    id: "demo-agent-uuid",
    email: "agent@precisionqa.com",
    name: "Arthur Dent",
    role: "agent" as UserRole,
    employeeId: "EMP-005",
    team: "Tier 1 Support Team A",
    lob: "Customer Experience",
    status: "active" as const,
    lastLogin: new Date().toISOString(),
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Arthur%20Dent"
  },
  {
    id: "demo-agent2-uuid",
    email: "john.doe@precisionqa.com",
    name: "John Doe",
    role: "agent" as UserRole,
    employeeId: "EMP-006",
    team: "Tier 1 Support Team A",
    lob: "Customer Experience",
    status: "active" as const,
    lastLogin: new Date().toISOString(),
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=John%20Doe"
  },
  {
    id: "demo-agent3-uuid",
    email: "jane.smith@precisionqa.com",
    name: "Jane Smith",
    role: "agent" as UserRole,
    employeeId: "EMP-007",
    team: "Tier 1 Support Team A",
    lob: "Customer Experience",
    status: "active" as const,
    lastLogin: new Date().toISOString(),
    avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Jane%20Smith"
  }
];

const SEED_SCORECARDS = [
  {
    id: "sc-retail-voice",
    name: "Retail Voice Support Standard V2",
    description: "Quality guidelines for phone call interactions for Standard Retail partner",
    lobId: "lob-01",
    passingScore: 85,
    isActive: true,
    sections: [
      {
        id: "sec-opening",
        name: "Opening & Greeting",
        weight: 15,
        questions: [
          { id: "q1", question: "Used professional brand greeting?", desc: "Must state company name and auditor name clearly", maxPoints: 10, isFatal: false, isNNA: false },
          { id: "q2", question: "Verified customer identity?", desc: "Verified Name & Account or Order Number", maxPoints: 5, isFatal: false, isNNA: false }
        ]
      },
      {
        id: "sec-skills",
        name: "Soft Skills & Communication",
        weight: 35,
        questions: [
          { id: "q3", question: "Demonstrated active listening & empathy?", desc: "Acknowledged caller frustration appropriately", maxPoints: 15, isFatal: false, isNNA: false },
          { id: "q4", question: "Tone, speed and clarity of speech were appropriate?", desc: "Professional, polite, easily understood", maxPoints: 10, isFatal: false, isNNA: false },
          { id: "q5", question: "Used appropriate hold/transfer protocols?", desc: "Asked permission, set expectation, thanked for holding", maxPoints: 10, isFatal: false, isNNA: true }
        ]
      },
      {
        id: "sec-technical",
        name: "Technical Accuracy & Resolution",
        weight: 40,
        questions: [
          { id: "q6", question: "Correct troubleshooting and policy compliance?", desc: "Provided correct policy directives", maxPoints: 20, isFatal: true, isNNA: false },
          { id: "q7", question: "Identified correct root cause & resolved issue?", desc: "Addressed primary customer requirement fully", maxPoints: 20, isFatal: false, isNNA: false }
        ]
      },
      {
        id: "sec-closing",
        name: "Closing Quality",
        weight: 10,
        questions: [
          { id: "q8", question: "Offered additional assistance and closed professionally?", desc: "Warm thank you and call-to-action closing", maxPoints: 10, isFatal: false, isNNA: false }
        ]
      }
    ]
  }
];

const SEED_SETTINGS: Record<string, any> = {
  admin_dispute_categories: [
    { id: "wrong_score", name: "Wrong Score", desc: "The score was applied incorrectly based on standard guidelines." },
    { id: "recording_issue", name: "Recording Issue", desc: "Incomplete audio or transcript data was provided during audit." },
    { id: "policy_change", name: "Policy Change", desc: "A recent policy amendment makes the current guideline obsolete." },
    { id: "insufficient_evidence", name: "Insufficient Evidence", desc: "The auditor did not provide concrete proof/notes for the deduction." },
    { id: "others", name: "Others", desc: "General dispute category for other edge cases." }
  ],
  admin_audit_categories: [
    { id: "voice", name: "Voice", desc: "Standard inbound/outbound telephonic voice interaction." },
    { id: "chat", name: "Chat", desc: "Live-chat or synchronous web-chat support." },
    { id: "email", name: "Email", desc: "Asynchronous email-based ticketing workflow." },
    { id: "compliance", name: "Compliance", desc: "Strict adherence to regulatory policy checks." }
  ],
  admin_processes: [
    { id: "voice_support", name: "Inbound Voice Support", code: "PR-VOICE", desc: "Inbound voice interactions" },
    { id: "chat_support", name: "Live Chat Support", code: "PR-CHAT", desc: "Real-time web chat support" },
    { id: "email_support", name: "Email Ticketing Support", code: "PR-EMAIL", desc: "Back office email ticketing" }
  ],
  admin_shifts: [
    { id: "shift_day", name: "Morning Day Shift", startTime: "08:00", endTime: "17:00", breakDuration: "60m", weeklyOff: ["Sunday"], timezone: "UTC" },
    { id: "shift_afternoon", name: "Afternoon Shift", startTime: "14:00", endTime: "23:00", breakDuration: "60m", weeklyOff: ["Sunday"], timezone: "UTC" }
  ],
  admin_attendance_rules: {
    minWorkingHours: "8.0",
    lateMarkThreshold: "15",
    halfDayThreshold: "4.0",
    absentThreshold: "3.0",
    autoCloseSessions: true,
    supervisorModification: true,
    manualOverride: true
  },
  admin_holidays: [
    { id: "holiday_newyear", name: "New Year's Day", date: "2026-01-01", type: "regional", isOptional: false },
    { id: "holiday_labor", name: "Labor Day", date: "2026-05-01", type: "regional", isOptional: false }
  ],
  admin_notification_templates: [
    { id: "assignment", subject: "New QA Case Assigned: {caseId}", body: "Hello {userName},\n\nYou have been assigned a new QA auditing case: {caseId}.", variables: ["caseId", "userName"] },
    { id: "feedback", subject: "QA Audit Feedback Released: Case #{caseId}", body: "Hello {userName},\n\nYour interaction has been audited. Score: {score}%.", variables: ["caseId", "userName", "score"] }
  ],
  admin_system_settings: {
    companyName: "PrecisionQA Enterprise LOB",
    logo: "",
    theme: "light",
    timezone: "America/New_York",
    dateFormat: "YYYY-MM-DD"
  }
};

// ----------------------------------------------------------------------------
// INITIALIZATION AND SYNC
// ----------------------------------------------------------------------------
const seedLocalStorageIfEmpty = () => {
  const checkAndSeed = (key: string, data: any) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  };

  checkAndSeed(STORAGE_KEYS.CLIENTS, SEED_CLIENTS);
  checkAndSeed(STORAGE_KEYS.LOBS, SEED_LOBS);
  checkAndSeed(STORAGE_KEYS.TEAMS, SEED_TEAMS);
  checkAndSeed(STORAGE_KEYS.USERS, SEED_USERS);
  checkAndSeed(STORAGE_KEYS.ROLES, SEED_ROLES);
  checkAndSeed(STORAGE_KEYS.PERMISSIONS, SEED_PERMISSIONS);
  checkAndSeed(STORAGE_KEYS.ROLE_PERMISSIONS, SEED_ROLE_PERMISSIONS);
  checkAndSeed(STORAGE_KEYS.SCORECARDS, SEED_SCORECARDS);
  checkAndSeed(STORAGE_KEYS.BATCHES, []);
  checkAndSeed(STORAGE_KEYS.AUDITS, []);
  checkAndSeed(STORAGE_KEYS.DISPUTES, []);
  checkAndSeed(STORAGE_KEYS.NOTIFICATIONS, []);
  checkAndSeed(STORAGE_KEYS.ACTIVITY_LOGS, []);
  checkAndSeed(STORAGE_KEYS.IMPORT_PROFILES, []);

  // Sync settings
  Object.entries(SEED_SETTINGS).forEach(([k, val]) => {
    if (!localStorage.getItem(`setting_${k}`)) {
      localStorage.setItem(`setting_${k}`, JSON.stringify(val));
    }
  });
};

// ----------------------------------------------------------------------------
// TRANSPARENT FETCH INTERCEPTOR (THE ENGINE PROXY)
// ----------------------------------------------------------------------------
export let isProxyInitialized = false;
let isStaticMode = false; // Detected if the real backend server is not alive (HTML returned)

export function initializeApiProxy() {
  if (isProxyInitialized) return;
  isProxyInitialized = true;

  // Make sure localStorage is preloaded
  seedLocalStorageIfEmpty();

  const originalFetch = window.fetch;

  const proxiedFetch = async function (this: any, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === "string" ? input : (input as any).url || input.toString();

    // Only intercept local relative API routes matching "/api/"
    if (!urlStr.includes("/api/")) {
      return originalFetch.apply(this, [input, init]);
    }

    // Ping /api/health once dynamically if we haven't determined mode yet
    if (!isStaticMode && urlStr.includes("/api/health")) {
      try {
        const pingRes = await originalFetch.apply(this, [input, init]);
        if (pingRes.ok) {
          const contentType = pingRes.headers.get("content-type") || "";
          if (contentType.includes("html") || (await pingRes.clone().text()).startsWith("<!")) {
            isStaticMode = true; // Netlify fallback served index.html
          } else {
            return pingRes; // Active full-stack server
          }
        } else {
          isStaticMode = true;
        }
      } catch {
        isStaticMode = true;
      }
    }

    // Check if we are operating in client-only SPA mode (like Netlify)
    // Or if we specifically hit a route that is known to return index.html
    if (isStaticMode) {
      try {
        const mockResponse = await handleMockApi(urlStr, init);
        return mockResponse;
      } catch (err: any) {
        console.error("[API Proxy Error]", err);
        return new Response(JSON.stringify({ success: false, error: err.message || err }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Default: Run actual real container backend query, but handle accidental 200 HTML redirects gracefully
    try {
      const realRes = await originalFetch.apply(this, [input, init]);
      if (realRes.ok) {
        const cloned = realRes.clone();
        const text = await cloned.text();
        if (text.startsWith("<!doctype") || text.startsWith("<!DOCTYPE") || text.includes("<html")) {
          // Uh oh, the backend returned the main HTML file because of a 404 router fallback!
          // Fall back gracefully to mock API handler so the user's view doesn't crash!
          console.warn(`[API Proxy Fallback] Redirected endpoint ${urlStr} returned HTML. Executing client-side mock backend.`);
          return await handleMockApi(urlStr, init);
        }
      }
      return realRes;
    } catch (fetchErr) {
      // Offline or network fail, handle locally!
      console.warn(`[API Proxy Fallback] Network failed on ${urlStr}. Operating in local offline cache mode.`, fetchErr);
      return await handleMockApi(urlStr, init);
    }
  };

  try {
    Object.defineProperty(window, "fetch", {
      value: proxiedFetch,
      configurable: true,
      writable: true,
      enumerable: true
    });
  } catch (err) {
    console.warn("[API Proxy] Could not define fetch via Object.defineProperty, falling back to direct assignment", err);
    try {
      window.fetch = proxiedFetch;
    } catch (err2) {
      console.error("[API Proxy] Failed to set window.fetch completely:", err2);
    }
  }

  console.log("🚀 [PrecisionQA API Proxy] Client-side administrative database interceptor successfully registered.");
}

// ----------------------------------------------------------------------------
// SIMULATED ENDPOINT HANDLERS
// ----------------------------------------------------------------------------
async function handleMockApi(url: string, init?: RequestInit): Promise<Response> {
  const method = init?.method?.toUpperCase() || "GET";
  const body = init?.body ? JSON.parse(init.body as string) : null;
  const path = url.split("?")[0].replace(/^(https?:\/\/[^\/]+)?/, "");

  const getCollection = (key: string): any[] => JSON.parse(localStorage.getItem(key) || "[]");
  const saveCollection = (key: string, data: any[]) => localStorage.setItem(key, JSON.stringify(data));

  const respondJSON = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  };

  // 1. GET /api/admin/config
  if (path === "/api/admin/config" && method === "GET") {
    const clients = getCollection(STORAGE_KEYS.CLIENTS);
    const lobs = getCollection(STORAGE_KEYS.LOBS);
    const teams = getCollection(STORAGE_KEYS.TEAMS);
    const users = getCollection(STORAGE_KEYS.USERS);
    const roles = getCollection(STORAGE_KEYS.ROLES);
    const permissions = getCollection(STORAGE_KEYS.PERMISSIONS);
    const rolePermissions = getCollection(STORAGE_KEYS.ROLE_PERMISSIONS);
    const scorecards = getCollection(STORAGE_KEYS.SCORECARDS);
    const activityLogs = getCollection(STORAGE_KEYS.ACTIVITY_LOGS);

    const loadSetting = (k: string) => JSON.parse(localStorage.getItem(`setting_${k}`) || "null");

    return respondJSON({
      success: true,
      clients,
      lobs,
      teams,
      users,
      roles,
      permissions,
      rolePermissions,
      scorecards,
      processes: loadSetting("admin_processes") || [],
      shifts: loadSetting("admin_shifts") || [],
      attendanceRules: loadSetting("admin_attendance_rules") || {},
      holidays: loadSetting("admin_holidays") || [],
      disputeCategories: loadSetting("admin_dispute_categories") || [],
      auditCategories: loadSetting("admin_audit_categories") || [],
      notificationTemplates: loadSetting("admin_notification_templates") || [],
      systemSettings: loadSetting("admin_system_settings") || {},
      activityLogs: activityLogs.slice(0, 100)
    });
  }

  // 2. POST /api/admin/save
  if (path === "/api/admin/save" && method === "POST") {
    const { type, payload, userId, userEmail, action } = body || {};
    if (!type) throw new Error("Missing setting type.");

    const logActivity = (desc: string) => {
      const logs = getCollection(STORAGE_KEYS.ACTIVITY_LOGS);
      logs.unshift({
        id: "log-" + Math.random().toString(36).substring(2),
        userId: userId || "system",
        userName: userEmail?.split("@")[0] || "Administrator",
        userEmail: userEmail || "admin@precisionqa.com",
        action: "admin_configuration",
        description: desc,
        payload: body,
        createdAt: new Date().toISOString()
      });
      saveCollection(STORAGE_KEYS.ACTIVITY_LOGS, logs);
    };

    // Handle standard table saves
    if (["client", "lob", "team", "user", "scorecards"].includes(type)) {
      const storageKey = STORAGE_KEYS[(`${type}s`.toUpperCase() as keyof typeof STORAGE_KEYS)] || STORAGE_KEYS.CLIENTS;
      let items = getCollection(storageKey);

      if (action === "delete") {
        items = items.filter(item => item.id !== payload.id);
        logActivity(`Deleted admin entity: ${type} with ID ${payload.id}`);
      } else {
        const index = items.findIndex(item => item.id === payload.id);
        if (index > -1) {
          items[index] = { ...items[index], ...payload };
        } else {
          items.push({ id: payload.id || `${type}-${Math.random().toString(36).substring(2)}`, ...payload });
        }
        logActivity(`Saved admin entity: ${type} (${payload.name || payload.email || payload.id})`);
      }
      saveCollection(storageKey, items);
      return respondJSON({ success: true });
    }

    // Handle generic JSON settings (processes, shifts, holidays etc)
    const settingKey = `setting_admin_${type}`;
    if (action === "delete") {
      let items = JSON.parse(localStorage.getItem(settingKey) || "[]");
      if (Array.isArray(items)) {
        items = items.filter((item: any) => item.id !== payload.id);
        localStorage.setItem(settingKey, JSON.stringify(items));
      }
      logActivity(`Deleted administrative list item for ${type}: ${payload.id}`);
    } else {
      let items = JSON.parse(localStorage.getItem(settingKey) || "[]");
      if (Array.isArray(items)) {
        const index = items.findIndex((item: any) => item.id === payload.id);
        if (index > -1) {
          items[index] = { ...items[index], ...payload };
        } else {
          items.push({ id: payload.id || `${type}-${Math.random().toString(36).substring(2)}`, ...payload });
        }
        localStorage.setItem(settingKey, JSON.stringify(items));
      } else {
        // Direct object settings like attendanceRules, systemSettings
        localStorage.setItem(settingKey, JSON.stringify({ ...items, ...payload }));
      }
      logActivity(`Updated administrative setting list for ${type}`);
    }

    return respondJSON({ success: true });
  }

  // 3. GET /api/cases
  if (path === "/api/cases" && method === "GET") {
    const cases = getCollection(STORAGE_KEYS.CASES);
    return respondJSON(cases);
  }

  // 4. POST /api/universal-import
  if (path === "/api/universal-import" && method === "POST") {
    const { batchName, cases } = body || {};
    const existingCases = getCollection(STORAGE_KEYS.CASES);
    const existingBatches = getCollection(STORAGE_KEYS.BATCHES);

    const batchId = "batch-" + Math.floor(10000 + Math.random() * 90000).toString();
    const newCases = (cases || []).map((c: any) => ({
      id: "case-" + Math.random().toString(36).substring(2),
      caseId: c.caseId || "CS-" + Math.floor(1000 + Math.random() * 9000),
      agentEmail: c.agentEmail || "agent@precisionqa.com",
      agentName: c.agentName || " Arthur Dent",
      auditDate: c.auditDate || new Date().toISOString().substring(0, 10),
      status: "pending",
      batchId,
      importedAt: new Date().toISOString(),
      metadata: c.metadata || {}
    }));

    saveCollection(STORAGE_KEYS.CASES, [...existingCases, ...newCases]);

    const newBatch = {
      id: batchId,
      batchName: batchName || "Import Batch #" + batchId,
      importedBy: "Sarah Jenkins",
      importedOn: new Date().toISOString(),
      totalCases: newCases.length,
      importStatus: "success",
      isActive: true
    };
    existingBatches.unshift(newBatch);
    saveCollection(STORAGE_KEYS.BATCHES, existingBatches);

    return respondJSON({ success: true, batchId, totalImported: newCases.length });
  }

  // 5. POST /api/universal-assign
  if (path === "/api/universal-assign" && method === "POST") {
    const { batchId } = body || {};
    const cases = getCollection(STORAGE_KEYS.CASES);
    const auditors = getCollection(STORAGE_KEYS.USERS).filter(u => u.role === "qa_auditor");

    if (auditors.length === 0) {
      throw new Error("No QA Auditors found to perform assignments.");
    }

    let assignedCount = 0;
    const updatedCases = cases.map((c: any) => {
      if (c.batchId === batchId && c.status === "pending") {
        const auditor = auditors[assignedCount % auditors.length];
        assignedCount++;
        return { ...c, status: "assigned", auditorId: auditor.id, auditorName: auditor.name };
      }
      return c;
    });

    saveCollection(STORAGE_KEYS.CASES, updatedCases);
    return respondJSON({ success: true, assignedCount });
  }

  // 6. GET /api/assignment/cases
  if (path === "/api/assignment/cases" && method === "GET") {
    const cases = getCollection(STORAGE_KEYS.CASES);
    return respondJSON(cases);
  }

  // 7. GET /api/assignment/auditors
  if (path === "/api/assignment/auditors" && method === "GET") {
    const auditors = getCollection(STORAGE_KEYS.USERS).filter(u => u.role === "qa_auditor" || u.role === "qa_manager");
    return respondJSON(auditors);
  }

  // 8. GET /api/assignment/summary
  if (path === "/api/assignment/summary" && method === "GET") {
    const cases = getCollection(STORAGE_KEYS.CASES);
    const completed = cases.filter(c => c.status === "completed").length;
    const pending = cases.filter(c => c.status === "assigned").length;
    return respondJSON({
      totalAudited: completed,
      pendingAudits: pending,
      targetVolume: cases.length,
      slaCompliance: 96.8
    });
  }

  // 9. GET /api/form-studio/scorecards
  if (path === "/api/form-studio/scorecards" && method === "GET") {
    const scorecards = getCollection(STORAGE_KEYS.SCORECARDS);
    return respondJSON(scorecards);
  }

  // 10. POST /api/form-studio/scorecards
  if (path === "/api/form-studio/scorecards" && method === "POST") {
    const scorecards = getCollection(STORAGE_KEYS.SCORECARDS);
    const index = scorecards.findIndex(sc => sc.id === body.id);
    if (index > -1) {
      scorecards[index] = { ...scorecards[index], ...body };
    } else {
      scorecards.push({ id: body.id || "sc-" + Math.random().toString(36).substring(2), ...body });
    }
    saveCollection(STORAGE_KEYS.SCORECARDS, scorecards);
    return respondJSON({ success: true, scorecard: body });
  }

  // 11. GET /api/batches
  if (path === "/api/batches" && method === "GET") {
    const batches = getCollection(STORAGE_KEYS.BATCHES);
    return respondJSON(batches);
  }

  // 12. GET /api/notifications
  if (path.startsWith("/api/notifications") && method === "GET") {
    const notifications = getCollection(STORAGE_KEYS.NOTIFICATIONS);
    return respondJSON(notifications);
  }

  // 13. POST /api/notifications/*/read
  if (path.includes("/read") && method === "POST") {
    const match = path.match(/\/notifications\/([^\/]+)\/read/);
    if (match) {
      const id = match[1];
      const notifications = getCollection(STORAGE_KEYS.NOTIFICATIONS);
      const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
      saveCollection(STORAGE_KEYS.NOTIFICATIONS, updated);
      return respondJSON({ success: true });
    }
  }

  // Default handler: Return standard ok status for custom calls
  return respondJSON({ success: true });
}
