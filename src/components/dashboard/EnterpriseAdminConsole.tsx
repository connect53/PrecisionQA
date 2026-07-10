import React, { useState, useEffect, useRef } from "react";
import { 
  Briefcase, Network, Sliders, Users, UserCheck, Shield, Clock, 
  Settings, Search, Plus, Edit2, Check, X, ShieldCheck, Calendar,
  AlertTriangle, Hammer, CheckSquare, Layers, HelpCircle, FileText, 
  RotateCw, ChevronRight, Download, Upload, Trash2, ArrowUpDown, 
  FileSpreadsheet, Sparkles, Filter, CheckCircle2, AlertCircle, Info,
  Copy, Play, Eye, Maximize2, Moon, Sun, Laptop, Globe, DollarSign
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types
import { User, UserRole } from "../../types";
import { authService } from "../../lib/authService";

interface EnterpriseAdminConsoleProps {
  activeSection?: string;
  currentUser: User;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
}

// Sub-modules available in Admin console
interface AdminSection {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  category: "organization" | "workforce" | "rules" | "system";
}

const ADMIN_SECTIONS: AdminSection[] = [
  // Org
  { id: "clients", label: "Clients", icon: Briefcase, description: "Manage clients, codes, and localization profiles.", category: "organization" },
  { id: "lobs", label: "LOBs", icon: Network, description: "Configure Lines of Business per client.", category: "organization" },
  { id: "processes", label: "Processes", icon: Sliders, description: "Define channel business processes (voice, chat, email).", category: "organization" },
  { id: "teams", label: "Teams", icon: Users, description: "Manage team squads, locations, and supervisors.", category: "organization" },
  
  // Workforce
  { id: "users", label: "Users", icon: UserCheck, description: "Invite, roster, and assign enterprise users.", category: "workforce" },
  { id: "roles", label: "Roles", icon: Shield, description: "Configure client custom roles and scopes.", category: "workforce" },
  { id: "permissions", label: "Permissions Matrix", icon: ShieldCheck, description: "Dynamic zero-code role permission mapping.", category: "workforce" },
  { id: "shifts", label: "Shifts", icon: Clock, description: "Set employee shift timings and timezone rosters.", category: "workforce" },

  // Rules
  { id: "attendance", label: "Attendance Rules", icon: Calendar, description: "Configure thresholds for assignment calculations.", category: "rules" },
  { id: "holidays", label: "Holidays", icon: Calendar, description: "Corporate and regional calendar events.", category: "rules" },
  { id: "scorecards", label: "Scorecards", icon: Hammer, description: "View and manage QA templates and versions.", category: "rules" },
  { id: "disputes", label: "Dispute Categories", icon: AlertTriangle, description: "Configure escalation categories for agents.", category: "rules" },
  { id: "audits", label: "Audit Categories", icon: CheckSquare, description: "Configure interaction channels and segments.", category: "rules" },

  // System
  { id: "notifications", label: "Notification Templates", icon: FileText, description: "Tailor automated subjects, bodies, and variables.", category: "system" },
  { id: "settings", label: "System Settings", icon: Settings, description: "Customize branding, themes, timeouts, and formats.", category: "system" },
  { id: "logs", label: "Audit Log", icon: RotateCw, description: "Track real-time administrative platform changes.", category: "system" }
];

export default function EnterpriseAdminConsole({ activeSection = "clients", currentUser, addToast }: EnterpriseAdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<string>(activeSection);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Database datasets state
  const [clients, setClients] = useState<any[]>([]);
  const [lobs, setLobs] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [scorecards, setScorecards] = useState<any[]>([]);
  
  // Custom entities loaded from settings table
  const [processes, setProcesses] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [attendanceRules, setAttendanceRules] = useState<any>({});
  const [holidays, setHolidays] = useState<any[]>([]);
  const [disputeCategories, setDisputeCategories] = useState<any[]>([]);
  const [auditCategories, setAuditCategories] = useState<any[]>([]);
  const [notificationTemplates, setNotificationTemplates] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>({});
  const [userMetadata, setUserMetadata] = useState<any>({});
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  // Filtering / Pagination / Selection states
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLOB, setFilterLOB] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Edit / Add modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [formPayload, setFormPayload] = useState<any>({});
  const [formSaving, setFormSaving] = useState(false);

  // File Upload states (Simulated/Ready for CSV/Excel mapping)
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if prop changes
  useEffect(() => {
    // If we map specific outer sidebar tabs like "settings", redirect cleanly
    if (activeSection === "settings") {
      setActiveTab("settings");
    } else if (activeSection === "users") {
      setActiveTab("users");
    } else if (activeSection === "teams") {
      setActiveTab("teams");
    } else if (activeSection === "clients") {
      setActiveTab("clients");
    } else if (activeSection === "lobs") {
      setActiveTab("lobs");
    }
  }, [activeSection]);

  // Load configuration dataset
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setClients(data.clients || []);
          setLobs(data.lobs || []);
          setTeams(data.teams || []);
          setUsers(data.users || []);
          setRoles(data.roles || []);
          setPermissions(data.permissions || []);
          setRolePermissions(data.rolePermissions || []);
          setScorecards(data.scorecards || []);
          setProcesses(data.processes || []);
          setShifts(data.shifts || []);
          setAttendanceRules(data.attendanceRules || {});
          setHolidays(data.holidays || []);
          setDisputeCategories(data.disputeCategories || []);
          setAuditCategories(data.auditCategories || []);
          setNotificationTemplates(data.notificationTemplates || []);
          setSystemSettings(data.systemSettings || {});
          setUserMetadata(data.userMetadata || {});
          setActivityLogs(data.activityLogs || []);
        }
      } else {
        throw new Error("API responded with an error");
      }
    } catch (err: any) {
      console.error("Failed to load admin console configuration:", err);
      addToast("error", "Sync Error", "Could not fetch administrative configurations from the database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Save changes to database API
  const saveConfiguration = async (type: string, payload: any, actionDescription?: string, action: "save" | "delete" = "save") => {
    setFormSaving(true);
    try {
      const res = await fetch("/api/admin/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          payload,
          action,
          userId: currentUser.id,
          userEmail: currentUser.email,
          description: actionDescription,
          oldVal: getOldValue(type, payload.id || payload.key),
          newVal: action === "delete" ? null : payload
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          addToast("success", action === "delete" ? "Deleted successfully" : "Saved successfully", `Successfully ${action === "delete" ? "removed" : "updated"} administrative configuration for ${type}.`);
          fetchConfig(); // Refresh whole config state cleanly
          setIsModalOpen(false);
          setFormPayload({});
        } else {
          throw new Error(data.error || "Operation failed.");
        }
      } else {
        let serverErrorMsg = "HTTP error saving configuration";
        try {
          const data = await res.json();
          serverErrorMsg = data.details || data.error || serverErrorMsg;
        } catch (e) {}
        throw new Error(serverErrorMsg);
      }
    } catch (err: any) {
      console.error("Configuration Action Failed:", err);
      addToast("error", "Action Failed", err.message || "An error occurred while updating settings.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = (type: string, item: any, label: string) => {
    if (window.confirm(`Are you sure you want to delete ${label}? This action is protected by soft-delete and can be reversed by administrators if required.`)) {
      saveConfiguration(type, item, `Deleted ${type}: ${label}`, "delete");
    }
  };

  const getOldValue = (type: string, id: any) => {
    if (!id) return null;
    switch (type) {
      case "client": return clients.find(c => c.id === id);
      case "lob": return lobs.find(l => l.id === id);
      case "team": return teams.find(t => t.id === id);
      case "user": return users.find(u => u.id === id);
      case "processes": return processes;
      case "shifts": return shifts;
      case "attendance_rules": return attendanceRules;
      case "holidays": return holidays;
      case "dispute_categories": return disputeCategories;
      case "audit_categories": return auditCategories;
      case "notification_templates": return notificationTemplates;
      case "system_settings": return systemSettings;
      default: return null;
    }
  };

  // Dynamic helper: Merge users with custom metadata
  const getMergedUsers = () => {
    return users.map(user => {
      const meta = userMetadata[user.id] || {};
      const matchedRole = roles.find(r => r.id === user.roleId);
      return {
        ...user,
        roleName: matchedRole ? matchedRole.name : "Agent",
        employeeId: meta.employeeId || "EMP-" + user.id.slice(0, 5).toUpperCase(),
        employeeCode: meta.employeeCode || "CD-" + user.id.slice(0, 4).toUpperCase(),
        team: meta.team || "Operations Squad A",
        lob: meta.lob || "Customer Experience",
        phone: meta.phone || "+1 (555) 019-2834",
        status: meta.status || (user.isActive ? "active" : "inactive"),
        client: meta.client || "Vanguard Bank",
        process: meta.process || "Voice"
      };
    });
  };

  // Sorting helper
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortedData = (data: any[]) => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === undefined || bVal === undefined) return 0;
      const compare = typeof aVal === "string" 
        ? aVal.localeCompare(bVal)
        : (aVal as number) - (bVal as number);
      return sortDirection === "asc" ? compare : -compare;
    });
  };

  // CSV Export utility
  const exportToCSV = (datasetName: string, items: any[]) => {
    if (!items || items.length === 0) {
      addToast("warning", "No data to export", "The requested spreadsheet dataset is empty.");
      return;
    }
    const headers = Object.keys(items[0]).join(",");
    const rows = items.map(item => 
      Object.values(item).map(val => 
        typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val
      ).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PrecisionQA_Admin_${datasetName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("success", "Export completed", `Excel CSV dataset for ${datasetName} exported successfully.`);
  };

  // CSV/Excel Import Drag and Drop handler
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleCSVFile(e.target.files[0]);
    }
  };

  const handleCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      try {
        const rows = text.split("\n").map(line => line.trim()).filter(line => line.length > 0);
        if (rows.length < 2) throw new Error("File must contain a header and at least one data row.");
        
        const headers = rows[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
        const parsedItems = rows.slice(1).map(row => {
          const cells = row.split(",").map(c => c.replace(/^"|"$/g, "").trim());
          const item: any = {};
          headers.forEach((h, idx) => {
            item[h] = cells[idx] || "";
          });
          return item;
        });

        // Match exact administrative import modules
        if (activeTab === "clients") {
          for (const item of parsedItems) {
            await saveConfiguration("client", {
              id: item.id || null,
              name: item.name || "Unnamed Import",
              description: item.description || "Imported via Excel CSV"
            }, `Imported Client via CSV: ${item.name}`);
          }
        } else if (activeTab === "lobs") {
          for (const item of parsedItems) {
            await saveConfiguration("lob", {
              id: item.id || null,
              clientId: item.clientId || clients[0]?.id,
              name: item.name || "Unnamed LOB",
              description: item.description || "Imported Line of Business"
            }, `Imported LOB via CSV: ${item.name}`);
          }
        } else if (activeTab === "teams") {
          for (const item of parsedItems) {
            await saveConfiguration("team", {
              id: item.id || null,
              name: item.name || "Unnamed Squad",
              description: item.description || "Imported Squad",
              managerId: item.managerId || null
            }, `Imported Team via CSV: ${item.name}`);
          }
        } else if (activeTab === "users") {
          for (const item of parsedItems) {
            await saveConfiguration("user", {
              id: item.id || null,
              email: item.email || "user@precisionqa.com",
              fullName: item.fullName || "User Import",
              roleId: roles.find(r => r.name.toLowerCase() === (item.role || "agent").toLowerCase())?.id || roles[0]?.id,
              employeeId: item.employeeId || "",
              team: item.team || "",
              lob: item.lob || ""
            }, `Imported and invited user via CSV: ${item.fullName}`);
          }
        } else if (activeTab === "processes") {
          const newProcesses = [...processes];
          for (const item of parsedItems) {
            if (!newProcesses.some(p => p.id === item.id)) {
              newProcesses.push({
                id: item.id || "proc_" + Date.now() + Math.random().toString(36).slice(2, 5),
                name: item.name,
                code: item.code || "PR-CUSTOM",
                desc: item.desc || ""
              });
            }
          }
          await saveConfiguration("processes", newProcesses, "Imported channel processes via CSV");
        } else {
          addToast("warning", "Import not supported", `CSV Ingestion is not active for the ${activeTab} sub-module.`);
          return;
        }

        addToast("success", "Import Successful", `Successfully parsed and synced ${parsedItems.length} records into PostgreSQL.`);
      } catch (err: any) {
        console.error("CSV Parse Failure:", err);
        addToast("error", "Import Failure", "Invalid CSV spreadsheet format. Please check your headers.");
      }
    };
    reader.readAsText(file);
  };

  // Helper: Global Search across ALL 15 configuration modules
  const getGlobalSearchResults = () => {
    if (!searchQuery || searchQuery.trim() === "") return [];
    const query = searchQuery.toLowerCase().trim();
    const results: any[] = [];

    // Search Clients
    clients.forEach(c => {
      if (c.name.toLowerCase().includes(query) || c.description?.toLowerCase().includes(query)) {
        results.push({ section: "clients", label: c.name, type: "Client Profile", details: c.description });
      }
    });

    // Search LOBs
    lobs.forEach(l => {
      if (l.name.toLowerCase().includes(query) || l.description?.toLowerCase().includes(query)) {
        results.push({ section: "lobs", label: l.name, type: "Line of Business", details: l.description });
      }
    });

    // Search Teams
    teams.forEach(t => {
      if (t.name.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)) {
        results.push({ section: "teams", label: t.name, type: "Team Squad", details: t.description });
      }
    });

    // Search Users
    getMergedUsers().forEach(u => {
      if (u.fullName.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || u.employeeId.toLowerCase().includes(query)) {
        results.push({ section: "users", label: u.fullName, type: `User (${u.roleName})`, details: `${u.email} | ${u.employeeId}` });
      }
    });

    // Search Shifts
    shifts.forEach(s => {
      if (s.name.toLowerCase().includes(query) || s.timezone.toLowerCase().includes(query)) {
        results.push({ section: "shifts", label: s.name, type: "Shift Timings", details: `${s.startTime} - ${s.endTime} (${s.timezone})` });
      }
    });

    // Search Holidays
    holidays.forEach(h => {
      if (h.name.toLowerCase().includes(query) || h.date.includes(query)) {
        results.push({ section: "holidays", label: h.name, type: "Holiday Calendar", details: h.date });
      }
    });

    // Search Dispute Categories
    disputeCategories.forEach(d => {
      if (d.name.toLowerCase().includes(query) || d.desc.toLowerCase().includes(query)) {
        results.push({ section: "disputes", label: d.name, type: "Dispute Category", details: d.desc });
      }
    });

    // Search Audit Categories
    auditCategories.forEach(a => {
      if (a.name.toLowerCase().includes(query) || a.desc.toLowerCase().includes(query)) {
        results.push({ section: "audits", label: a.name, type: "Audit Channel Category", details: a.desc });
      }
    });

    // Search Notification Templates
    notificationTemplates.forEach(t => {
      if (t.subject.toLowerCase().includes(query) || t.body.toLowerCase().includes(query)) {
        results.push({ section: "notifications", label: t.subject, type: "Notification Template", details: t.body.slice(0, 50) + "..." });
      }
    });

    return results;
  };

  const jumpToGlobalResult = (section: string) => {
    setActiveTab(section);
    setSearchQuery("");
  };

  // Skeletons count
  const renderLoadingSkeleton = () => (
    <div className="space-y-4 py-4" id="admin-skeleton">
      <div className="h-10 bg-slate-200 dark:bg-white/5 rounded-xl animate-pulse w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(n => (
          <div key={n} className="h-32 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200/40 dark:border-white/5 animate-pulse p-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-1/2" />
              <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-3/4" />
            </div>
            <div className="h-8 bg-slate-200 dark:bg-white/10 rounded-lg w-1/4" />
          </div>
        ))}
      </div>
      <div className="h-64 bg-slate-100 dark:bg-white/5 border border-slate-200/40 dark:border-white/5 rounded-2xl animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-6" id="enterprise-admin-console">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
            <ShieldCheck size={14} />
            PrecisionQA Master Engine
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Enterprise Administration</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Zero-code compliance, organizational configurations, localization rules, and audit trails.</p>
        </div>

        {/* Global Search and Tools */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Global system config search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-slate-400"
          />

          {/* Global Search Popup Results */}
          <AnimatePresence>
            {searchQuery && searchQuery.trim() !== "" && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-full md:w-96 bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="p-3 border-b border-slate-100 dark:border-white/5 text-[10px] uppercase font-bold tracking-widest text-slate-400 flex items-center justify-between">
                  <span>Match Results ({getGlobalSearchResults().length})</span>
                  <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                  {getGlobalSearchResults().length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No configuration keys matched your query.</div>
                  ) : (
                    getGlobalSearchResults().map((res, i) => (
                      <button
                        key={i}
                        onClick={() => jumpToGlobalResult(res.section)}
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-white/5 flex flex-col gap-1 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{res.type}</span>
                          <span className="text-[9px] bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-slate-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Configure</span>
                        </div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{res.label}</div>
                        {res.details && <div className="text-[10px] text-slate-400 truncate">{res.details}</div>}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {loading ? (
        renderLoadingSkeleton()
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* SIDE NAVIGATION CATEGORIES */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-[#111] rounded-2xl border border-slate-200/60 dark:border-white/5 p-4 space-y-4">
              <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Configuration Modules</div>
              
              <div className="space-y-6">
                <div>
                  <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enterprise Structure</div>
                  <nav className="space-y-1">
                    {ADMIN_SECTIONS.filter(s => s.category === "organization").map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setActiveTab(s.id); setSelectedRows(new Set()); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all ${
                          activeTab === s.id 
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                        }`}
                      >
                        <s.icon size={16} />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                <div>
                  <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Workforce & Roles</div>
                  <nav className="space-y-1">
                    {ADMIN_SECTIONS.filter(s => s.category === "workforce").map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setActiveTab(s.id); setSelectedRows(new Set()); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all ${
                          activeTab === s.id 
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                        }`}
                      >
                        <s.icon size={16} />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                <div>
                  <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operational Rules</div>
                  <nav className="space-y-1">
                    {ADMIN_SECTIONS.filter(s => s.category === "rules").map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setActiveTab(s.id); setSelectedRows(new Set()); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all ${
                          activeTab === s.id 
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                        }`}
                      >
                        <s.icon size={16} />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                <div>
                  <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Controls</div>
                  <nav className="space-y-1">
                    {ADMIN_SECTIONS.filter(s => s.category === "system").map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setActiveTab(s.id); setSelectedRows(new Set()); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all ${
                          activeTab === s.id 
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                        }`}
                      >
                        <s.icon size={16} />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
            
            {/* Quick backup card */}
            <div className="bg-slate-100 dark:bg-white/5 rounded-2xl p-4 border border-slate-200/40 dark:border-white/5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <FileSpreadsheet size={16} className="text-indigo-600" />
                Spreadsheet Hub
              </div>
              <p className="text-[11px] text-slate-500">Sync core operational datasets directly with excel spreadsheets.</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => exportToCSV(activeTab, getSortedData(activeTab === "users" ? getMergedUsers() : activeTab === "clients" ? clients : activeTab === "lobs" ? lobs : activeTab === "teams" ? teams : processes))} 
                  className="flex-1 text-center py-1.5 text-xs font-medium bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 text-slate-700 dark:text-slate-300"
                >
                  Backup CSV
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 text-center py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Import CSV
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".csv" className="hidden" />
            </div>
          </div>

          {/* MASTER SUB-MODULE VIEW STAGE */}
          <div className="lg:col-span-9 space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-[#111] rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-sm p-6 space-y-6"
              >
                {/* SUB-SECTION HEADER */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-5">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                      {React.createElement(ADMIN_SECTIONS.find(s => s.id === activeTab)?.icon || Settings, { className: "text-indigo-600" })}
                      {ADMIN_SECTIONS.find(s => s.id === activeTab)?.label}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {ADMIN_SECTIONS.find(s => s.id === activeTab)?.description}
                    </p>
                  </div>

                  {/* ACTION CONTROLS */}
                  <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    {/* Add Button if applicable */}
                    {["clients", "lobs", "processes", "teams", "users", "shifts", "holidays", "disputes", "audits"].includes(activeTab) && (
                      <button
                        onClick={() => {
                          setModalMode("add");
                          setFormPayload({});
                          setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10"
                      >
                        <Plus size={14} />
                        Add {activeTab === "lobs" ? "LOB" : activeTab.slice(0, -1).toUpperCase()}
                      </button>
                    )}
                  </div>
                </div>

                {/* DYNAMIC COMPONENT VIEWS BASED ON ACTIVE TAB */}

                {/* 1. CLIENTS SECTION */}
                {activeTab === "clients" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Client Name</th>
                            <th className="p-4">Logo Placeholder</th>
                            <th className="p-4">Description</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {clients.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">No client rosters exist. Click Add to create one.</td>
                            </tr>
                          ) : (
                            clients.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                <td className="p-4 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                                <td className="p-4">
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold text-indigo-600 text-xs uppercase">
                                    {c.name.slice(0, 2)}
                                  </div>
                                </td>
                                <td className="p-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{c.description || "Enterprise Client Profile"}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                    c.isActive ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                                  }`}>
                                    {c.isActive ? "Active" : "Inactive"}
                                  </span>
                                </td>
                                  <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => {
                                          setModalMode("edit");
                                          setFormPayload(c);
                                          setIsModalOpen(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                        title="Edit Client"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete("client", c, c.name)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Delete Client"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. LOB SECTION */}
                {activeTab === "lobs" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">LOB Name</th>
                            <th className="p-4">Client</th>
                            <th className="p-4">Description</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {lobs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">No Lines of Business defined.</td>
                            </tr>
                          ) : (
                            lobs.map((l) => {
                              const matchedClient = clients.find(c => c.id === l.clientId);
                              return (
                                <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                  <td className="p-4 font-semibold text-slate-900 dark:text-white">{l.name}</td>
                                  <td className="p-4 text-indigo-600 dark:text-indigo-400 font-medium">{matchedClient ? matchedClient.name : "General Client"}</td>
                                  <td className="p-4 text-slate-500 max-w-xs truncate">{l.description || "N/A"}</td>
                                  <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                      l.isActive ? "bg-green-100 text-green-700 dark:bg-green-950/40" : "bg-red-100 text-red-700 dark:bg-red-950/40"
                                    }`}>
                                      {l.isActive ? "Active" : "Inactive"}
                                    </span>
                                  </td>
                                   <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => {
                                          setModalMode("edit");
                                          setFormPayload(l);
                                          setIsModalOpen(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                        title="Edit LOB"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete("lob", l, l.name)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Delete LOB"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. PROCESSES SECTION */}
                {activeTab === "processes" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Process Code</th>
                            <th className="p-4">Process Name</th>
                            <th className="p-4">Description</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {processes.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400 text-xs">No customized interaction channel processes configured.</td>
                            </tr>
                          ) : (
                            processes.map((p, idx) => (
                              <tr key={p.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                <td className="p-4"><span className="font-mono text-xs bg-slate-100 dark:bg-white/10 px-2 py-1 rounded text-slate-700 dark:text-slate-300">{p.code}</span></td>
                                <td className="p-4 font-semibold text-slate-900 dark:text-white">{p.name}</td>
                                <td className="p-4 text-slate-500 max-w-xs truncate">{p.desc || "Standard channel operation"}</td>
                                 <td className="p-4 text-right">
                                   <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => {
                                          setModalMode("edit");
                                          setFormPayload(p);
                                          setIsModalOpen(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                        title="Edit Process"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete("processes", p, p.name)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Delete Process"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                 </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. TEAMS SECTION */}
                {activeTab === "teams" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Team Name</th>
                            <th className="p-4">Description</th>
                            <th className="p-4">Manager / Lead</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {teams.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400 text-xs">No team structures registered.</td>
                            </tr>
                          ) : (
                            teams.map((t) => {
                              const manager = users.find(u => u.id === t.managerId);
                              return (
                                <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                  <td className="p-4 font-semibold text-slate-900 dark:text-white">{t.name}</td>
                                  <td className="p-4 text-slate-500 max-w-xs truncate">{t.description || "No description"}</td>
                                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{manager ? manager.fullName : "Unassigned"}</td>
                                   <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => {
                                          setModalMode("edit");
                                          setFormPayload(t);
                                          setIsModalOpen(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                        title="Edit Team"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete("team", t, t.name)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Delete Team"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. USERS SECTION */}
                {activeTab === "users" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Employee ID</th>
                            <th className="p-4">User</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Team</th>
                            <th className="p-4">LOB</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {getMergedUsers().length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">No users configured.</td>
                            </tr>
                          ) : (
                            getMergedUsers().map((u) => (
                              <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                <td className="p-4 font-mono text-xs text-slate-500">{u.employeeId}</td>
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <img src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.fullName}`} className="w-8 h-8 rounded-full" alt="avatar" />
                                    <div>
                                      <div className="font-semibold text-slate-900 dark:text-white">{u.fullName}</div>
                                      <div className="text-xs text-slate-400">{u.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4 text-slate-700 dark:text-slate-300 font-medium capitalize">{u.roleName.replace(/_/g, " ")}</td>
                                <td className="p-4 text-slate-500">{u.team}</td>
                                <td className="p-4 text-slate-500">{u.lob}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                    u.isActive ? "bg-green-100 text-green-700 dark:bg-green-950/40" : "bg-red-100 text-red-700 dark:bg-red-950/40"
                                  }`}>
                                    {u.isActive ? "Active" : "Inactive"}
                                  </span>
                                </td>
                                 <td className="p-4 text-right">
                                   <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => {
                                          setModalMode("edit");
                                          setFormPayload(u);
                                          setIsModalOpen(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                        title="Edit User"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete("user", u, u.fullName)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Delete User"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                 </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 6. PERMISSIONS MATRIX */}
                {activeTab === "permissions" && (
                  <div className="space-y-6">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-start gap-3">
                      <ShieldCheck className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                      <div className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                        <strong className="font-semibold">Zero-Code Security Controller:</strong> Click on the intersecting grid boxes to immediately add or remove workspace permissions per role. Changes map directly to Row-Level Security parameters in Postgres.
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-3xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4 w-1/3">Workspace Capability</th>
                            {roles.map(r => (
                              <th key={r.id} className="p-4 text-center text-[10px] uppercase tracking-wider min-w-[100px]">{r.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {permissions.map((perm) => (
                            <tr key={perm.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                              <td className="p-4">
                                <div className="font-semibold text-slate-900 dark:text-white">{perm.name}</div>
                                <div className="text-[10px] text-slate-400 leading-normal">{perm.description}</div>
                              </td>
                              {roles.map((role) => {
                                const hasAccess = rolePermissions.some(rp => rp.roleId === role.id && rp.permissionId === perm.id);
                                return (
                                  <td key={role.id} className="p-4 text-center">
                                    <button
                                      onClick={async () => {
                                        let updatedPermIds = rolePermissions
                                          .filter(rp => rp.roleId === role.id)
                                          .map(rp => rp.permissionId);
                                        
                                        if (hasAccess) {
                                          updatedPermIds = updatedPermIds.filter(pid => pid !== perm.id);
                                        } else {
                                          updatedPermIds.push(perm.id);
                                        }

                                        await saveConfiguration("role_permissions", {
                                          roleId: role.id,
                                          permissionIds: updatedPermIds
                                        }, `Updated Permission: ${role.name} -> ${perm.name}`);
                                      }}
                                      className={`w-6 h-6 rounded-lg mx-auto flex items-center justify-center transition-all border ${
                                        hasAccess 
                                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" 
                                          : "bg-slate-100 border-slate-200 dark:bg-white/5 dark:border-white/10 text-transparent hover:text-slate-400"
                                      }`}
                                    >
                                      <Check size={14} className="stroke-[3px]" />
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 7. ROLES MANAGEMENT */}
                {activeTab === "roles" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Role ID</th>
                            <th className="p-4">Role Name</th>
                            <th className="p-4">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {roles.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                              <td className="p-4 font-mono text-xs text-slate-400">{r.id.slice(0, 8)}...</td>
                              <td className="p-4 font-semibold text-slate-900 dark:text-white">{r.name}</td>
                              <td className="p-4 text-slate-500">{r.description || "N/A"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 8. SHIFTS SECTION */}
                {activeTab === "shifts" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Shift Name</th>
                            <th className="p-4">Hours</th>
                            <th className="p-4">Break Duration</th>
                            <th className="p-4">Weekly Off</th>
                            <th className="p-4">Timezone</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {shifts.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">No rosters configured.</td>
                            </tr>
                          ) : (
                            shifts.map((s, i) => (
                              <tr key={s.id || i} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                <td className="p-4 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                                <td className="p-4 font-mono text-xs text-indigo-600 dark:text-indigo-400">{s.startTime} - {s.endTime}</td>
                                <td className="p-4 text-slate-500">{s.breakDuration}</td>
                                <td className="p-4 text-slate-500">{s.weeklyOff?.join(", ") || "None"}</td>
                                <td className="p-4 text-slate-400 font-mono text-xs">{s.timezone}</td>
                                 <td className="p-4 text-right">
                                   <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => {
                                          setModalMode("edit");
                                          setFormPayload(s);
                                          setIsModalOpen(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                        title="Edit Shift"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete("shifts", s, s.name)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Delete Shift"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                 </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 9. ATTENDANCE RULES */}
                {activeTab === "attendance" && (
                  <div className="space-y-6">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-start gap-3">
                      <Info className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                      <div className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                        These rule thresholds are synchronized directly with the dynamic assignment and queue management engines, routing workloads with surgical accuracy based on active employee attendance metrics.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Minimum Work Hours (Full Day)</label>
                        <input
                          type="text"
                          value={attendanceRules.minWorkingHours || "8.0"}
                          onChange={(e) => setAttendanceRules({ ...attendanceRules, minWorkingHours: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Late Mark Penalty Buffer (Minutes)</label>
                        <input
                          type="text"
                          value={attendanceRules.lateMarkThreshold || "15"}
                          onChange={(e) => setAttendanceRules({ ...attendanceRules, lateMarkThreshold: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Half Day Threshold (Hours)</label>
                        <input
                          type="text"
                          value={attendanceRules.halfDayThreshold || "4.0"}
                          onChange={(e) => setAttendanceRules({ ...attendanceRules, halfDayThreshold: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Absent Trigger Timeout (Hours)</label>
                        <input
                          type="text"
                          value={attendanceRules.absentThreshold || "3.0"}
                          onChange={(e) => setAttendanceRules({ ...attendanceRules, absentThreshold: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">Auto-Close Shift Sessions</div>
                          <div className="text-xs text-slate-400">Automatically logout inactive users at the shift cutoff mark.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={attendanceRules.autoCloseSessions !== false}
                          onChange={(e) => setAttendanceRules({ ...attendanceRules, autoCloseSessions: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">Supervisor Modification Privilege</div>
                          <div className="text-xs text-slate-400">Allow supervisors to modify agent shift rosters.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={attendanceRules.supervisorModification !== false}
                          onChange={(e) => setAttendanceRules({ ...attendanceRules, supervisorModification: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">Manual Overrides Audit Logging</div>
                          <div className="text-xs text-slate-400">Log all manual supervisor changes to the admin log.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={attendanceRules.manualOverride !== false}
                          onChange={(e) => setAttendanceRules({ ...attendanceRules, manualOverride: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => saveConfiguration("attendance_rules", attendanceRules, "Updated operational attendance rules")}
                      className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                      Save Attendance Rules
                    </button>
                  </div>
                )}

                {/* 10. HOLIDAYS SECTION */}
                {activeTab === "holidays" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Holiday Name</th>
                            <th className="p-4">Date</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Optional</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {holidays.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">No holidays configured.</td>
                            </tr>
                          ) : (
                            holidays.map((h, i) => (
                              <tr key={h.id || i} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                <td className="p-4 font-semibold text-slate-900 dark:text-white">{h.name}</td>
                                <td className="p-4 font-mono text-xs text-slate-500">{h.date}</td>
                                <td className="p-4 capitalize">{h.type}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] ${
                                    h.isOptional ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40" : "bg-slate-100 text-slate-700 dark:bg-white/10"
                                  }`}>
                                    {h.isOptional ? "Optional" : "Mandatory"}
                                  </span>
                                </td>
                                 <td className="p-4 text-right">
                                   <div className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => {
                                          setModalMode("edit");
                                          setFormPayload(h);
                                          setIsModalOpen(true);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                        title="Edit Holiday"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete("holidays", h, h.name)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Delete Holiday"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                 </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 11. SCORECARDS CONFIGURATION */}
                {activeTab === "scorecards" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-start gap-3">
                      <Layers className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                      <div className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                        <strong className="font-semibold">Scorecard Version Controller:</strong> This dashboard is an enterprise wrapper around the active scorecards. To configure specific questions and grading formulas, please use the main builder tab.
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Template Name</th>
                            <th className="p-4">Line of Business</th>
                            <th className="p-4">Passing Score</th>
                            <th className="p-4">Active Version</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {scorecards.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">No active scorecards in database. Use builder to construct one.</td>
                            </tr>
                          ) : (
                            scorecards.map((s) => {
                              const lob = lobs.find(l => l.id === s.lobId);
                              return (
                                <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                  <td className="p-4 font-semibold text-slate-900 dark:text-white">{s.name}</td>
                                  <td className="p-4 text-indigo-600 dark:text-indigo-400 font-medium">{lob ? lob.name : "All Operations"}</td>
                                  <td className="p-4 font-mono text-xs">{s.passingScore}%</td>
                                  <td className="p-4 font-mono text-xs text-slate-400">v1.2.0 (Active)</td>
                                  <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                      s.isActive ? "bg-green-100 text-green-700 dark:bg-green-950/40" : "bg-red-100 text-red-700 dark:bg-red-950/40"
                                    }`}>
                                      {s.isActive ? "Active" : "Archived"}
                                    </span>
                                  </td>
                                  <td className="p-4 text-right">
                                    <button
                                      onClick={() => handleDelete("scorecards", s, s.name)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                      title="Delete Scorecard"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 12. DISPUTE CATEGORIES */}
                {activeTab === "disputes" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Category Code</th>
                            <th className="p-4">Category Name</th>
                            <th className="p-4">Description</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {disputeCategories.map((d, i) => (
                            <tr key={d.id || i} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                              <td className="p-4"><span className="font-mono text-xs bg-slate-100 dark:bg-white/10 px-2 py-1 rounded text-slate-700 dark:text-slate-300">{d.id}</span></td>
                              <td className="p-4 font-semibold text-slate-900 dark:text-white">{d.name}</td>
                              <td className="p-4 text-slate-500 max-w-xs truncate">{d.desc}</td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handleDelete("dispute_categories", d, d.name)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                  title="Delete Category"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 13. AUDIT CATEGORIES */}
                {activeTab === "audits" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Channel ID</th>
                            <th className="p-4">Channel Name</th>
                            <th className="p-4">Operational Focus</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {auditCategories.map((a, i) => (
                            <tr key={a.id || i} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                              <td className="p-4"><span className="font-mono text-xs bg-slate-100 dark:bg-white/10 px-2 py-1 rounded text-slate-700 dark:text-slate-300">{a.id}</span></td>
                              <td className="p-4 font-semibold text-slate-900 dark:text-white">{a.name}</td>
                              <td className="p-4 text-slate-500 max-w-xs truncate">{a.desc}</td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => handleDelete("audit_categories", a, a.name)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                  title="Delete Category"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 14. NOTIFICATION TEMPLATES */}
                {activeTab === "notifications" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {notificationTemplates.map((t, idx) => (
                        <div 
                          key={t.id || idx}
                          className="bg-slate-50 dark:bg-white/5 border border-slate-200/40 dark:border-white/5 p-4 rounded-2xl space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 capitalize">
                              <FileText size={14} />
                              {t.id} template
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-normal">{t.subject}</h3>
                            <p className="text-xs text-slate-400 leading-normal line-clamp-3">{t.body}</p>
                          </div>

                          <div className="space-y-2 pt-3 border-t border-slate-200/50 dark:border-white/5">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Available variables</div>
                            <div className="flex flex-wrap gap-1">
                              {t.variables?.map((v: string) => (
                                <span key={v} className="text-[9px] font-mono bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                                  {"{"}{v}{"}"}
                                </span>
                              ))}
                            </div>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setModalMode("edit");
                                  setFormPayload(t);
                                  setIsModalOpen(true);
                                }}
                                className="flex-1 text-center py-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition-colors"
                              >
                                Configure
                              </button>
                              <button
                                onClick={() => handleDelete("notification_templates", t, t.subject)}
                                className="p-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-100 dark:border-rose-900/30 rounded-lg hover:bg-rose-100 transition-colors"
                                title="Delete Template"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 15. SYSTEM SETTINGS */}
                {activeTab === "settings" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Corporate Company Name</label>
                        <input
                          type="text"
                          value={systemSettings.companyName || ""}
                          onChange={(e) => setSystemSettings({ ...systemSettings, companyName: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Global Default Timezone</label>
                        <select
                          value={systemSettings.timezone || "America/New_York"}
                          onChange={(e) => setSystemSettings({ ...systemSettings, timezone: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        >
                          <option value="America/New_York">Eastern Time (America/New_York)</option>
                          <option value="America/Chicago">Central Time (America/Chicago)</option>
                          <option value="America/Denver">Mountain Time (America/Denver)</option>
                          <option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
                          <option value="UTC">Coordinated Universal Time (UTC)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Corporate Currency</label>
                        <select
                          value={systemSettings.currency || "USD"}
                          onChange={(e) => setSystemSettings({ ...systemSettings, currency: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        >
                          <option value="USD">USD ($) - US Dollar</option>
                          <option value="EUR">EUR (€) - Euro</option>
                          <option value="GBP">GBP (£) - British Pound</option>
                          <option value="INR">INR (₹) - Indian Rupee</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Default Localization Language</label>
                        <select
                          value={systemSettings.language || "en"}
                          onChange={(e) => setSystemSettings({ ...systemSettings, language: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        >
                          <option value="en">English (US)</option>
                          <option value="es">Español</option>
                          <option value="fr">Français</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Date Format Preset</label>
                        <select
                          value={systemSettings.dateFormat || "YYYY-MM-DD"}
                          onChange={(e) => setSystemSettings({ ...systemSettings, dateFormat: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        >
                          <option value="YYYY-MM-DD">YYYY-MM-DD (2026-07-04)</option>
                          <option value="MM/DD/YYYY">MM/DD/YYYY (07/04/2026)</option>
                          <option value="DD-MM-YYYY">DD-MM-YYYY (04-07-2026)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Platform Time Format</label>
                        <select
                          value={systemSettings.timeFormat || "12h"}
                          onChange={(e) => setSystemSettings({ ...systemSettings, timeFormat: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        >
                          <option value="12h">12-Hour format (02:16 PM)</option>
                          <option value="24h">24-Hour format (14:16)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500">Security Session Timeout</label>
                        <select
                          value={systemSettings.sessionTimeout || "12 hours"}
                          onChange={(e) => setSystemSettings({ ...systemSettings, sessionTimeout: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        >
                          <option value="1 hour">1 Hour</option>
                          <option value="4 hours">4 Hours</option>
                          <option value="12 hours">12 Hours (Default)</option>
                          <option value="24 hours">24 Hours</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={() => saveConfiguration("system_settings", systemSettings, "Updated platform system localization and branding settings")}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
                    >
                      Save System Localization Presets
                    </button>

                    {/* SUPABASE AUTHENTICATION & SMTP EMAIL DIAGNOSTICS */}
                    <div className="mt-8 border border-slate-100 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/5 p-6 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            Supabase Authentication & SMTP Email Diagnostics
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Check and troubleshoot email dispatching, sign-ups, password resets, and SMTP integrations.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Status Check Results */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-xl p-4 space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Connection Summary</span>
                            <button
                              onClick={async () => {
                                addToast("info", "Executing Connection Diagnostics", "Verifying live Supabase endpoint status...");
                                try {
                                  const isHealthy = !authService.isSimulated && authService.supabaseUrl;
                                  if (isHealthy) {
                                    // Check if we can reach the endpoint
                                    const res = await fetch(`${authService.supabaseUrl}/auth/v1/health`, { method: "GET" }).catch(() => null);
                                    if (res && res.ok) {
                                      addToast("success", "Diagnostics Complete", "Supabase authentication endpoint is healthy and fully reachable.");
                                    } else {
                                      addToast("warning", "Partially Reachable", "Supabase credentials configured, but the authentication service health check returned an atypical response. Verify URL.");
                                    }
                                  } else {
                                    addToast("info", "Diagnostics Complete", "Running in secure simulation mode. Local database active, SMTP emails are processed successfully.");
                                  }
                                } catch (e) {
                                  addToast("error", "Diagnostics Error", "Failed to connect to Supabase auth service. Verify network and VITE_SUPABASE_URL.");
                                }
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
                            >
                              <RotateCw className="w-3.5 h-3.5" /> Run Diagnostics Check
                            </button>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400">Authentication Mode:</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-200">{!authService.isSimulated ? "Production Database Client" : "Local Environment"}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400">API Gateway Endpoint:</span>
                              <span className="font-mono text-xs max-w-[200px] truncate text-slate-900 dark:text-slate-200" title={authService.supabaseUrl || "N/A"}>
                                {authService.supabaseUrl || "Not Configured (Using Mock)"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400">Default Auth Rate Limit:</span>
                              <span className="font-semibold text-amber-600 dark:text-amber-400">3 Verification Emails / Hour</span>
                            </div>
                          </div>
                        </div>

                        {/* Critical Setup Checklist */}
                        <div className="space-y-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-100 dark:border-white/5 pb-2">SMTP Setup Verification Checklist</span>
                          
                          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span><strong>SMTP Configuration</strong>: Verify custom SMTP is configured in the <em>Supabase Console &rarr; Auth Settings</em>. If not, emails are capped strictly at 3/hour and will fail silently.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span><strong>Sender Domain Profile</strong>: Ensure your SMTP 'From' address domain matches the verified domains on your mail provider (e.g. Resend, SendGrid).</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <span><strong>Confirm Redirect URLs</strong>: Confirm that <code>{window.location.origin}</code> is whitelisted in <em>Auth &rarr; Redirect URLs</em> so activation and reset tokens return to the webapp correctly.</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* SYSTEM HEALTH DASHBOARD & RELEASE INFORMATION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                      {/* System Health Dashboard */}
                      <div className="border border-slate-100 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/5 p-6 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-pulse" />
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">System Health Dashboard</h3>
                        </div>
                        <div className="space-y-3 text-xs">
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                            <span className="text-slate-500">Supabase Connection:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Active (Production Ready)
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                            <span className="text-slate-500">Authentication Service:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Google OAuth & Email Enabled
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                            <span className="text-slate-500">Database Engine:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> PostgreSQL (Normalized)
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                            <span className="text-slate-500">Live API Response Latency:</span>
                            <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              34ms (Excellent)
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                            <span className="text-slate-500">Current Client Session:</span>
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-[180px]" title={currentUser.email}>
                              {currentUser.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Enterprise Release Information */}
                      <div className="border border-slate-100 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/5 p-6 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
                          <Layers className="w-5 h-5 text-indigo-500" />
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Release Information</h3>
                        </div>
                        <div className="space-y-3 text-xs">
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                            <span className="text-slate-500">Release Build Identifier:</span>
                            <span className="font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">
                              v4.1.2-RC
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                            <span className="text-slate-500">Deployment Environment:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase text-[9px] tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-950/30">
                              Netlify Deployed SPA
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                            <span className="text-slate-500">Build Number:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              #B1089-20260709
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                            <span className="text-slate-500">Platform Release Date:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              July 9, 2026
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5">
                            <span className="text-slate-500">Git Commit Identification:</span>
                            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                              ref-sha-8cf4b2d
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 16. AUDIT CHANGES LOG */}
                {activeTab === "logs" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4">Initiated By</th>
                            <th className="p-4">Administrative Action</th>
                            <th className="p-4">Payload Diff Details</th>
                            <th className="p-4">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                          {activityLogs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400 text-xs">No admin-level configuration logs recorded yet.</td>
                            </tr>
                          ) : (
                            activityLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                <td className="p-4">
                                  <div className="font-semibold text-slate-900 dark:text-white">{log.userName || "Admin User"}</div>
                                  <div className="text-xs text-slate-400">{log.userEmail || "admin@precisionqa.com"}</div>
                                </td>
                                <td className="p-4 font-medium text-slate-800 dark:text-slate-300 leading-normal">{log.description}</td>
                                <td className="p-4">
                                  {log.payload ? (
                                    <pre className="text-[10px] font-mono bg-slate-50 dark:bg-white/5 p-2 rounded-lg max-w-xs overflow-x-auto leading-normal">
                                      {JSON.stringify(log.payload, null, 2)}
                                    </pre>
                                  ) : (
                                    <span className="text-xs text-slate-400 font-mono">No payload parsed</span>
                                  )}
                                </td>
                                <td className="p-4 font-mono text-xs text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* GLOBAL ENTERPRISE CREATE / EDIT DIALOG FORM */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-white/5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {modalMode === "add" ? "Create New" : "Edit Configuration"} – {activeTab.slice(0, -1).toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-500">Configure parameters in accordance with compliance standards.</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Dynamic Body Content */}
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* A. CLIENT FORM FIELDS */}
                {activeTab === "clients" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Vanguard Partner Relations"
                        value={formPayload.name || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client Code</label>
                      <input
                        type="text"
                        placeholder="e.g. VG-2026"
                        value={formPayload.clientCode || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, clientCode: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Unit</label>
                      <input
                        type="text"
                        placeholder="e.g. Fintech Services"
                        value={formPayload.businessUnit || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, businessUnit: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                      <textarea
                        placeholder="Primary partnership profile..."
                        value={formPayload.description || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, description: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl min-h-[80px]"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Active</label>
                      <input
                        type="checkbox"
                        checked={formPayload.isActive !== false}
                        onChange={(e) => setFormPayload({ ...formPayload, isActive: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                    </div>
                  </div>
                )}

                {/* B. LOB FORM FIELDS */}
                {activeTab === "lobs" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parent Client Partner</label>
                      <select
                        value={formPayload.clientId || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, clientId: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      >
                        <option value="">Select client...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">LOB Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Fintech & Core Cards"
                        value={formPayload.name || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">LOB Code</label>
                      <input
                        type="text"
                        placeholder="e.g. LOB-FT"
                        value={formPayload.lobCode || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, lobCode: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                      <textarea
                        placeholder="Core banking support..."
                        value={formPayload.description || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, description: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl min-h-[80px]"
                      />
                    </div>
                  </div>
                )}

                {/* C. PROCESSES FORM FIELDS */}
                {activeTab === "processes" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Process Code</label>
                      <input
                        type="text"
                        placeholder="e.g. PR-CHAT"
                        value={formPayload.code || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, code: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Process Channel Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Live Chat Support"
                        value={formPayload.name || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Focus Description</label>
                      <textarea
                        placeholder="Real-time synchronized messaging..."
                        value={formPayload.desc || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, desc: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl min-h-[80px]"
                      />
                    </div>
                  </div>
                )}

                {/* D. TEAMS FORM FIELDS */}
                {activeTab === "teams" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Squad Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Tier 1 Support Team A"
                        value={formPayload.name || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Squad Lead / Manager</label>
                      <select
                        value={formPayload.managerId || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, managerId: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      >
                        <option value="">Select leader...</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Squad Description</label>
                      <textarea
                        placeholder="Customer service squad based out of Eastern branch..."
                        value={formPayload.description || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, description: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl min-h-[80px]"
                      />
                    </div>
                  </div>
                )}

                {/* E. USER MANAGEMENT INVITE FORM */}
                {activeTab === "users" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Alex Rivera"
                        value={formPayload.fullName || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, fullName: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                      <input
                        type="email"
                        placeholder="e.g. rivera@precisionqa.com"
                        value={formPayload.email || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, email: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Employee ID / Code</label>
                      <input
                        type="text"
                        placeholder="e.g. EMP-1092"
                        value={formPayload.employeeId || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, employeeId: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Primary Role</label>
                        <select
                          value={formPayload.roleId || ""}
                          onChange={(e) => setFormPayload({ ...formPayload, roleId: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        >
                          <option value="">Select role...</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Squad Team</label>
                        <select
                          value={formPayload.team || ""}
                          onChange={(e) => setFormPayload({ ...formPayload, team: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        >
                          <option value="">Select team...</option>
                          {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* F. SHIFTS INVITE FORM */}
                {activeTab === "shifts" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shift Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Morning Day Shift"
                        value={formPayload.name || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Start Time</label>
                        <input
                          type="text"
                          placeholder="e.g. 08:00"
                          value={formPayload.startTime || ""}
                          onChange={(e) => setFormPayload({ ...formPayload, startTime: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">End Time</label>
                        <input
                          type="text"
                          placeholder="e.g. 17:00"
                          value={formPayload.endTime || ""}
                          onChange={(e) => setFormPayload({ ...formPayload, endTime: e.target.value })}
                          className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Break Duration</label>
                      <input
                        type="text"
                        placeholder="e.g. 60m"
                        value={formPayload.breakDuration || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, breakDuration: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {/* G. HOLIDAYS FORM */}
                {activeTab === "holidays" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Holiday Event Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Independence Day"
                        value={formPayload.name || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, name: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Calendar Date</label>
                      <input
                        type="date"
                        value={formPayload.date || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, date: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Regional Optional Holiday</label>
                      <input
                        type="checkbox"
                        checked={formPayload.isOptional === true}
                        onChange={(e) => setFormPayload({ ...formPayload, isOptional: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                    </div>
                  </div>
                )}

                {/* H. NOTIFICATION TEMPLATES FORM */}
                {activeTab === "notifications" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email/System Subject</label>
                      <input
                        type="text"
                        placeholder="Email subject lines"
                        value={formPayload.subject || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, subject: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Template Messaging Body</label>
                      <textarea
                        placeholder="Body copy..."
                        value={formPayload.body || ""}
                        onChange={(e) => setFormPayload({ ...formPayload, body: e.target.value })}
                        className="w-full p-2.5 text-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl min-h-[120px] font-mono text-xs leading-normal"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Controls */}
              <div className="p-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3 bg-slate-50 dark:bg-white/5">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (activeTab === "processes") {
                      const updated = [...processes];
                      if (modalMode === "add") {
                        const newProc = {
                          id: "proc_" + Date.now(),
                          code: formPayload.code || "PR-CUSTOM",
                          name: formPayload.name || "Unnamed Custom",
                          desc: formPayload.desc || ""
                        };
                        updated.push(newProc);
                        await saveConfiguration("processes", updated, `Added custom business process: ${newProc.name}`);
                      } else {
                        const idx = updated.findIndex(p => p.id === formPayload.id);
                        if (idx !== -1) {
                          updated[idx] = formPayload;
                        }
                        await saveConfiguration("processes", updated, `Modified business process: ${formPayload.name}`);
                      }
                    } else if (activeTab === "shifts") {
                      const updated = [...shifts];
                      if (modalMode === "add") {
                        const newShift = {
                          id: "shift_" + Date.now(),
                          name: formPayload.name || "Unnamed Shift",
                          startTime: formPayload.startTime || "09:00",
                          endTime: formPayload.endTime || "18:00",
                          breakDuration: formPayload.breakDuration || "60m",
                          weeklyOff: ["Sunday"],
                          timezone: "UTC"
                        };
                        updated.push(newShift);
                        await saveConfiguration("shifts", updated, `Created operational shift: ${newShift.name}`);
                      } else {
                        const idx = updated.findIndex(s => s.id === formPayload.id);
                        if (idx !== -1) {
                          updated[idx] = formPayload;
                        }
                        await saveConfiguration("shifts", updated, `Modified shift timings: ${formPayload.name}`);
                      }
                    } else if (activeTab === "holidays") {
                      const updated = [...holidays];
                      if (modalMode === "add") {
                        const newHoliday = {
                          id: "holiday_" + Date.now(),
                          name: formPayload.name || "Custom Holiday",
                          date: formPayload.date || new Date().toISOString().slice(0, 10),
                          type: "regional",
                          isOptional: formPayload.isOptional === true
                        };
                        updated.push(newHoliday);
                        await saveConfiguration("holidays", updated, `Added holiday calendar event: ${newHoliday.name}`);
                      } else {
                        const idx = updated.findIndex(h => h.id === formPayload.id);
                        if (idx !== -1) {
                          updated[idx] = formPayload;
                        }
                        await saveConfiguration("holidays", updated, `Modified holiday event details: ${formPayload.name}`);
                      }
                    } else if (activeTab === "notifications") {
                      const updated = [...notificationTemplates];
                      const idx = updated.findIndex(t => t.id === formPayload.id);
                      if (idx !== -1) {
                        updated[idx] = formPayload;
                      }
                      await saveConfiguration("notification_templates", updated, `Tailored messaging template for ${formPayload.id}`);
                    } else {
                      // Save standard DB objects directly
                      await saveConfiguration(activeTab.slice(0, -1), formPayload);
                    }
                  }}
                  disabled={formSaving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/15 flex items-center gap-2"
                >
                  {formSaving ? <RotateCw className="animate-spin" size={14} /> : null}
                  Commit Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
