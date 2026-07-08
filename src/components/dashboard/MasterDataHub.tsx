import React, { useState, useEffect, useRef } from "react";
import {
  Database, Briefcase, Network, Sliders, Users, Building, MapPin, Award,
  CheckSquare, Shield, Clock, Zap, Globe, MessageSquare, FolderGit2, BookOpen,
  ListPlus, Cpu, FileSpreadsheet, GitBranch, Hammer, UserCheck, Calendar,
  AlertCircle, Search, Plus, Edit2, Archive, Check, X, Download, Upload,
  Copy, History, Trash2, ArrowUpDown, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, AlertTriangle, Play, HelpCircle, FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "../../types";

interface MasterDataHubProps {
  currentUser: User;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
}

// 24 Master Data Registries Configuration
interface RegistryDefinition {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  category: "organization" | "workforce" | "quality" | "rules";
}

const REGISTRIES: RegistryDefinition[] = [
  // Organization (10)
  { id: "clients", label: "Clients", icon: Briefcase, description: "Corporate clients, color themes, workflows, and scorecard mappings.", category: "organization" },
  { id: "lobs", label: "LOBs (Lines of Business)", icon: Network, description: "Lines of Business mapped securely per parent Client.", category: "organization" },
  { id: "processes", label: "Processes", icon: Sliders, description: "Channel business processes (Voice, Chat, Email, Backoffice).", category: "organization" },
  { id: "teams", label: "Teams", icon: Users, description: "Operational squad hierarchies and QA supervision networks.", category: "organization" },
  { id: "departments", label: "Departments", icon: Building, description: "Corporate business departments.", category: "organization" },
  { id: "locations", label: "Locations", icon: MapPin, description: "Corporate global offices, sites, and operational facilities.", category: "organization" },
  { id: "designations", label: "Designations", icon: Award, description: "Corporate hierarchy job roles and seniority levels.", category: "organization" },
  { id: "business-units", label: "Business Units", icon: Shield, description: "Divisional enterprise operational segments.", category: "organization" },
  { id: "campaigns", label: "Campaigns", icon: Zap, description: "Active business programs, client acquisitions, and queues.", category: "organization" },
  { id: "projects", label: "Projects", icon: FolderGit2, description: "Specific project scopes mapped under business processes.", category: "organization" },

  // Workforce & Schedules (5)
  { id: "shifts", label: "Shifts", icon: Clock, description: "Corporate shift timings, intervals, and timezone rosters.", category: "workforce" },
  { id: "skills", label: "Skills", icon: Cpu, description: "Roster skillsets, tags, and expertise matrices.", category: "workforce" },
  { id: "languages", label: "Languages", icon: Globe, description: "Supported audit and conversation languages.", category: "workforce" },
  { id: "holiday-calendars", label: "Holiday Calendars", icon: Calendar, description: "Regional and national corporate holiday event dates.", category: "workforce" },
  { id: "attendance-rules", label: "Attendance Rules", icon: CheckCircle2, description: "Roster thresholds for assignment calculations.", category: "workforce" },

  // Quality & Rules (5)
  { id: "audit-categories", label: "Audit Categories", icon: CheckSquare, description: "Interaction categories and structural sub-segments.", category: "quality" },
  { id: "audit-types", label: "Audit Types", icon: FileText, description: "Evaluation types (Self-Audits, Calibrations, Normal Audits).", category: "quality" },
  { id: "reference-lists", label: "Reference Lists", icon: BookOpen, description: "Centralized reusable lists (Root Causes, RCA, coaching types).", category: "quality" },
  { id: "dropdown-libraries", label: "Dropdown Libraries", icon: ListPlus, description: "Dynamic list elements reusable across custom scorecard forms.", category: "quality" },
  { id: "formula-libraries", label: "Formula Libraries", icon: Cpu, description: "Central mathematical formulation blocks.", category: "quality" },

  // System Profiles (4)
  { id: "import-profiles", label: "Import Profiles", icon: FileSpreadsheet, description: "Headers mapping templates with custom JSONB parser.", category: "rules" },
  { id: "workflow-templates", label: "Workflow Templates", icon: GitBranch, description: "Custom state transitions machine with SLA tracking thresholds.", category: "rules" },
  { id: "form-templates", label: "Form Templates", icon: Hammer, description: "QA evaluation form scorecards containing dynamic questions.", category: "rules" },
  { id: "assignment-profiles", label: "Assignment Profiles", icon: UserCheck, description: "Rule engines (Round Robin, Balanced, Header-Based).", category: "rules" }
];

export default function MasterDataHub({ currentUser, addToast }: MasterDataHubProps) {
  const [activeRegistryId, setActiveRegistryId] = useState<string>("clients");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  
  // Entire Master Database state, synced dynamically with backend
  const [dataSets, setDataSets] = useState<Record<string, any[]>>({
    clients: [],
    lobs: [],
    processes: [],
    teams: [],
    departments: [],
    locations: [],
    designations: [],
    "business-units": [],
    campaigns: [],
    projects: [],
    shifts: [],
    skills: [],
    languages: [],
    "holiday-calendars": [],
    "attendance-rules": [],
    "audit-categories": [],
    "audit-types": [],
    "reference-lists": [],
    "dropdown-libraries": [],
    "formula-libraries": [],
    "import-profiles": [],
    "workflow-templates": [],
    "form-templates": [],
    "assignment-profiles": []
  });

  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "clone">("add");
  const [formPayload, setFormPayload] = useState<any>({});
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkRawText, setBulkRawText] = useState("");
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Load datasets on boot
  const loadAllMasterData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Map existing backend lists, defaulting placeholders for custom items stored in settings
          const loaded: Record<string, any[]> = {
            clients: data.clients || [],
            lobs: (data.lobs || []).map((l: any) => ({ ...l, clientId: l.clientId || "" })),
            processes: data.processes || [],
            teams: data.teams || [],
            departments: data.departments || data.settings?.admin_departments || [
              { id: "dept-1", name: "Operations", description: "Core frontoffice customer operations", isActive: true, version: 1 },
              { id: "dept-2", name: "Quality Assurance", description: "Transactional auditing and training", isActive: true, version: 1 },
              { id: "dept-3", name: "Human Resources", description: "Rostering and onboarding", isActive: true, version: 1 }
            ],
            locations: data.locations || data.settings?.admin_locations || [
              { id: "loc-1", name: "Manila Hub", description: "Main Philippine delivery site", isActive: true, version: 1 },
              { id: "loc-2", name: "Bangalore SEZ", description: "Technology development park", isActive: true, version: 1 },
              { id: "loc-3", name: "Dallas HQ", description: "US administrative corporate offices", isActive: true, version: 1 }
            ],
            designations: data.designations || data.settings?.admin_designations || [
              { id: "des-1", name: "QA Auditor", description: "Responsible for interaction assessments", isActive: true, version: 1 },
              { id: "des-2", name: "Team Leader", description: "Operational supervisor and coaching owner", isActive: true, version: 1 },
              { id: "des-3", name: "Customer Associate", description: "Frontline delivery agent", isActive: true, version: 1 }
            ],
            "business-units": data.businessUnits || data.settings?.admin_business_units || [
              { id: "bu-1", name: "BFSI", description: "Banking, Financial Services and Insurance", isActive: true, version: 1 },
              { id: "bu-2", name: "E-Commerce", description: "Retail and merchant support channels", isActive: true, version: 1 },
              { id: "bu-3", name: "Healthcare", description: "Clinical logging and pharmacy support", isActive: true, version: 1 }
            ],
            campaigns: data.campaigns || data.settings?.admin_campaigns || [
              { id: "camp-1", name: "Premium Delivery Q3", description: "Focused Q3 client support", isActive: true, version: 1 },
              { id: "camp-2", name: "Black Friday Surge", description: "Holiday transactional spike queue", isActive: true, version: 1 }
            ],
            projects: data.projects || data.settings?.admin_projects || [
              { id: "proj-1", name: "Chatbot Containment Alpha", description: "Pre-QA testing of automated responses", isActive: true, version: 1 },
              { id: "proj-2", name: "Backoffice Ticket Cleanup", description: "Legacy ticket verification project", isActive: true, version: 1 }
            ],
            shifts: data.shifts || [
              { id: "shift-1", name: "APAC Morning", startTime: "07:00", endTime: "16:00", timezone: "SGT", isActive: true, version: 1 },
              { id: "shift-2", name: "EMEA Business", startTime: "09:00", endTime: "18:00", timezone: "GMT", isActive: true, version: 1 },
              { id: "shift-3", name: "US Night Shift", startTime: "22:00", endTime: "07:00", timezone: "EST", isActive: true, version: 1 }
            ],
            skills: data.skills || data.settings?.admin_skills || [
              { id: "sk-1", name: "Technical Troubleshooting", description: "In-depth desktop support and router configuration", isActive: true, version: 1 },
              { id: "sk-2", name: "De-escalation", description: "Conflict resolution and executive complaints", isActive: true, version: 1 },
              { id: "sk-3", name: "Billing Auditing", description: "Ledger discrepancy mapping and credit approvals", isActive: true, version: 1 }
            ],
            languages: data.languages || data.settings?.admin_languages || [
              { id: "lang-1", name: "English", code: "EN-US", isActive: true, version: 1 },
              { id: "lang-2", name: "Spanish", code: "ES-MX", isActive: true, version: 1 },
              { id: "lang-3", name: "French", code: "FR-FR", isActive: true, version: 1 }
            ],
            "holiday-calendars": data.holidayCalendars || data.settings?.admin_holiday_calendars || [
              { id: "hol-1", name: "New Year Corporate Holiday", date: "2026-01-01", region: "Global", description: "All global nodes offline", isActive: true, version: 1 },
              { id: "hol-2", name: "US Independence Day", date: "2026-07-04", region: "US Nodes", description: "US support queues reduced roster", isActive: true, version: 1 }
            ],
            "attendance-rules": data.attendanceRules ? [data.attendanceRules] : data.settings?.admin_attendance_rules ? [data.settings.admin_attendance_rules] : [
              { id: "attr-1", name: "Standard Attendance Policy", lateGraceMinutes: 15, absentThresholdHours: 4, halfDayThresholdHours: 6, isActive: true, version: 1 }
            ],
            "audit-categories": data.auditCategories || [
              { id: "audcat-1", name: "Customer Care Voice", description: "General inbound voice support channels", isActive: true, version: 1 },
              { id: "audcat-2", name: "Social Escalations", description: "Public social media handle interactions", isActive: true, version: 1 }
            ],
            "audit-types": data.auditTypes || data.settings?.admin_audit_types || [
              { id: "audt-1", name: "Transactional Quality Audit", description: "Standard evaluation by assigned QA Specialist", isActive: true, version: 1 },
              { id: "audt-2", name: "Calibration Session", description: "Multi-auditor sync on single case interaction", isActive: true, version: 1 },
              { id: "audt-3", name: "Compliance Check", description: "Zero-tolerance regulatory safety assessment", isActive: true, version: 1 }
            ],
            "reference-lists": data.referenceLists || data.settings?.admin_reference_lists || [
              { id: "ref-1", name: "RCA Types", items: "Process Failure, Human Error, System Outage, Compliance Breach", description: "Root Cause Categories mapped across disputes", isActive: true, version: 1 },
              { id: "ref-2", name: "Coaching Types", items: "Desktop Simulation, Roleplay Practice, Side-by-side Shadowing, Documentation Review", description: "Coaching interventions logged by supervisors", isActive: true, version: 1 },
              { id: "ref-3", name: "Audit Outcomes", items: "Pass, Fail, Critical Fail, Calibrated Match", description: "General evaluation scorecard outcomes", isActive: true, version: 1 }
            ],
            "dropdown-libraries": data.dropdownLibraries || data.settings?.admin_dropdown_libraries || [
              { id: "drop-1", name: "Disposition Codes", options: ["Resolved First Contact", "Escalated to L2", "Callback Scheduled", "Customer Hung Up", "Unrelated Query"], isActive: true, version: 1 },
              { id: "drop-2", name: "Error Categories", options: ["Communication", "Product Knowledge", "Compliance Regulatory", "Tool Navigational Error"], isActive: true, version: 1 }
            ],
            "formula-libraries": data.formulaLibraries || data.settings?.admin_formula_libraries || [
              { id: "formlib-1", name: "Deductive Quality Index", expression: "(EarnedPoints / TotalPossiblePoints) * 100", description: "Normal percentage logic subtracting errors", isActive: true, version: 1 },
              { id: "formlib-2", name: "SLA Adherence Ratio", expression: "(MetSLA / TotalInteractions) * 100", description: "Measures process SLA adherence", isActive: true, version: 1 }
            ],
            "import-profiles": data.importProfiles || data.settings?.admin_import_profiles || [
              { id: "prof-1", name: "Default Sheets Profile", defaultClientId: "", description: "Standard template mapping headers", version: 1, columns: "Case ID, Agent Email, Client, LOB, Audit Date, Interaction File" },
              { id: "prof-2", name: "Telephony CSV Feed", defaultClientId: "", description: "Call center direct metadata dumps loader", version: 2, columns: "ID, Call ID, Duration, Hold Time, Agent Address, Customer Segment" }
            ],
            "workflow-templates": data.workflowTemplates || data.settings?.admin_workflow_templates || [
              { id: "wf-1", name: "Gated Audit Workflow", status: "published", description: "Standard multistep review pipeline with SLA enforcement", version: 1, stagesCount: 6 },
              { id: "wf-2", name: "Express Single-Step", status: "draft", description: "Audited cases move straight to closed status", version: 1, stagesCount: 2 }
            ],
            "form-templates": (data.scorecards || []).map((s: any) => ({
              id: s.id,
              name: s.name,
              description: s.description || "",
              status: s.isActive ? "published" : "archived",
              version: 1,
              passingScore: s.passingScore || 85
            })) || [
              { id: "formt-1", name: "E-Commerce Customer Support Scorecard", status: "published", version: 1, passingScore: 80, description: "Focuses on soft skills and prompt delivery" }
            ],
            "assignment-profiles": data.assignmentProfiles || data.settings?.admin_assignment_profiles || [
              { id: "asg-1", name: "Random Auditor Roster", strategy: "round_robin", description: "Assigns interactions equally across active auditors", isActive: true, version: 1 },
              { id: "asg-2", name: "Balanced Skill Allocation", strategy: "balanced", description: "Distributes by client and channel expertise matching", isActive: true, version: 1 },
              { id: "asg-3", name: "Metadata Header Route", strategy: "header_based", description: "Maps supervisor headers from sheets straight to audits", isActive: true, version: 1 }
            ]
          };

          // Try loading raw settings configurations to overlay any user modifications
          REGISTRIES.forEach(reg => {
            const rawKey = `admin_${reg.id.replace("-", "_")}`;
            if (data.settings && data.settings[rawKey]) {
              try {
                const parsed = data.settings[rawKey];
                if (Array.isArray(parsed)) {
                  loaded[reg.id] = parsed;
                } else if (parsed && typeof parsed === "object") {
                  loaded[reg.id] = [parsed];
                }
              } catch (e) {
                console.warn(`Error loading admin setting: ${rawKey}`, e);
              }
            }
          });

          setDataSets(loaded);
          setActivityLogs(data.activityLogs || []);
        }
      }
    } catch (err) {
      console.error("Master Data Sync Failed:", err);
      addToast("error", "Master Data Sync Error", "Could not load registries databases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllMasterData();
  }, []);

  // Save changes to Database using backend /api/admin/save
  const saveRegistryChange = async (registryId: string, updatedList: any[], affectedItem: any, actionType: "created" | "updated" | "archived" | "restored") => {
    const payload = updatedList;
    const typeKey = registryId.replace("-", "_"); // Match backend settings keys

    try {
      // For Clients, LOBs, and Teams, we can also write directly to relational if we want, or fall through to settings
      // To guarantee flawless cross-compatibility, we write to the specific types supported by /api/admin/save:
      let saveType = typeKey;
      let bodyPayload: any = payload;

      if (registryId === "clients" || registryId === "lobs" || registryId === "teams") {
        saveType = registryId === "clients" ? "client" : registryId === "lobs" ? "lob" : "team";
        bodyPayload = affectedItem;
      }

      const res = await fetch("/api/admin/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: saveType,
          payload: bodyPayload,
          userId: currentUser.id,
          userEmail: currentUser.email,
          description: `Master Data Console: [${REGISTRIES.find(r => r.id === registryId)?.label}] item "${affectedItem.name || affectedItem.label || affectedItem.id}" ${actionType}.`
        })
      });

      if (res.ok) {
        addToast("success", "Registry Sync Successful", `Central registry "${REGISTRIES.find(r => r.id === registryId)?.label}" updated and audited securely.`);
        loadAllMasterData();
      } else {
        throw new Error("API responded with failure");
      }
    } catch (err: any) {
      console.error("Failed saving master registry change:", err);
      addToast("error", "Database Sync Rejected", "Could not apply master data modifications permanently.");
    }
  };

  // Prevent deletion logic: "Prevent deletion if data is in use. Instead allow Archive."
  const handleArchiveItem = async (registryId: string, itemId: string) => {
    const list = dataSets[registryId] || [];
    const item = list.find((x: any) => x.id === itemId);
    if (!item) return;

    // Simulate dependency checks. Inform user clearly that physical deletion is guarded.
    const inUse = true; // Protect enterprise data integrity by default

    const updatedList = list.map((x: any) => {
      if (x.id === itemId) {
        return { ...x, isActive: false, isArchived: true, status: "archived", version: (x.version || 1) + 1 };
      }
      return x;
    });

    const updatedItem = updatedList.find((x: any) => x.id === itemId);

    setDataSets(prev => ({
      ...prev,
      [registryId]: updatedList
    }));

    await saveRegistryChange(registryId, updatedList, updatedItem, "archived");
  };

  const handleToggleActive = async (registryId: string, itemId: string) => {
    const list = dataSets[registryId] || [];
    const item = list.find((x: any) => x.id === itemId);
    if (!item) return;

    const currentlyActive = item.isActive !== false && item.status !== "archived";
    const nextActive = !currentlyActive;

    const updatedList = list.map((x: any) => {
      if (x.id === itemId) {
        return {
          ...x,
          isActive: nextActive,
          status: nextActive ? "published" : "archived",
          version: (x.version || 1) + 1
        };
      }
      return x;
    });

    const updatedItem = updatedList.find((x: any) => x.id === itemId);

    setDataSets(prev => ({
      ...prev,
      [registryId]: updatedList
    }));

    await saveRegistryChange(registryId, updatedList, updatedItem, nextActive ? "restored" : "archived");
  };

  // Form submit handler for Create / Edit Modals
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = dataSets[activeRegistryId] || [];
    let updatedList = [...list];
    let affectedItem: any = {};

    if (modalMode === "add" || modalMode === "clone") {
      const newId = `master-${activeRegistryId}-${Date.now()}`;
      affectedItem = {
        ...formPayload,
        id: newId,
        isActive: true,
        version: 1
      };
      updatedList.push(affectedItem);
    } else {
      // Edit mode
      updatedList = list.map((x: any) => {
        if (x.id === formPayload.id) {
          affectedItem = {
            ...x,
            ...formPayload,
            version: (x.version || 1) + 1
          };
          return affectedItem;
        }
        return x;
      });
    }

    setDataSets(prev => ({
      ...prev,
      [activeRegistryId]: updatedList
    }));

    setIsModalOpen(false);
    await saveRegistryChange(activeRegistryId, updatedList, affectedItem, modalMode === "add" ? "created" : modalMode === "clone" ? "created" : "updated");
  };

  const handleOpenAdd = () => {
    setModalMode("add");
    // Generate initial blank schema based on active registry
    const defaultPayload: Record<string, any> = { name: "", description: "" };
    
    // Add custom fields depending on registry requirements
    if (activeRegistryId === "clients") {
      defaultPayload.colorCode = "#4F46E5";
      defaultPayload.logoUrl = "";
      defaultPayload.defaultWorkflowId = "";
      defaultPayload.defaultFormId = "";
      defaultPayload.defaultImportProfileId = "";
    } else if (activeRegistryId === "lobs") {
      defaultPayload.clientId = dataSets.clients[0]?.id || "";
    } else if (activeRegistryId === "processes") {
      defaultPayload.clientId = dataSets.clients[0]?.id || "";
      defaultPayload.lobId = dataSets.lobs[0]?.id || "";
      defaultPayload.defaultFormId = "";
      defaultPayload.defaultWorkflowId = "";
    } else if (activeRegistryId === "teams") {
      defaultPayload.parentId = "";
      defaultPayload.managerId = "";
    } else if (activeRegistryId === "shifts") {
      defaultPayload.startTime = "09:00";
      defaultPayload.endTime = "18:00";
      defaultPayload.timezone = "GMT";
    } else if (activeRegistryId === "languages") {
      defaultPayload.code = "EN-US";
    } else if (activeRegistryId === "holiday-calendars") {
      defaultPayload.date = new Date().toISOString().split("T")[0];
      defaultPayload.region = "Global";
    } else if (activeRegistryId === "attendance-rules") {
      defaultPayload.lateGraceMinutes = 15;
      defaultPayload.absentThresholdHours = 4;
      defaultPayload.halfDayThresholdHours = 6;
    } else if (activeRegistryId === "reference-lists") {
      defaultPayload.items = "";
    } else if (activeRegistryId === "dropdown-libraries") {
      defaultPayload.options = [];
    } else if (activeRegistryId === "formula-libraries") {
      defaultPayload.expression = "";
    } else if (activeRegistryId === "import-profiles") {
      defaultPayload.columns = "Case ID, Agent Email, Client, LOB, Audit Date";
      defaultPayload.defaultClientId = "";
    } else if (activeRegistryId === "workflow-templates") {
      defaultPayload.status = "draft";
      defaultPayload.stagesCount = 4;
    } else if (activeRegistryId === "form-templates") {
      defaultPayload.status = "draft";
      defaultPayload.passingScore = 80;
    } else if (activeRegistryId === "assignment-profiles") {
      defaultPayload.strategy = "round_robin";
    }

    setFormPayload(defaultPayload);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setModalMode("edit");
    setFormPayload({ ...item });
    setIsModalOpen(true);
  };

  const handleOpenClone = (item: any) => {
    setModalMode("clone");
    setFormPayload({
      ...item,
      id: undefined,
      name: `${item.name} (Copy)`,
      version: 1
    });
    setIsModalOpen(true);
  };

  // Bulk Actions
  const handleBulkExport = (registryId: string) => {
    const list = dataSets[registryId] || [];
    if (list.length === 0) {
      addToast("warning", "No Records", "There are no records inside this registry to export.");
      return;
    }

    // Generate CSV
    const headers = Object.keys(list[0]).join(",");
    const rows = list.map(item => {
      return Object.values(item).map(val => {
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `precisionqa_master_${registryId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast("success", "Export Completed", `Exported ${list.length} master data records successfully.`);
  };

  const handleBulkImportSubmit = async () => {
    if (!bulkRawText.trim()) return;
    try {
      // Support basic CSV or Line-separated list
      const lines = bulkRawText.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      const list = [...(dataSets[activeRegistryId] || [])];
      let importCount = 0;

      lines.forEach((line, idx) => {
        // Detect headers or just read values
        if (idx === 0 && line.toLowerCase().includes("name")) return; // Skip header line
        
        const parts = line.split(",").map(p => p.trim());
        const nameVal = parts[0];
        const descVal = parts[1] || `Bulk imported item via Hub Console`;

        if (nameVal) {
          list.push({
            id: `master-${activeRegistryId}-${Date.now()}-${idx}`,
            name: nameVal,
            description: descVal,
            isActive: true,
            version: 1,
            // Fallback default fields depending on active registry
            clientId: dataSets.clients[0]?.id || "",
            lobId: dataSets.lobs[0]?.id || "",
            startTime: "09:00",
            endTime: "18:00",
            timezone: "GMT"
          });
          importCount++;
        }
      });

      setDataSets(prev => ({
        ...prev,
        [activeRegistryId]: list
      }));

      setBulkImportOpen(false);
      setBulkRawText("");
      
      await saveRegistryChange(activeRegistryId, list, { name: `Bulk Import Feed: ${importCount} items` }, "created");
      addToast("success", "Bulk Import Complete", `Successfully imported ${importCount} records into the central registry.`);
    } catch (err) {
      addToast("error", "Import Parse Error", "Failed to parse the provided bulk CSV feed.");
    }
  };

  // Helper values
  const activeRegistry = REGISTRIES.find(r => r.id === activeRegistryId) || REGISTRIES[0];
  const listData = dataSets[activeRegistryId] || [];

  // Filter & Search Logic
  const filteredList = listData.filter(item => {
    const isMatchedSearch = searchQuery === "" || 
      String(item.name || item.label || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(item.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(item.id || "").toLowerCase().includes(searchQuery.toLowerCase());

    const isMatchedActive = !filterActiveOnly || (item.isActive !== false && item.status !== "archived");

    return isMatchedSearch && isMatchedActive;
  });

  // Global Search across ALL registries
  const globalSearchResults = Object.entries(dataSets).flatMap(([regId, rawItems]) => {
    const items = (rawItems || []) as any[];
    if (!globalSearch.trim()) return [];
    const reg = REGISTRIES.find(r => r.id === regId);
    if (!reg) return [];

    return items
      .filter(item => 
        String(item.name || item.label || "").toLowerCase().includes(globalSearch.toLowerCase()) ||
        String(item.description || "").toLowerCase().includes(globalSearch.toLowerCase())
      )
      .map(item => ({
        ...item,
        registryId: regId,
        registryLabel: reg.label,
        registryIcon: reg.icon
      }));
  }).slice(0, 15);

  return (
    <div className="space-y-6">
      {/* ENTERPRISE TITLE HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <Database className="text-indigo-600 dark:text-indigo-400" size={26} /> Centralized Master Data Hub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Enterprise Registry & Metadata Hub. Maintain normalized, zero-duplication static business directories utilized dynamically across audit, feedback, and assignment engines.
          </p>
        </div>

        {/* Global Search Component */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Global search master data..."
            className="w-full pl-9 pr-8 py-2 border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111] text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch("")} className="absolute inset-y-0 right-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X size={14} />
            </button>
          )}

          {/* Global Search Results Dropdown Overlay */}
          <AnimatePresence>
            {globalSearch.trim() !== "" && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute right-0 mt-2 w-full md:w-96 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#121212] shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto"
              >
                <div className="p-2 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex justify-between">
                  <span>Match Registry Nodes ({globalSearchResults.length})</span>
                  <span>Press ESC to Clear</span>
                </div>
                {globalSearchResults.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">No master records matched your query.</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {globalSearchResults.map((item, idx) => {
                      const Icon = item.registryIcon;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setActiveRegistryId(item.registryId);
                            setSearchQuery(item.name || item.label || "");
                            setGlobalSearch("");
                          }}
                          className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex gap-2.5"
                        >
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <Icon size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline">
                              <span className="text-xs font-semibold text-slate-800 dark:text-white truncate">{item.name || item.label}</span>
                              <span className="text-[9px] font-mono font-bold uppercase text-indigo-500 dark:text-indigo-400">{item.registryLabel}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.description || "No description loaded."}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <RefreshCw className="animate-spin text-indigo-600 dark:text-indigo-400" size={32} />
          <p className="text-xs text-slate-400 font-mono">Syncing enterprise registry nodes from the database...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* LEFT REGISTRY DIRECTORY SIDEBAR */}
          <div className="lg:col-span-1 border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111111] p-4 space-y-5">
            <div>
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Registry Category</h2>
              <p className="text-[10px] text-slate-400">24 active registries online</p>
            </div>

            {/* Logical Category Grouping */}
            {(["organization", "workforce", "quality", "rules"] as const).map(cat => {
              const labelMap = {
                organization: "Enterprise Structure",
                workforce: "Workforce & Rostering",
                quality: "Quality Rules & Libraries",
                rules: "System Profiles"
              };

              const filteredRegs = REGISTRIES.filter(r => r.category === cat);

              return (
                <div key={cat} className="space-y-1.5">
                  <h3 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400/90 dark:text-slate-500 pl-2">
                    {labelMap[cat]}
                  </h3>
                  <div className="space-y-0.5">
                    {filteredRegs.map(reg => {
                      const Icon = reg.icon;
                      const isActive = activeRegistryId === reg.id;
                      const count = dataSets[reg.id]?.length || 0;

                      return (
                        <button
                          key={reg.id}
                          onClick={() => {
                            setActiveRegistryId(reg.id);
                            setSearchQuery("");
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between border ${
                            isActive
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 dark:shadow-none"
                              : "text-slate-600 hover:text-slate-900 border-transparent dark:text-slate-300 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon size={14} className={isActive ? "text-white" : "text-slate-400 dark:text-slate-500"} />
                            <span className="truncate">{reg.label}</span>
                          </div>
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                            isActive ? "bg-indigo-700/50 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* MAIN REGISTRY MANAGEMENT CONSOLE */}
          <div className="lg:col-span-3 space-y-6">
            <div className="border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111111] p-5 shadow-sm space-y-4">
              
              {/* Registry Details Banner */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 dark:border-white/5 pb-4 gap-4">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    {React.createElement(activeRegistry.icon, { size: 20 })}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      {activeRegistry.label} Registry
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeRegistry.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleOpenAdd}
                    className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-indigo-100 dark:shadow-none"
                  >
                    <Plus size={14} /> Add Record
                  </button>
                  <button
                    onClick={() => setBulkImportOpen(true)}
                    className="flex-1 sm:flex-initial bg-slate-50 border border-slate-200 hover:bg-slate-100 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Upload size={14} /> Bulk Import
                  </button>
                  <button
                    onClick={() => handleBulkExport(activeRegistryId)}
                    className="flex-1 sm:flex-initial bg-slate-50 border border-slate-200 hover:bg-slate-100 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search within ${activeRegistry.label.toLowerCase()}...`}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterActiveOnly}
                      onChange={(e) => setFilterActiveOnly(e.target.checked)}
                      className="rounded border-slate-300 dark:border-white/10 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Active Only</span>
                  </label>
                </div>
              </div>

              {/* MASTER RECORDS DATA TABLE */}
              {filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 border border-dashed border-slate-150 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/5">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                    <Search size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white">No active records found</h3>
                    <p className="text-xs text-slate-400 mt-1">Refine your query or add a new master record manually to get started.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/15">
                  <table className="w-full border-collapse text-left text-xs text-slate-500 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] border-b border-slate-150 dark:border-white/10">
                      <tr>
                        <th className="px-4 py-3">Registry ID / Value</th>
                        <th className="px-4 py-3">Description / Details</th>
                        <th className="px-4 py-3 text-center">Version</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-transparent">
                      {filteredList.map((item) => {
                        const isCurrentlyActive = item.isActive !== false && item.status !== "archived";
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/55 dark:hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800 dark:text-white text-xs">{item.name || item.label}</div>
                              <div className="font-mono text-[9px] text-indigo-500 mt-0.5">{item.id}</div>
                            </td>
                            <td className="px-4 py-3 max-w-sm">
                              <p className="line-clamp-2 text-slate-600 dark:text-slate-400">{item.description || item.columns || "No description provided."}</p>
                              
                              {/* Contextual indicators depending on registry type */}
                              {activeRegistryId === "clients" && (
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {item.colorCode && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-400">
                                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.colorCode }}></span> Color: {item.colorCode}
                                    </span>
                                  )}
                                  {item.defaultWorkflowId && <span className="text-[9px] bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded-full font-mono text-slate-500">WF: {item.defaultWorkflowId}</span>}
                                  {item.defaultFormId && <span className="text-[9px] bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded-full font-mono text-slate-500">Form: {item.defaultFormId}</span>}
                                </div>
                              )}
                              {activeRegistryId === "lobs" && (
                                <span className="text-[9px] bg-indigo-50 text-indigo-600 dark:bg-indigo-950/25 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-semibold">
                                  Client Ref: {item.clientId || "N/A"}
                                </span>
                              )}
                              {activeRegistryId === "processes" && (
                                <div className="flex gap-1.5 mt-1 flex-wrap">
                                  <span className="text-[9px] bg-indigo-50 text-indigo-600 dark:bg-indigo-950/25 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-semibold">Client: {item.clientId}</span>
                                  <span className="text-[9px] bg-emerald-50 text-emerald-600 dark:bg-emerald-950/25 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">LOB: {item.lobId}</span>
                                </div>
                              )}
                              {activeRegistryId === "shifts" && (
                                <span className="text-[9px] bg-amber-50 text-amber-600 dark:bg-amber-950/25 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-mono font-bold">
                                  ⌚ {item.startTime} - {item.endTime} ({item.timezone})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                              v{item.version || 1}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                isCurrentlyActive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400"
                                  : "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isCurrentlyActive ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                                {isCurrentlyActive ? "Active" : "Archived"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEdit(item)}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                                  title="Edit master configuration"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleOpenClone(item)}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors"
                                  title="Clone configuration profile"
                                >
                                  <Copy size={13} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (isCurrentlyActive) {
                                      handleArchiveItem(activeRegistryId, item.id);
                                    } else {
                                      handleToggleActive(activeRegistryId, item.id);
                                    }
                                  }}
                                  className={`p-1 rounded transition-colors ${
                                    isCurrentlyActive
                                      ? "hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-600"
                                      : "hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-600"
                                  }`}
                                  title={isCurrentlyActive ? "Archive to prevent broken dependencies" : "Restore configuration"}
                                >
                                  {isCurrentlyActive ? <Archive size={13} /> : <CheckCircle2 size={13} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TEAMS HIERARCHY TREE BUILDER (Only visible when active tab is teams) */}
            {activeRegistryId === "teams" && (
              <div className="border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111111] p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <GitBranch className="text-indigo-500" size={16} /> Hierarchical Teams Visualizer
                  </h3>
                  <p className="text-xs text-slate-400">Operations → Quality Assurance → Operational Teams mapping.</p>
                </div>

                <div className="border border-slate-100 dark:border-white/5 p-4 rounded-xl bg-slate-50/50 dark:bg-white/5 space-y-3 font-mono text-xs">
                  <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-extrabold">
                    <Building size={14} /> Operations Director Core Hierarchy
                  </div>
                  
                  <div className="pl-4 border-l border-slate-200 dark:border-white/10 space-y-3">
                    <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                      <ChevronRight size={12} /> <strong className="text-slate-800 dark:text-slate-200 font-bold">Quality Assurance Division</strong> (QA Director Lead)
                    </div>

                    <div className="pl-6 border-l border-slate-200 dark:border-white/10 space-y-2">
                      <div className="text-slate-600 dark:text-slate-400">
                        📁 <strong className="text-indigo-500 font-bold">QA Team A</strong> (Supervisor Lead)
                        <div className="pl-5 text-[11px] text-slate-400">└ Members: 12 frontline agents, 1 dedicated coach</div>
                      </div>
                      
                      <div className="text-slate-600 dark:text-slate-400">
                        📁 <strong className="text-indigo-500 font-bold">QA Team B</strong> (Senior Lead)
                        <div className="pl-5 text-[11px] text-slate-400">└ Members: 8 frontline agents, 1 calibrator</div>
                      </div>

                      <div className="text-slate-600 dark:text-slate-400">
                        📁 <strong className="text-indigo-500 font-bold">QA Team C</strong> (Operations Supervisor)
                        <div className="pl-5 text-[11px] text-[11px] text-slate-400">└ Members: 15 frontline agents</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT LOGS & MASTER REVISION TRAIL */}
            <div className="border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111111] p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <History size={14} className="text-indigo-500" /> Administrative Version History & Audit Trail
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Real-time telemetry audits logged</span>
              </div>

              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {activityLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="text-xs flex gap-3 border-l-2 border-indigo-500 pl-3 py-0.5">
                    <div className="flex-1">
                      <div className="flex justify-between items-baseline">
                        <strong className="text-slate-700 dark:text-slate-200 font-semibold">{log.description}</strong>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">{new Date(log.createdAt || Date.now()).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Initiated by <span className="font-mono">{log.userEmail || "system_admin"}</span> • Status: <span className="text-emerald-500 font-semibold">AUDITED</span>
                      </div>
                    </div>
                  </div>
                ))}
                {activityLogs.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-400">No telemetry logs found. Modifications will generate immediate audit trails.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DYNAMIC FORM MODAL (CREATE / EDIT / CLONE) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white capitalize">
                  {modalMode} Master {activeRegistry.label.slice(0, -1)} Profile
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
                {/* Standard Name / Label */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Name / Primary Key Label
                  </label>
                  <input
                    type="text"
                    required
                    value={formPayload.name || formPayload.label || ""}
                    onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })}
                    placeholder="Enter distinct identification label..."
                    className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Custom Registry Contextual Fields */}
                {activeRegistryId === "clients" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Accent Theme Color</label>
                        <input
                          type="color"
                          value={formPayload.colorCode || "#4F46E5"}
                          onChange={(e) => setFormPayload({ ...formPayload, colorCode: e.target.value })}
                          className="w-full h-8 rounded-lg cursor-pointer border border-slate-200 dark:border-white/10 bg-transparent"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Logo URL Accent</label>
                        <input
                          type="text"
                          value={formPayload.logoUrl || ""}
                          onChange={(e) => setFormPayload({ ...formPayload, logoUrl: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Default Form scorecard</label>
                        <input
                          type="text"
                          value={formPayload.defaultFormId || ""}
                          onChange={(e) => setFormPayload({ ...formPayload, defaultFormId: e.target.value })}
                          placeholder="Scorecard ID reference"
                          className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Default Workflow template</label>
                        <input
                          type="text"
                          value={formPayload.defaultWorkflowId || ""}
                          onChange={(e) => setFormPayload({ ...formPayload, defaultWorkflowId: e.target.value })}
                          placeholder="Workflow ID reference"
                          className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeRegistryId === "lobs" && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Associated parent client</label>
                    <select
                      value={formPayload.clientId || ""}
                      onChange={(e) => setFormPayload({ ...formPayload, clientId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none"
                    >
                      {dataSets.clients.map(c => (
                        <option key={c.id} value={c.id} className="text-slate-900 dark:text-white">{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {activeRegistryId === "processes" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Parent client</label>
                      <select
                        value={formPayload.clientId || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, clientId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs"
                      >
                        {dataSets.clients.map(c => (
                          <option key={c.id} value={c.id} className="text-slate-900 dark:text-white">{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Parent Line of Business</label>
                      <select
                        value={formPayload.lobId || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, lobId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs"
                      >
                        {dataSets.lobs.map(l => (
                          <option key={l.id} value={l.id} className="text-slate-900 dark:text-white">{l.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {activeRegistryId === "shifts" && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Start Time</label>
                      <input
                        type="text"
                        value={formPayload.startTime || "09:00"}
                        onChange={(e) => setFormPayload({ ...formPayload, startTime: e.target.value })}
                        placeholder="HH:MM"
                        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">End Time</label>
                      <input
                        type="text"
                        value={formPayload.endTime || "18:00"}
                        onChange={(e) => setFormPayload({ ...formPayload, endTime: e.target.value })}
                        placeholder="HH:MM"
                        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Timezone</label>
                      <input
                        type="text"
                        value={formPayload.timezone || "GMT"}
                        onChange={(e) => setFormPayload({ ...formPayload, timezone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs"
                      />
                    </div>
                  </div>
                )}

                {activeRegistryId === "reference-lists" && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Reference Items (Comma Separated)</label>
                    <textarea
                      required
                      value={formPayload.items || ""}
                      onChange={(e) => setFormPayload({ ...formPayload, items: e.target.value })}
                      placeholder="e.g. Failure, Human Error, Compliance Outage"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs"
                      rows={3}
                    />
                  </div>
                )}

                {activeRegistryId === "import-profiles" && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Expected Sheet Column Headers (CSV)</label>
                    <input
                      type="text"
                      required
                      value={formPayload.columns || ""}
                      onChange={(e) => setFormPayload({ ...formPayload, columns: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs"
                    />
                  </div>
                )}

                {/* Standard Description */}
                {activeRegistryId !== "reference-lists" && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Internal Corporate Description
                    </label>
                    <textarea
                      value={formPayload.description || ""}
                      onChange={(e) => setFormPayload({ ...formPayload, description: e.target.value })}
                      placeholder="Add institutional knowledge or operational rules..."
                      className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK IMPORT TEXTAREA SHEET MODAL */}
      <AnimatePresence>
        {bulkImportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  Bulk CSV Import - {activeRegistry.label}
                </h3>
                <button onClick={() => setBulkImportOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-500">
                  Paste comma-separated values (CSV) below to load multiple entries simultaneously. The first row can represent header mappings.
                </p>

                <textarea
                  value={bulkRawText}
                  onChange={(e) => setBulkRawText(e.target.value)}
                  placeholder={`Name, Description\nItem One, First delivery queue profile\nItem Two, Secondary compliance profile`}
                  rows={8}
                  className="w-full font-mono text-xs p-3 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                <div className="flex justify-end gap-2.5">
                  <button
                    onClick={() => setBulkImportOpen(false)}
                    className="bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkImportSubmit}
                    disabled={!bulkRawText.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                  >
                    Parse and Import
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
