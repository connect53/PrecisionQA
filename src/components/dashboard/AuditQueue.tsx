import React, { useState, useEffect, useMemo } from "react";
import { 
  CheckSquare, 
  Play, 
  FileText, 
  Filter, 
  Search, 
  Clock, 
  AlertTriangle, 
  Activity, 
  RefreshCw, 
  ChevronRight, 
  ChevronLeft, 
  UserCheck, 
  Inbox, 
  Calendar,
  ArrowRight,
  Lock,
  Search as SearchIcon,
  Filter as FilterIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { StatusBadge } from "./ReusableComponents";
import { safeString } from "../../lib/safeUtils";

interface CaseRecord {
  id: string;
  batchId: string;
  batchName: string;
  caseId: string;
  interactionId: string;
  agentName: string;
  agentEmail: string;
  team: string;
  client: string;
  lob: string;
  auditDate: string;
  recordingUrl: string;
  transcriptUrl: string;
  language: string;
  status: string;
  auditorId: string;
  auditorName: string;
  importedAt: string;
  priority: string;
  metadata?: Record<string, any>;
}

interface AuditQueueProps {
  currentUser: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  addToast: (toast: { title: string; description: string; type: "success" | "error" | "info" }) => void;
}

export default function AuditQueue({ currentUser, addToast }: AuditQueueProps) {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchCases();
  }, [currentUser]);

  const fetchCases = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/assignment/cases");
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          // For auditors, only show their assigned cases
          if (currentUser.role === "qa_auditor") {
            setCases(data.filter((c: CaseRecord) => c.auditorId === currentUser.id));
          } else {
            setCases(data);
          }
        } else {
          const text = await res.text();
          console.error("Expected JSON but got:", text.substring(0, 100));
          throw new Error("Invalid response format from server (Expected JSON, got HTML/Text)");
        }
      } else {
        const errorText = await res.text();
        console.error("Server returned error status:", res.status, errorText.substring(0, 100));
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to fetch cases:", err);
      addToast({
        title: "Network Error",
        description: "Could not sync with the assignment server.",
        type: "error"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleReleaseCase = async (id: string, caseId: string) => {
    if (!window.confirm(`Are you sure you want to release Case ${caseId} back to the global pool?`)) return;
    try {
      const res = await fetch("/api/assignment/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: id })
      });
      if (res.ok) {
        addToast({
          title: "Case Released",
          description: `Case ${caseId} is now back in the unassigned pool.`,
          type: "success"
        });
        fetchCases();
      }
    } catch (err) {
      addToast({
        title: "Action Failed",
        description: "Unable to return case to queue.",
        type: "error"
      });
    }
  };

  const handleOpenAuditWorkspace = (caseRecord: CaseRecord) => {
    navigate(`/dashboard/audit/${caseRecord.id}`);
  };

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesSearch = 
        safeString(c.caseId).toLowerCase().includes(searchTerm.toLowerCase()) ||
        safeString(c.agentName).toLowerCase().includes(searchTerm.toLowerCase()) ||
        safeString(c.client).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === "all" || c.status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [cases, searchTerm, filterStatus]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = filteredCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
        <p className="text-sm font-bold text-slate-500 animate-pulse font-mono uppercase tracking-widest text-[10px]">Synchronizing Audit Records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <CheckSquare size={20} />
            </div>
            Audit Workspace Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            Manage and perform quality evaluations for assigned interaction records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchCases}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/5 transition-all text-slate-600 dark:text-slate-400 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Assigned to Me", value: cases.filter(c => c.status === "assigned").length, icon: UserCheck, color: "indigo" },
          { label: "Audit in Progress", value: cases.filter(c => c.status === "in_progress").length, icon: Clock, color: "blue" },
          { label: "Completed Evaluations", value: cases.filter(c => c.status === "completed").length, icon: CheckSquare, color: "emerald" },
          { label: "Total Handled", value: cases.length, icon: Activity, color: "slate" }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-[#111] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-950/20 text-${stat.color}-600 dark:text-${stat.color}-400`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest font-mono">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 dark:text-white font-mono leading-none mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#111] p-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col lg:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by Case ID, Agent, or Client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-1.5 whitespace-nowrap">
            <FilterIcon size={12} /> Filter Status
          </span>
          {["all", "assigned", "in_progress", "completed", "disputed"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all whitespace-nowrap ${
                filterStatus === status 
                ? "bg-slate-900 text-white shadow-lg" 
                : "bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100"
              }`}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Case Context</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Representative</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Interaction Date</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono text-center">Priority</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono text-center">Status</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-300">
                        <Inbox size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">Queue Empty</p>
                        <p className="text-xs text-slate-500">No matching audit records found in your queue.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/30 dark:hover:bg-white/[0.01] transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">{c.caseId}</span>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded">ID: {c.interactionId}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                          {c.client} • {c.lob}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xs font-black text-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          {(c.agentName || "Unknown").charAt(0)}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100">{c.agentName}</p>
                          <p className="text-[10px] text-slate-400 font-bold truncate max-w-[140px]">{c.agentEmail || "No Email Defined"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                        <Calendar size={12} className="text-slate-400" />
                        {c.auditDate ? new Date(c.auditDate).toLocaleDateString() : "N/A"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        c.priority?.toLowerCase() === "high" ? "bg-rose-50 text-rose-600 border border-rose-200" :
                        c.priority?.toLowerCase() === "medium" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                        "bg-slate-50 text-slate-600 border border-slate-200"
                      }`}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex justify-center">
                        <StatusBadge status={c.status} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-all">
                        {["super_admin", "admin", "qa_manager", "manager"].includes(currentUser.role) ? (
                          <>
                            {c.status === "assigned" && (
                              <button
                                onClick={() => handleReleaseCase(c.id, c.caseId)}
                                className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 dark:border-white/10 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/10 rounded-lg transition-colors"
                              >
                                Release
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenAuditWorkspace(c)}
                              className="px-3 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-1"
                            >
                              Perform Audit <ArrowRight size={10} />
                            </button>
                            {c.status !== "assigned" && (
                              <button
                                onClick={() => handleOpenAuditWorkspace(c)}
                                className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1.5"
                              >
                                <Lock size={10} className="text-slate-400" /> View Evaluation
                              </button>
                            )}
                          </>
                        ) : c.status === "assigned" ? (
                          <>
                            <button
                              onClick={() => handleReleaseCase(c.id, c.caseId)}
                              className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 dark:border-white/10 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/10 rounded-lg transition-colors"
                            >
                              Release
                            </button>
                            <button
                              onClick={() => handleOpenAuditWorkspace(c)}
                              className="px-3 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-1"
                            >
                              Perform Audit <ArrowRight size={10} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleOpenAuditWorkspace(c)}
                            className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <Lock size={10} className="text-slate-400" /> View Evaluation
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="p-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 font-semibold font-mono bg-slate-50/20 dark:bg-white/5">
          <div>
            Showing {filteredCases.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredCases.length)} of {filteredCases.length} records
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2">Page {currentPage} of {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
