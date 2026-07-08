import React, { useState, useEffect } from "react";
import { 
  MessageSquare, AlertTriangle, Eye, Check, X, ShieldAlert,
  ArrowRight, Filter, Search, Calendar, ChevronRight, FileText,
  Paperclip, Info, AlertCircle, Sparkles, Send, CheckCircle, 
  HelpCircle, ChevronDown, ChevronUp, Lock, Award, Download, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AgentFeedbackProps {
  currentUser: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
}

export default function AgentFeedback({ currentUser, addToast }: AgentFeedbackProps) {
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scorecard, setScorecard] = useState<any>(null);
  
  // Filters
  const [filterClient, setFilterClient] = useState("");
  const [filterLob, setFilterLob] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Detail view
  const [selectedAudit, setSelectedAudit] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAcknowledgeOpen, setIsAcknowledgeOpen] = useState(false);
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);

  // Form states
  const [ackComments, setAckComments] = useState("");
  const [disputeCategory, setDisputeCategory] = useState("Grading Error");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [challengedQuestions, setChallengedQuestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // File upload state (simulated)
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Collapsed sections in scorecard view
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Specific scorecard layout associated with active case
  const [selectedAuditScorecard, setSelectedAuditScorecard] = useState<any>(null);

  useEffect(() => {
    fetchAudits();
    fetchScorecard();
  }, []);

  const handleViewEvaluation = async (audit: any) => {
    setSelectedAudit(audit);
    setIsViewModalOpen(true);
    setSelectedAuditScorecard(null);
    try {
      const res = await fetch(`/api/audit/scorecard?caseId=${audit.caseId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAuditScorecard(data);
      }
    } catch (err) {
      console.error("Error loading scorecard for audit:", err);
    }
  };

  const handleExportAudit = async (audit: any) => {
    try {
      // Fetch the specific scorecard layout for this case
      const res = await fetch(`/api/audit/scorecard?caseId=${audit.caseId}`);
      const activeSc = res.ok ? await res.json() : scorecard;

      const sectionsText = activeSc?.sections?.map((sec: any) => {
        const questionsText = sec.questions?.map((q: any) => {
          const ans = audit.answers?.[q.id] || { value: "N/A", comment: "" };
          return `- [${q.isCritical ? 'CRITICAL ' : ''}${q.questionText}] (Weight: ${q.weight} pts)
  Value Selected: ${ans.value !== undefined ? (ans.value === "yes" || ans.value === true ? "Yes / Pass" : ans.value === "no" || ans.value === false ? "No / Fail" : "N/A") : "N/A"}
  Auditor Comments: ${ans.comment || "None"}`;
        }).join("\n\n");
        
        return `========================================================================
SECTION: ${sec.name} (Section Weight: ${sec.weight}%)
========================================================================
${questionsText || "No questions assessed."}`;
      }).join("\n\n\n") || "No detailed scorecard answers found.";

      const reportContent = `========================================================================
                       PRECISION QA EVALUATION REPORT
========================================================================
Case ID:            ${audit.externalCaseId}
Client/Account:     ${audit.clientName}
Business Unit (LOB): ${audit.lobName}
Interaction Date:   ${audit.auditDate ? new Date(audit.auditDate).toLocaleDateString() : "N/A"}
Auditor Name:       ${audit.auditorName || "QA Auditor"}
Auditor Email:      ${audit.auditorEmail || "N/A"}
Representative:     ${audit.agentName || "Agent"}
Representative Email:${audit.agentEmail || "N/A"}
Overall QA Score:   ${audit.weightedScore}% (Passing Score: 80%)
Critical Fail:      ${audit.isCriticalFailed ? "YES (Auto-fail/Major compliance breach)" : "NO"}
Feedback Status:    ${audit.feedbackStatus || "pending"}
Duration (APT):     ${audit.durationSeconds ? `${Math.floor(audit.durationSeconds / 60)}m ${audit.durationSeconds % 60}s` : "N/A"}
Evaluation Date:    ${audit.lockedAt ? new Date(audit.lockedAt).toLocaleDateString() : new Date().toLocaleDateString()}

------------------------------------------------------------------------
                             QA FINDINGS & REMARKS
------------------------------------------------------------------------
Overall QA Comments:
${audit.generalComments || "None provided."}

Opportunities/Coaching Notes:
${audit.coachingNotes || "None noted."}

------------------------------------------------------------------------
                        DETAILED CHECKPOINT SCORECARD
------------------------------------------------------------------------
${sectionsText}

========================================================================
                      PrecisionQA Compliance Engine
========================================================================`;

      const blob = new Blob([reportContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Quality_Report_${audit.externalCaseId}.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast("success", "Export Successful", `Downloaded evaluation report for Case ${audit.externalCaseId}`);
    } catch (err: any) {
      addToast("error", "Export Failed", err.message || "Failed to download audit report.");
    }
  };

  const fetchAudits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/feedback/audits?userId=${currentUser.id}&role=${currentUser.role}`);
      if (!res.ok) throw new Error("Failed to load feedback");
      const data = await res.json();
      setAudits(data);
    } catch (err: any) {
      addToast("error", "Failed to Fetch", err.message || "Could not retrieve completed audits.");
    } finally {
      setLoading(false);
    }
  };

  const fetchScorecard = async () => {
    try {
      const res = await fetch("/api/audit/scorecard");
      if (res.ok) {
        const data = await res.json();
        setScorecard(data);
      }
    } catch (err) {
      console.error("Error loading scorecard template:", err);
    }
  };

  // Metrics calculations
  const totalFeedbackCount = audits.length;
  const acknowledgedCount = audits.filter(a => a.auditStatus === "acknowledged" || a.auditStatus === "locked" && a.feedbackStatus === "acknowledged").length;
  const pendingCount = audits.filter(a => a.auditStatus === "submitted").length;
  const activeDisputesCount = audits.filter(a => a.auditStatus === "disputed").length;
  
  const avgQaScore = audits.length > 0
    ? Math.round(audits.reduce((sum, a) => sum + parseFloat(a.weightedScore), 0) / audits.length)
    : 0;

  // Filter lists
  const clients = Array.from(new Set(audits.map(a => a.clientName).filter(Boolean)));
  const lobs = Array.from(new Set(audits.map(a => a.lobName).filter(Boolean)));

  const filteredAudits = audits.filter(a => {
    const matchesClient = filterClient ? a.clientName === filterClient : true;
    const matchesLob = filterLob ? a.lobName === filterLob : true;
    const matchesStatus = filterStatus 
      ? (filterStatus === "pending" ? a.auditStatus === "submitted" : a.auditStatus === filterStatus)
      : true;
    const matchesSearch = searchQuery
      ? a.externalCaseId.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (a.agentName && a.agentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.auditorName && a.auditorName.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesClient && matchesLob && matchesStatus && matchesSearch;
  });

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      setUploadProgress(10);
      setUploadedFile({ name: file.name, size: (file.size / 1024).toFixed(1) + " KB" });

      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setUploading(false);
            addToast("success", "File Uploaded", `Screenshot ${file.name} prepared securely.`);
            return 100;
          }
          return prev + 30;
        });
      }, 200);
    }
  };

  const submitAcknowledgement = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: selectedAudit.auditId,
          userId: currentUser.id,
          comments: ackComments
        })
      });

      if (!res.ok) throw new Error("Failed to acknowledge evaluation");

      addToast("success", "Evaluation Acknowledged", "You have officially signed and acknowledged this performance scorecard.");
      setIsAcknowledgeOpen(false);
      setIsViewModalOpen(false);
      setSelectedAudit(null);
      setAckComments("");
      fetchAudits();
    } catch (err: any) {
      addToast("error", "Submission Failed", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitDispute = async () => {
    if (!disputeDescription.trim()) {
      addToast("warning", "Missing Description", "Please provide a description of why you are challenging this grade.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: selectedAudit.auditId,
          userId: currentUser.id,
          reasonCategory: disputeCategory,
          description: disputeDescription,
          challengedQuestions: challengedQuestions,
          attachmentUrl: uploadedFile ? `https://precisionqa.storage.local/attachments/${uploadedFile.name}` : ""
        })
      });

      if (!res.ok) throw new Error("Failed to raise official dispute");

      addToast("success", "Dispute Escalated", "Case evaluation marked as Disputed and added to the QA Review workspace.");
      setIsDisputeOpen(false);
      setIsViewModalOpen(false);
      setSelectedAudit(null);
      setDisputeDescription("");
      setChallengedQuestions([]);
      setUploadedFile(null);
      fetchAudits();
    } catch (err: any) {
      addToast("error", "Dispute Submission Failed", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleChallengedQuestion = (qId: string) => {
    setChallengedQuestions(prev => 
      prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
    );
  };

  // Helper to determine status styling
  const getAuditStatusLabelAndStyle = (status: string) => {
    switch (status) {
      case "submitted":
        return { label: "Pending Acknowledge", classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30" };
      case "acknowledged":
        return { label: "Acknowledged", classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" };
      case "disputed":
        return { label: "Disputed", classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30" };
      case "locked":
        return { label: "Locked (Final)", classes: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/5" };
      default:
        return { label: status, classes: "bg-slate-50 text-slate-600 border-slate-200" };
    }
  };

  const isAgent = currentUser.role === "agent";
  const displayTitle = isAgent ? "My Feedback" : "Completed Audits & Evaluations Log";
  const displayDescription = isAgent 
    ? "Securely review submitted quality audits, digitally sign feedback, and raise formal grading disputes."
    : "Review all completed quality evaluations, track feedback actions, and export final reports.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{displayTitle}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {displayDescription}
        </p>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-[#111111] p-4.5 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Audits</span>
          <span className="text-2xl font-black text-slate-800 dark:text-white mt-1.5">{totalFeedbackCount}</span>
        </div>
        <div className="bg-white dark:bg-[#111111] p-4.5 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Acknowledged</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">{acknowledgedCount}</span>
        </div>
        <div className="bg-white dark:bg-[#111111] p-4.5 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pending Sign-off</span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1.5">{pendingCount}</span>
        </div>
        <div className="bg-white dark:bg-[#111111] p-4.5 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Active Disputes</span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5">{activeDisputesCount}</span>
        </div>
        <div className="col-span-2 md:col-span-1 bg-gradient-to-tr from-indigo-600 to-purple-600 p-4.5 rounded-xl text-white shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Average QA Score</span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-black">{avgQaScore}%</span>
            <span className="text-[10px] text-indigo-200 font-medium">KPI Target 80%</span>
          </div>
        </div>
      </div>

      {/* DETAILED AUDIT LIST */}
      <div className="bg-white dark:bg-[#111111] rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm overflow-hidden">
        {/* Filters Panel */}
        <div className="p-4 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-[#151515] flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search by Case ID, Auditor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 w-full md:w-auto justify-end">
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none"
            >
              <option value="">All Clients</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={filterLob}
              onChange={(e) => setFilterLob(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none"
            >
              <option value="">All LOBs</option>
              {lobs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending Sign-off</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="disputed">Disputed</option>
              <option value="locked">Locked</option>
            </select>

            {(filterClient || filterLob || filterStatus || searchQuery) && (
              <button 
                onClick={() => { setFilterClient(""); setFilterLob(""); setFilterStatus(""); setSearchQuery(""); }}
                className="text-xs text-rose-500 hover:text-rose-600 font-bold px-2 py-1.5"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Audit List Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              Loading Completed Audits...
            </div>
          ) : filteredAudits.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <Info className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={24} />
              No evaluations found matching the filters.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#151515] text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200/60 dark:border-white/5">
                  <th className="p-4">Case ID</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Line of Business (LOB)</th>
                  <th className="p-4">Evaluation Date</th>
                  <th className="p-4 text-center">QA Score</th>
                  <th className="p-4">Sign-off Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                {filteredAudits.map((a) => {
                  const statusStyle = getAuditStatusLabelAndStyle(a.auditStatus);
                  const scoreValue = parseFloat(a.weightedScore);
                  const isPass = scoreValue >= 80;

                  return (
                    <tr key={a.auditId} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-200">{a.externalCaseId}</td>
                      <td className="p-4 font-medium">{a.clientName}</td>
                      <td className="p-4 font-medium text-slate-500 dark:text-slate-400">{a.lobName}</td>
                      <td className="p-4 font-medium text-slate-400 font-mono">
                        {a.auditDate ? new Date(a.auditDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A"}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                          isPass 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        }`}>
                          {scoreValue}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-0.5 border text-[10px] font-bold rounded-full ${statusStyle.classes}`}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewEvaluation(a)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
                          >
                            <Eye size={12} /> View
                          </button>
                          <button
                            onClick={() => handleExportAudit(a)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-[11px]"
                            title="Download complete report"
                          >
                            <Download size={12} /> Export
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* HIGH FIDELITY AUDIT EVALUATION MODAL */}
      <AnimatePresence>
        {isViewModalOpen && selectedAudit && (
          <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#151515] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="text-indigo-600 dark:text-indigo-400" size={18} />
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      Quality Scorecard Report: Case <span className="font-mono text-indigo-600 dark:text-indigo-400">{selectedAudit.externalCaseId}</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Evaluated by {selectedAudit.auditorName || "QA Auditor"} • {selectedAudit.scorecardName || "Default Scorecard"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportAudit(selectedAudit)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                  >
                    <Download size={13} /> Export Report
                  </button>
                  <button 
                    onClick={() => setIsViewModalOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Content - Dual Column split */}
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Scorecard checklist layout (Left Side) */}
                <div className="lg:col-span-8 space-y-5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Evaluation Breakdown</h4>
                    <span className="text-[10px] text-slate-400">Green checkbox indicates a positive score</span>
                  </div>

                  {(() => {
                    const activeScorecard = selectedAuditScorecard || scorecard;
                    return activeScorecard && activeScorecard.sections ? (
                      activeScorecard.sections.map((sec: any) => {
                        const isCollapsed = collapsedSections[sec.id];
                        return (
                          <div key={sec.id} className="border border-slate-200/60 dark:border-white/5 rounded-xl overflow-hidden bg-slate-50/20 dark:bg-[#151515]/10">
                            <button
                              onClick={() => toggleSection(sec.id)}
                              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-[#151515] border-b border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-[#181818] transition-colors"
                            >
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {sec.name} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium ml-1">({sec.weight}% section weight)</span>
                              </span>
                              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                            </button>

                            {!isCollapsed && (
                              <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {sec.questions?.map((q: any) => {
                                  // Extract matched answer from evaluation data
                                  const questionAnswer = selectedAudit.answers?.[q.id] || { value: null, comment: "" };
                                  const val = questionAnswer.value;

                                  return (
                                    <div key={q.id} className="p-4 space-y-2">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-0.5">
                                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{q.questionText}</p>
                                          {q.helpText && <p className="text-[10px] text-slate-400 font-medium">{q.helpText}</p>}
                                        </div>
                                        
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          {q.isCritical && (
                                            <span className="text-[8px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 px-1 py-0.5 rounded border border-rose-200/50">
                                              Critical Fail
                                            </span>
                                          )}
                                          <span className="text-[10px] font-mono text-slate-400 font-bold">W: {q.weight}</span>
                                          
                                          {/* Status values */}
                                          <div className={`px-2 py-0.5 rounded font-black text-[9px] uppercase border ${
                                            val === "yes" || val === true
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                                              : val === "no" || val === false
                                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30"
                                                : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10"
                                          }`}>
                                            {val === "yes" || val === true ? "Yes / Pass" : val === "no" || val === false ? "No / Fail" : "N/A"}
                                          </div>
                                        </div>
                                      </div>

                                      {questionAnswer.comment && (
                                        <div className="bg-slate-50 dark:bg-[#181818]/60 p-2.5 rounded-lg border border-slate-150 dark:border-white/5 text-[10px] text-slate-600 dark:text-slate-400 italic">
                                          <span className="font-bold not-italic text-slate-500 mr-1">Auditor:</span>
                                          "{questionAnswer.comment}"
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-xs text-slate-400">
                        No scorecard template structure is loaded.
                      </div>
                    );
                  })()}
                </div>

                {/* Score card summary and coaching panel (Right Side) */}
                <div className="lg:col-span-4 space-y-5 border-l border-slate-200/60 dark:border-white/5 lg:pl-6">
                  {/* Big Scorecard Graphic */}
                  <div className="bg-slate-50 dark:bg-[#151515] p-5 rounded-xl border border-slate-200/60 dark:border-white/5 text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <Lock size={12} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Final Quality Score</span>
                    <span className="text-4xl font-black text-slate-800 dark:text-white mt-2 block">{parseFloat(selectedAudit.weightedScore)}%</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase mt-3 tracking-wider ${
                      parseFloat(selectedAudit.weightedScore) >= 80
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-rose-500/10 text-rose-600"
                    }`}>
                      {parseFloat(selectedAudit.weightedScore) >= 80 ? "Met Target" : "Under KPI Target"}
                    </span>
                  </div>

                  {selectedAudit.durationSeconds !== undefined && selectedAudit.durationSeconds !== null && (
                    <div className="bg-slate-50 dark:bg-[#151515] p-3 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-amber-500" />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Processing Time (APT)</span>
                      </div>
                      <span className="text-xs font-black font-mono text-slate-700 dark:text-slate-300">
                        {Math.floor(selectedAudit.durationSeconds / 60)}m {selectedAudit.durationSeconds % 60}s
                      </span>
                    </div>
                  )}

                  {/* Comments Box */}
                  <div className="space-y-4">
                    {selectedAudit.generalComments && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">General Comments</span>
                        <div className="bg-slate-50/50 dark:bg-[#151515]/40 p-3.5 rounded-xl border border-slate-200/60 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {selectedAudit.generalComments}
                        </div>
                      </div>
                    )}

                    {selectedAudit.coachingNotes && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Coaching & Recommendations</span>
                        <div className="bg-indigo-50/10 dark:bg-indigo-950/5 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/20 text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                          {selectedAudit.coachingNotes}
                        </div>
                      </div>
                    )}

                    {selectedAudit.feedbackAgentComments && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Your Acknowledge Comments</span>
                        <div className="bg-emerald-50/10 dark:bg-[#151515]/40 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/20 text-xs text-emerald-950 dark:text-emerald-300 leading-relaxed">
                          "{selectedAudit.feedbackAgentComments}"
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="px-6 py-4 border-t border-slate-150 dark:border-white/5 bg-slate-50 dark:bg-[#151515] flex justify-between gap-3">
                <div>
                  <span className={`inline-block px-2.5 py-1 border text-[10px] font-bold rounded-full ${getAuditStatusLabelAndStyle(selectedAudit.auditStatus).classes}`}>
                    Status: {getAuditStatusLabelAndStyle(selectedAudit.auditStatus).label}
                  </span>
                </div>

                <div className="flex gap-3">
                  {selectedAudit.auditStatus === "submitted" && (
                    <>
                      <button
                        onClick={() => setIsDisputeOpen(true)}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold border border-rose-200/40 dark:border-rose-900/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <AlertTriangle size={14} /> Dispute Evaluation
                      </button>

                      <button
                        onClick={() => setIsAcknowledgeOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-indigo-500/10"
                      >
                        <Check size={14} /> Acknowledge & Sign-off
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setIsViewModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 dark:bg-white/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIGITALLY SIGN & ACKNOWLEDGE MODAL */}
      <AnimatePresence>
        {isAcknowledgeOpen && selectedAudit && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4"
            >
              <div className="flex gap-3 text-indigo-600">
                <CheckCircle size={22} className="shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Acknowledge Quality Scorecard</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Your digital signature confirms that you have viewed and discussed this evaluation report.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Optional Feedback / Agent Comments
                </label>
                <textarea
                  value={ackComments}
                  onChange={(e) => setAckComments(e.target.value)}
                  placeholder="Enter any reflection or follow up comments here... (Optional)"
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-amber-50/40 border border-amber-200/60 p-3.5 rounded-lg text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                <span className="font-bold text-amber-700 block mb-0.5">Corporate Standard Notice</span>
                By clicking sign-off, you confirm receipt of feedback. This action locks the current audit state, notifying your direct team leader and auditor of successful delivery.
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setIsAcknowledgeOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 dark:bg-white/5 transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  disabled={submitting}
                  onClick={submitAcknowledgement}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {submitting ? "Signing..." : "Digitally Sign & Close"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DISPUTE EVALUATION FORM MODAL */}
      <AnimatePresence>
        {isDisputeOpen && selectedAudit && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-xl p-6 space-y-4"
            >
              <div className="flex gap-3 text-rose-600">
                <ShieldAlert size={22} className="shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">Raise Official Dispute</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Submit a formal challenge to this evaluation. It will be escalated to your QA Manager for objective review.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Dispute Category
                  </label>
                  <select
                    value={disputeCategory}
                    onChange={(e) => setDisputeCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Grading Error">Grading Error (Incorrect interpretation of scorecard)</option>
                    <option value="Policy Ambiguity">Policy Ambiguity (Conflicting standards in corporate policy)</option>
                    <option value="Incorrect Information">Incorrect Information (Auditor lacked full interaction context)</option>
                    <option value="Other">Other / Exceptional Circumstances</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                    Question(s) Challenged (Select all that apply)
                  </label>
                  <div className="border border-slate-200 dark:border-white/10 rounded-lg bg-slate-50/50 dark:bg-[#1c1c1c] p-3 max-h-36 overflow-y-auto space-y-2">
                    {scorecard && scorecard.sections ? (
                      scorecard.sections.flatMap((s: any) => s.questions || []).map((q: any) => (
                        <label key={q.id} className="flex items-start gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer hover:text-slate-900">
                          <input
                            type="checkbox"
                            checked={challengedQuestions.includes(q.id)}
                            onChange={() => toggleChallengedQuestion(q.id)}
                            className="mt-0.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                          <span>{q.questionText}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No scorecard questions available to match.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Reason & Supporting Comments
                  </label>
                  <textarea
                    required
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    placeholder="Provide professional justification, policy references, call timestamps, or transcript highlights..."
                    rows={4}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Simulated file upload */}
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    Attachment Upload (Screenshots / Policy Docs)
                  </label>
                  <div className="border border-dashed border-slate-200 dark:border-white/10 rounded-lg p-4 bg-slate-50/30 dark:bg-white/5 text-center relative hover:bg-slate-50 dark:hover:bg-white/10 transition-colors">
                    <input
                      type="file"
                      id="dispute-file-upload"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept="image/*,.pdf"
                      onChange={handleSimulatedUpload}
                    />
                    <div className="flex flex-col items-center gap-1">
                      <Paperclip size={18} className="text-slate-400" />
                      <span className="text-[11px] text-slate-500 font-bold">Drag and drop files here, or click to browse</span>
                      <span className="text-[9px] text-slate-400">Supports PNG, JPG, or PDF (Max 5MB)</span>
                    </div>
                  </div>

                  {uploadedFile && (
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-2.5 flex items-center justify-between mt-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Paperclip size={14} className="text-indigo-500" />
                        <div>
                          <p className="font-bold truncate max-w-[200px]">{uploadedFile.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono">{uploadedFile.size}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {uploading ? (
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <button 
                            onClick={() => setUploadedFile(null)}
                            className="text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setIsDisputeOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 dark:bg-white/5 transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  disabled={submitting}
                  onClick={submitDispute}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {submitting ? "Submitting Dispute..." : "Submit Formal Dispute"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
