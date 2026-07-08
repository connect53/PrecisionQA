import React, { useState, useEffect, useMemo } from "react";
import { 
  LayoutDashboard, Upload, Clock, CheckSquare, ScrollText, 
  Hammer, Layers, MessageSquare, AlertTriangle, BarChart3, 
  UserCheck, Users, Briefcase, Network, Settings,
  Search, Bell, Moon, Sun, ChevronDown, Check,
  Sparkles, X, Plus, LogOut, PanelLeftClose, PanelLeft,
  Command, ChevronRight, FileText, Share2, Building2, FileSpreadsheet,
  GitBranch, Database
} from "lucide-react";
import { User, UserRole } from "../../types";
import { ErrorBoundary } from "../ErrorBoundary";
import { motion, AnimatePresence } from "motion/react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import AuditWorkspace from "./AuditWorkspace";
import DashboardHome from "./DashboardHome";
import GoogleSheetsImporter from "./GoogleSheetsImporter";
import GoogleSheetReader from "./GoogleSheetReader";
import AssignmentQueue from "./AssignmentQueue";
import { PageHeader, EmptyState, StatusBadge } from "./ReusableComponents";
import AuditQueue from "./AuditQueue";
import AgentFeedback from "./AgentFeedback";
import AgentDisputes from "./AgentDisputes";
import EnterpriseAdminConsole from "./EnterpriseAdminConsole";
import PrecisionFormStudio from "./PrecisionFormStudio";
import WorkflowStudio from "./WorkflowStudio";
import MasterDataHub from "./MasterDataHub";

interface DashboardShellProps {
  currentUser: User;
  onOpenProfile: () => void;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
  onLogout: () => void;
}

interface NavSubItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
}

interface NavCategory {
  title: string;
  id: string;
  items: NavSubItem[];
}

export default function DashboardShell({ currentUser, onOpenProfile, addToast, onLogout }: DashboardShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive activeTab from URL
  const activeTab = useMemo(() => {
    const parts = location.pathname.split("/");
    const lastPart = parts[parts.length - 1];
    const secondToLastPart = parts[parts.length - 2];
    
    if (secondToLastPart === "audit") return "audit-workspace";
    return lastPart || "dashboard";
  }, [location.pathname]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState("PrecisionQA Enterprise");
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkTheme]);

  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchRealNotifications = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      // Log as a warning instead of an error to prevent false-alarm automated crash/error monitoring alerts in development/restart flows.
      console.warn("Could not fetch real-time notifications (background poll):", err);
    }
  };

  useEffect(() => {
    fetchRealNotifications();
    const interval = setInterval(fetchRealNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const markAsRead = async (id: string | number) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      console.warn("Failed to mark notification as read:", err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const navCategories: NavCategory[] = [
    {
      title: "Audit Operations",
      id: "audit",
      items: [
        { id: "import", label: "Import Cases", icon: Upload },
        { id: "assignment", label: "Assignment Queue", icon: Clock },
        { id: "audit-queue", label: "Audit Queue", icon: CheckSquare },
        { id: "completed", label: "Completed Audits", icon: ScrollText }
      ]
    },
    {
      title: "Scorecards",
      id: "scorecards",
      items: [
        { id: "form-studio", label: "Precision Form Studio", icon: Hammer },
        { id: "templates", label: "Templates", icon: Layers }
      ]
    },
    {
      title: "Feedback",
      id: "feedback",
      items: [
        { id: "agent-feedback", label: "Feedback", icon: MessageSquare },
        { id: "disputes", label: "Disputes", icon: AlertTriangle }
      ]
    },
    {
      title: "Reports",
      id: "reports",
      items: [
        { id: "qa-reports", label: "QA Reports", icon: BarChart3 },
        { id: "agent-perf", label: "Agent Reports", icon: UserCheck },
        { id: "team-perf", label: "Team Reports", icon: Users }
      ]
    },
    {
      title: "Administration",
      id: "admin",
      items: [
        { id: "users", label: "Users", icon: UserCheck },
        { id: "settings", label: "Settings", icon: Settings }
      ]
    }
  ];

  // Native database notifications handles markAsRead directly

  const getBreadcrumbs = () => {
    if (activeTab === "dashboard") return ["PrecisionQA", "Dashboard"];
    for (const cat of navCategories) {
      const match = cat.items.find(item => item.id === activeTab);
      if (match) return ["PrecisionQA", cat.title, match.label];
    }
    return ["PrecisionQA", activeTab];
  };

  const getActiveTitle = () => {
    if (activeTab === "dashboard") return "Dashboard";
    for (const cat of navCategories) {
      const match = cat.items.find(item => item.id === activeTab);
      if (match) return match.label;
    }
    return activeTab;
  };

  // Shared classes based on theme
  const bgMain = isDarkTheme ? "bg-[#0A0A0A]" : "bg-white";
  const bgSidebar = isDarkTheme ? "bg-[#111111]" : "bg-[#F9FAFB]";
  const borderCol = isDarkTheme ? "border-white/10" : "border-slate-200";
  const textMain = isDarkTheme ? "text-slate-100" : "text-slate-900";
  const textMuted = isDarkTheme ? "text-slate-400" : "text-slate-500";
  const itemHover = isDarkTheme ? "hover:bg-white/5" : "hover:bg-slate-200/50";
  const activeItem = isDarkTheme ? "bg-white/10 text-white" : "bg-white shadow-sm border border-slate-200/60 text-indigo-700";

  // Navigation permission logic
  const filteredNavCategories = navCategories.map(cat => ({
    ...cat,
    items: cat.items.filter(item => {
      const role = currentUser.role;
      if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) return true;
      
      const permissions: Record<string, UserRole[]> = {
        "import": [UserRole.QA_MANAGER, UserRole.TEAM_LEADER],
        "assignment": [UserRole.QA_MANAGER, UserRole.TEAM_LEADER],
        "audit-queue": [UserRole.QA_MANAGER, UserRole.QA_AUDITOR, UserRole.TEAM_LEADER],
        "completed": [UserRole.QA_MANAGER, UserRole.QA_AUDITOR, UserRole.TEAM_LEADER, UserRole.AGENT],
        "form-studio": [UserRole.QA_MANAGER],
        "templates": [UserRole.QA_MANAGER, UserRole.QA_AUDITOR, UserRole.TEAM_LEADER],
        "agent-feedback": [UserRole.QA_MANAGER, UserRole.TEAM_LEADER, UserRole.AGENT],
        "disputes": [UserRole.QA_MANAGER, UserRole.QA_AUDITOR, UserRole.TEAM_LEADER, UserRole.AGENT],
        "qa-reports": [UserRole.QA_MANAGER, UserRole.TEAM_LEADER],
        "agent-perf": [UserRole.QA_MANAGER, UserRole.TEAM_LEADER, UserRole.AGENT],
        "team-perf": [UserRole.QA_MANAGER, UserRole.TEAM_LEADER],
        "users": [UserRole.QA_MANAGER, UserRole.TEAM_LEADER],
        "settings": [UserRole.QA_MANAGER]
      };

      const allowedRoles = permissions[item.id];
      if (!allowedRoles) return true;
      return allowedRoles.includes(role);
    })
  })).filter(cat => cat.items.length > 0);

  return (
    <div className={`flex h-screen w-full overflow-hidden ${bgMain} ${textMain} transition-colors duration-300 font-sans`}>
      
      {/* SIDEBAR */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`shrink-0 border-r flex flex-col ${borderCol} ${bgSidebar}`}
          >
            {/* Sidebar Header */}
            <div className={`h-14 flex items-center px-4 border-b ${borderCol} shrink-0 gap-3`}>
              <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-indigo-500/20">
                <Command size={14} />
              </div>
              <span className="font-semibold tracking-tight text-sm truncate flex-1">PrecisionQA</span>
            </div>

            {/* Sidebar Scrollable Area */}
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
              
              <div className="space-y-1">
                <button
                  onClick={() => navigate("/dashboard/dashboard")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    activeTab === "dashboard" ? activeItem : `text-slate-600 dark:text-slate-400 ${itemHover}`
                  }`}
                >
                  <LayoutDashboard size={16} className={activeTab === "dashboard" ? "text-indigo-600 dark:text-white" : ""} />
                  <span className="font-medium">Dashboard</span>
                </button>
              </div>

              {filteredNavCategories.map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  <h3 className={`text-[11px] font-semibold px-3 uppercase tracking-wider ${textMuted}`}>
                    {cat.title}
                  </h3>
                  <div className="space-y-0.5">
                    {cat.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => navigate(`/dashboard/${item.id}`)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all group ${
                          activeTab === item.id ? activeItem : `text-slate-600 dark:text-slate-400 ${itemHover}`
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon size={16} className={activeTab === item.id ? "text-indigo-600 dark:text-white" : "group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors"} />
                          <span className="font-medium">{item.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* User Bottom Area */}
            <div className={`p-4 border-t ${borderCol} shrink-0`}>
              <div className={`flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer ${itemHover}`} onClick={onOpenProfile}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                  {(currentUser.name || "?").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{currentUser.name}</p>
                  <p className={`text-xs truncate ${textMuted}`}>{currentUser.role}</p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* TOP BAR */}
        <header className={`h-14 border-b flex items-center justify-between px-4 sm:px-6 shrink-0 z-30 ${bgMain} ${borderCol}`}>
          
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ${textMuted}`}
            >
              {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>

            {/* Breadcrumbs */}
            <div className="hidden sm:flex items-center gap-2 text-sm">
              {getBreadcrumbs().map((crumb, idx, arr) => (
                <React.Fragment key={idx}>
                  <span className={idx === arr.length - 1 ? "font-semibold" : textMuted}>{crumb}</span>
                  {idx < arr.length - 1 && <ChevronRight size={14} className={textMuted} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            
            <div className="hidden md:flex relative group">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${textMuted}`} size={14} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-48 lg:w-64 pl-8 pr-3 py-1.5 text-sm rounded-md border ${borderCol} bg-slate-50 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all`}
              />
              <div className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] border ${borderCol} rounded px-1.5 font-mono ${textMuted} pointer-events-none`}>
                ⌘K
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md border ${borderCol} hover:bg-slate-50 dark:hover:bg-white/5 transition-colors`}
              >
                <Building2 size={14} className={textMuted} />
                <span className="hidden lg:block truncate max-w-[120px]">{selectedOrg}</span>
                <ChevronDown size={14} className={textMuted} />
              </button>

              <AnimatePresence>
                {isOrgDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute right-0 mt-2 w-56 rounded-xl border ${borderCol} ${bgMain} shadow-xl py-1 z-50`}
                  >
                    <div className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>Organizations</div>
                    {["PrecisionQA Enterprise", "Corporate Services LOB", "Fintech Support"].map((org) => (
                      <button
                        key={org}
                        onClick={() => {
                          setSelectedOrg(org);
                          setIsOrgDropdownOpen(false);
                          addToast("success", "Organization Switched", `Switched context to ${org}.`);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-white/5 ${selectedOrg === org ? "text-indigo-600 dark:text-indigo-400 font-medium" : ""}`}
                      >
                        {org}
                        {selectedOrg === org && <Check size={14} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ${textMuted}`}
            >
              {isDarkTheme ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ${textMuted} relative`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-slate-900"></span>
                )}
              </button>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-transparent hover:ring-indigo-500/30 transition-all cursor-pointer"
              >
                {(currentUser.name || "?").charAt(0)}
              </button>

              <AnimatePresence>
                {isProfileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute right-0 mt-2 w-48 rounded-xl border ${borderCol} ${bgMain} shadow-xl py-1 z-50`}
                  >
                    <div className={`px-4 py-2 border-b ${borderCol} mb-1`}>
                      <p className="text-sm font-semibold truncate">{currentUser.name}</p>
                      <p className={`text-xs truncate ${textMuted}`}>{currentUser.email}</p>
                    </div>
                    <button onClick={() => { onOpenProfile(); setIsProfileMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2`}>
                      <UserCheck size={14} /> My Profile
                    </button>
                    <button onClick={() => { setIsDarkTheme(!isDarkTheme); setIsProfileMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2`}>
                      {isDarkTheme ? <Sun size={14} /> : <Moon size={14} />} Theme Toggle
                    </button>
                    <div className={`my-1 border-t ${borderCol}`}></div>
                    <button onClick={onLogout} className={`w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors flex items-center gap-2 font-medium`}>
                      <LogOut size={14} /> Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* MAIN SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#F9FAFB] dark:bg-[#0A0A0A] relative">
          <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Routes>
                  <Route path="dashboard" element={
                    <DashboardHome 
                      currentUser={currentUser} 
                      onRefreshSession={() => addToast("info", "Synced", "Dashboard metrics refreshed.")} 
                      addToast={addToast} 
                    />
                  } />
                  <Route path="users" element={<EnterpriseAdminConsole activeSection="users" currentUser={currentUser} addToast={addToast} />} />
                  <Route path="teams" element={<EnterpriseAdminConsole activeSection="teams" currentUser={currentUser} addToast={addToast} />} />
                  <Route path="clients" element={<EnterpriseAdminConsole activeSection="clients" currentUser={currentUser} addToast={addToast} />} />
                  <Route path="lobs" element={<EnterpriseAdminConsole activeSection="lobs" currentUser={currentUser} addToast={addToast} />} />
                  <Route path="settings" element={<EnterpriseAdminConsole activeSection="settings" currentUser={currentUser} addToast={addToast} />} />
                  <Route path="master-data" element={<MasterDataHub currentUser={currentUser} addToast={addToast} />} />
                  <Route path="form-studio" element={<PrecisionFormStudio currentUser={currentUser} addToast={addToast} />} />
                  <Route path="templates" element={<PrecisionFormStudio currentUser={currentUser} addToast={addToast} />} />
                  <Route path="import" element={<GoogleSheetsImporter currentUser={currentUser} addToast={addToast} onImportSuccess={() => navigate("/dashboard/assignment")} />} />
                  <Route path="assignment" element={
                    <ErrorBoundary>
                      <AssignmentQueue addToast={addToast} currentUser={currentUser} />
                    </ErrorBoundary>
                  } />
                  <Route path="audit-queue" element={
                    <ErrorBoundary>
                      <AuditQueue 
                        currentUser={{
                          id: currentUser.id,
                          email: currentUser.email,
                          fullName: currentUser.name,
                          role: currentUser.role
                        }} 
                        addToast={(toast) => addToast(toast.type, toast.title, toast.description)} 
                      />
                    </ErrorBoundary>
                  } />
                  <Route path="audit/:auditId" element={
                    <ErrorBoundary>
                      <AuditWorkspace 
                        currentUser={{
                          id: currentUser.id,
                          email: currentUser.email,
                          fullName: currentUser.name,
                          role: currentUser.role
                        }}
                        addToast={(toast) => addToast(toast.type, toast.title, toast.description)}
                      />
                    </ErrorBoundary>
                  } />
                  <Route path="agent-feedback" element={
                    <AgentFeedback 
                      currentUser={{
                        id: currentUser.id,
                        email: currentUser.email,
                        name: currentUser.name,
                        role: currentUser.role
                      }}
                      addToast={addToast}
                    />
                  } />
                  <Route path="completed" element={
                    <AgentFeedback 
                      currentUser={{
                        id: currentUser.id,
                        email: currentUser.email,
                        name: currentUser.name,
                        role: currentUser.role
                      }}
                      addToast={addToast}
                    />
                  } />
                  <Route path="disputes" element={
                    <AgentDisputes 
                      currentUser={{
                        id: currentUser.id,
                        email: currentUser.email,
                        name: currentUser.name,
                        role: currentUser.role
                      }}
                      addToast={addToast}
                    />
                  } />
                  <Route path="workflow-studio" element={<WorkflowStudio currentUser={currentUser} addToast={addToast} />} />
                  <Route path="/" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* FLOATING ACTION BUTTON (QUICK ACTIONS) */}
        <div className="absolute bottom-6 right-6 z-40">
          <AnimatePresence>
            {isQuickActionsOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{ duration: 0.15 }}
                className={`absolute bottom-16 right-0 w-56 rounded-2xl border ${borderCol} ${bgMain} shadow-2xl p-2 mb-2 flex flex-col gap-1`}
              >
                <div className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>Quick Actions</div>
                <button onClick={() => { navigate("/dashboard/import"); setIsQuickActionsOpen(false); }} className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left`}>
                  <Upload size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="font-medium">Import Cases</span>
                </button>
                <button className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left`}>
                  <Clock size={16} className="text-blue-600 dark:text-blue-400" />
                  <span className="font-medium">Assign Cases</span>
                </button>
                <button className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left`}>
                  <Hammer size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium">Create Scorecard</span>
                </button>
                <button onClick={() => { navigate("/dashboard/users"); setIsQuickActionsOpen(false); }} className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left`}>
                  <UserCheck size={16} className="text-amber-600 dark:text-amber-400" />
                  <span className="font-medium">Invite User</span>
                </button>
                <button className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left`}>
                  <FileText size={16} className="text-purple-600 dark:text-purple-400" />
                  <span className="font-medium">Generate Report</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
            className={`w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 transition-transform ${isQuickActionsOpen ? "rotate-45" : ""}`}
          >
            <Plus size={24} />
          </button>
        </div>

        {/* NOTIFICATION DRAWER */}
        <AnimatePresence>
          {isNotifOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsNotifOpen(false)}
                className="absolute inset-0 z-40 bg-slate-900/20 backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={`absolute right-0 top-0 bottom-0 w-80 z-50 border-l ${borderCol} ${bgMain} shadow-2xl flex flex-col`}
              >
                <div className={`h-14 flex items-center justify-between px-4 border-b ${borderCol} shrink-0`}>
                  <div className="flex items-center gap-2">
                    <Bell size={16} />
                    <span className="font-semibold text-sm">Notifications</span>
                  </div>
                  <button onClick={() => setIsNotifOpen(false)} className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 ${textMuted}`}>
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {notifications.map((notif) => (
                    <div key={notif.id} className={`p-3 rounded-xl border ${notif.isRead ? borderCol : "border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/10"} relative`}>
                      {!notif.isRead && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-600"></div>}
                      <h4 className="text-sm font-semibold mb-1 pr-4">{notif.title}</h4>
                      <p className={`text-xs ${textMuted} mb-2 leading-relaxed`}>{notif.content || notif.desc}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-[10px] font-mono ${textMuted}`}>
                          {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : (notif.time || "")}
                        </span>
                        {!notif.isRead && (
                          <button onClick={() => markAsRead(notif.id)} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer">Mark read</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className={`text-center py-8 text-sm ${textMuted}`}>No notifications.</div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

