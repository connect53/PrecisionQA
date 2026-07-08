import React, { useState, useEffect, useRef } from "react";
import { 
  AlertTriangle, Check, X, ShieldAlert, Sparkles, Send, 
  MessageSquare, User, Clock, FileText, CheckCircle2,
  Lock, Calendar, Paperclip, ChevronRight, Filter, Search,
  TrendingUp, ThumbsUp, ThumbsDown, ArrowUpRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AgentDisputesProps {
  currentUser: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
}

export default function AgentDisputes({ currentUser, addToast }: AgentDisputesProps) {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  
  // Comments section
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState(""); // 'open', 'under_review', 'resolved_approved', 'resolved_rejected'

  // QA Resolution Form states
  const [resolutionAction, setResolutionAction] = useState<"resolved_approved" | "resolved_rejected">("resolved_approved");
  const [resolutionComments, setResolutionComments] = useState("");
  const [adjustedScore, setAdjustedScore] = useState<number>(100);
  const [submittingResolution, setSubmittingResolution] = useState(false);

  // Scorecard details for list of challenged questions
  const [scorecard, setScorecard] = useState<any>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  const isManagerOrAuditor = ["admin", "super_admin", "qa_manager", "qa_auditor"].includes(currentUser.role);

  useEffect(() => {
    fetchDisputes();
    fetchScorecard();
  }, []);

  useEffect(() => {
    if (selectedDispute) {
      fetchComments(selectedDispute.disputeId);
      setAdjustedScore(parseFloat(selectedDispute.weightedScore));
    } else {
      setComments([]);
    }
  }, [selectedDispute]);

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/feedback/disputes?userId=${currentUser.id}&role=${currentUser.role}`);
      if (!res.ok) throw new Error("Failed to load disputes list");
      const data = await res.json();
      setDisputes(data);

      // Preserve selection or select the first one by default if available
      if (data.length > 0) {
        if (selectedDispute) {
          const updatedSelected = data.find((d: any) => d.disputeId === selectedDispute.disputeId);
          setSelectedDispute(updatedSelected || data[0]);
        } else {
          setSelectedDispute(data[0]);
        }
      } else {
        setSelectedDispute(null);
      }
    } catch (err: any) {
      addToast("error", "Failed to Load", err.message || "Could not retrieve dispute entries.");
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

  const fetchComments = async (disputeId: string) => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/feedback/disputes/${disputeId}/comments`);
      if (!res.ok) throw new Error("Failed to fetch dispute comments");
      const data = await res.json();
      setComments(data);
    } catch (err: any) {
      console.error("Fetch Comments Failed:", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedDispute) return;

    try {
      const res = await fetch(`/api/feedback/disputes/${selectedDispute.disputeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          commentText: newComment
        })
      });

      if (!res.ok) throw new Error("Could not send reply");
      
      const resData = await res.json();
      
      // Clear input and append comment locally
      setNewComment("");
      fetchComments(selectedDispute.disputeId);
    } catch (err: any) {
      addToast("error", "Send Failed", err.message);
    }
  };

  const updateDisputeStatusToReview = async () => {
    if (!selectedDispute) return;
    try {
      // Create a comment to log system status update and update status
      const res = await fetch(`/api/feedback/disputes/${selectedDispute.disputeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          commentText: `System Alert: Dispute status updated to Under Review by ${currentUser.name}.`
        })
      });

      // Update local and remote status
      const resolveRes = await fetch(`/api/feedback/disputes/${selectedDispute.disputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "under_review",
          comments: "Dispute placed under active review status.",
          userId: currentUser.id
        })
      });

      if (resolveRes.ok) {
        addToast("info", "Placed Under Review", "This dispute evaluation is now officially under active evaluation.");
        fetchDisputes();
      }
    } catch (err: any) {
      addToast("error", "Status Update Failed", err.message);
    }
  };

  const submitResolution = async () => {
    if (!resolutionComments.trim()) {
      addToast("warning", "Missing Explanation", "Resolution comments are required to finalize this dispute.");
      return;
    }

    setSubmittingResolution(true);
    try {
      const res = await fetch(`/api/feedback/disputes/${selectedDispute.disputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: resolutionAction,
          comments: resolutionComments,
          userId: currentUser.id,
          newScore: resolutionAction === "resolved_approved" ? adjustedScore : undefined
        })
      });

      if (!res.ok) throw new Error("Failed to submit QA resolution");

      addToast("success", "Dispute Resolved", `Case dispute closed. Scorecard grade successfully ${resolutionAction === "resolved_approved" ? "approved & recalculated" : "rejected & upheld"}.`);
      setResolutionComments("");
      fetchDisputes();
    } catch (err: any) {
      addToast("error", "Failed to Resolve", err.message);
    } finally {
      setSubmittingResolution(false);
    }
  };

  // Metrics Calculations
  const totalDisputes = disputes.length;
  const openDisputes = disputes.filter(d => d.disputeStatus === "open" || d.disputeStatus === "under_review").length;
  const resolvedDisputes = disputes.filter(d => d.disputeStatus === "resolved_approved" || d.disputeStatus === "resolved_rejected").length;
  
  const winRate = resolvedDisputes > 0
    ? Math.round((disputes.filter(d => d.disputeStatus === "resolved_approved").length / resolvedDisputes) * 100)
    : 0;

  // Filter dispute items
  const filteredDisputes = disputes.filter(d => {
    const matchesStatus = filterStatus 
      ? (filterStatus === "open" ? (d.disputeStatus === "open" || d.disputeStatus === "under_review") : d.disputeStatus === filterStatus)
      : true;
    const matchesSearch = searchQuery
      ? d.externalCaseId.toLowerCase().includes(searchQuery.toLowerCase()) || 
        d.reasonCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.agentName && d.agentName.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesStatus && matchesSearch;
  });

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "open":
        return { label: "Open / Escalated", classes: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30" };
      case "under_review":
        return { label: "Under Review", classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30" };
      case "resolved_approved":
        return { label: "Approved (Recalculated)", classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" };
      case "resolved_rejected":
        return { label: "Rejected (Uphold Grade)", classes: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/5" };
      default:
        return { label: status, classes: "bg-slate-50 text-slate-600 border-slate-200" };
    }
  };

  const getChallengedQuestionsList = (challengedIds: any) => {
    if (!challengedIds || !scorecard || !scorecard.sections) return [];
    
    let parsedIds: string[] = [];
    try {
      parsedIds = typeof challengedIds === "string" ? JSON.parse(challengedIds) : challengedIds;
    } catch (e) {
      parsedIds = [];
    }

    if (!Array.isArray(parsedIds)) return [];

    const allQuestions = scorecard.sections.flatMap((s: any) => s.questions || []);
    return allQuestions.filter((q: any) => parsedIds.includes(q.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isManagerOrAuditor ? "Disputes Workspace" : "My Disputes"}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isManagerOrAuditor 
            ? "Enterprise compliance resolution panel. Review agent challenges, coordinate discussion, and adjust scorecard grades."
            : "Track current grading challenges, review timelines, and communicate directly with QA auditors regarding escalations."
          }
        </p>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111111] p-4.5 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Disputes</span>
          <span className="text-2xl font-black text-slate-800 dark:text-white mt-1.5">{totalDisputes}</span>
        </div>
        <div className="bg-white dark:bg-[#111111] p-4.5 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Active Disputes</span>
          <span className="text-2xl font-black text-red-600 dark:text-red-400 mt-1.5">{openDisputes}</span>
        </div>
        <div className="bg-white dark:bg-[#111111] p-4.5 rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Resolved</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">{resolvedDisputes}</span>
        </div>
        <div className="bg-gradient-to-tr from-rose-500 to-indigo-600 p-4.5 rounded-xl text-white shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-rose-100 uppercase tracking-wider">Agent Dispute Win Rate</span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-black">{winRate}%</span>
            <span className="text-[10px] text-rose-100 font-medium">Approved / Total Resolved</span>
          </div>
        </div>
      </div>

      {/* SPLIT WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Dispute List */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111111] rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm overflow-hidden flex flex-col h-[70vh]">
          {/* List Search */}
          <div className="p-3 border-b border-slate-200/60 dark:border-white/5 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Search case, agent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => setFilterStatus("")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md border ${filterStatus === "" ? "bg-indigo-600 text-white border-transparent" : "bg-slate-50 border-slate-200/60 dark:bg-white/5 dark:border-white/5 text-slate-500 hover:bg-slate-100"}`}
              >
                All
              </button>
              <button 
                onClick={() => setFilterStatus("open")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md border ${filterStatus === "open" ? "bg-indigo-600 text-white border-transparent" : "bg-slate-50 border-slate-200/60 dark:bg-white/5 dark:border-white/5 text-slate-500 hover:bg-slate-100"}`}
              >
                Active
              </button>
              <button 
                onClick={() => setFilterStatus("resolved_approved")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md border ${filterStatus === "resolved_approved" ? "bg-indigo-600 text-white border-transparent" : "bg-slate-50 border-slate-200/60 dark:bg-white/5 dark:border-white/5 text-slate-500 hover:bg-slate-100"}`}
              >
                Approved
              </button>
              <button 
                onClick={() => setFilterStatus("resolved_rejected")}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md border ${filterStatus === "resolved_rejected" ? "bg-indigo-600 text-white border-transparent" : "bg-slate-50 border-slate-200/60 dark:bg-white/5 dark:border-white/5 text-slate-500 hover:bg-slate-100"}`}
              >
                Rejected
              </button>
            </div>
          </div>

          {/* List Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 font-mono animate-pulse">Loading disputes...</div>
            ) : filteredDisputes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No disputes found.</div>
            ) : (
              filteredDisputes.map((d) => {
                const isSelected = selectedDispute && selectedDispute.disputeId === d.disputeId;
                const statusInfo = getStatusBadgeStyle(d.disputeStatus);
                const openDate = new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                return (
                  <div
                    key={d.disputeId}
                    onClick={() => setSelectedDispute(d)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left flex flex-col gap-2 relative ${
                      isSelected ? "bg-indigo-50/10 dark:bg-white/5 border-l-4 border-l-indigo-600 pl-3" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-xs">
                        Case: {d.externalCaseId}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{openDate}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 max-w-[150px] truncate">
                        {d.reasonCategory} {d.agentName ? `• ${d.agentName}` : ""}
                      </span>
                      <span className={`px-1.5 py-0.5 border text-[8px] font-black uppercase rounded-full ${statusInfo.classes}`}>
                        {statusInfo.label.split(" ")[0]}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Dispute Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {selectedDispute ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Timeline, Details and Resolutions (Left Column) */}
              <div className="md:col-span-7 space-y-6">
                
                {/* Dispute details card */}
                <div className="bg-white dark:bg-[#111111] rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert size={12} /> Challenge Overview
                    </span>
                    <span className={`px-2 py-0.5 border text-[9px] font-black uppercase rounded-full ${getStatusBadgeStyle(selectedDispute.disputeStatus).classes}`}>
                      {getStatusBadgeStyle(selectedDispute.disputeStatus).label}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                      Reason Category: {selectedDispute.reasonCategory}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-[#181818]/50 p-3 rounded-lg border border-slate-100 dark:border-white/5">
                      "{selectedDispute.description}"
                    </p>
                  </div>

                  {/* Challenged Questions Checklist */}
                  {getChallengedQuestionsList(selectedDispute.challengedQuestions).length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Challenged Questions</span>
                      <div className="space-y-1.5">
                        {getChallengedQuestionsList(selectedDispute.challengedQuestions).map((q: any) => {
                          const ansObj = selectedDispute.answers?.[q.id] || { value: null, comment: "" };
                          return (
                            <div key={q.id} className="text-[11px] p-2 rounded bg-rose-500/5 border border-rose-500/10 text-slate-700 dark:text-slate-300">
                              <p className="font-bold">{q.questionText}</p>
                              <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-mono mt-0.5">
                                <span>Original Answer: <strong className="uppercase">{ansObj.value ? "Yes" : "No"}</strong></span>
                                {ansObj.comment && <span>• comment: "{ansObj.comment}"</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {selectedDispute.attachmentUrl && (
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/10 text-[11px]">
                      <Paperclip size={12} className="text-indigo-500" />
                      <span className="font-medium text-slate-600 dark:text-slate-300">Evidence attachment:</span>
                      <a href="#" className="font-bold text-indigo-600 hover:underline flex items-center gap-0.5">
                        screenshot.png <ArrowUpRight size={10} />
                      </a>
                    </div>
                  )}
                </div>

                {/* Dispute Timeline Component */}
                <div className="bg-white dark:bg-[#111111] rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm p-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={12} /> Dispute Lifecyle Timeline
                  </h4>

                  <div className="relative border-l-2 border-slate-100 dark:border-white/5 pl-4 ml-2.5 space-y-6">
                    {/* Step 1: Created */}
                    <div className="relative">
                      <div className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white dark:border-[#111111]" />
                      <div className="space-y-0.5 text-left">
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          {new Date(selectedDispute.createdAt).toLocaleString()}
                        </span>
                        <h5 className="text-xs font-bold text-slate-800 dark:text-white">Dispute Formally Logged</h5>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          Agent {selectedDispute.agentName || "Agent"} logged a formal grade dispute regarding {selectedDispute.reasonCategory}.
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Under active review */}
                    {(selectedDispute.disputeStatus === "under_review" || selectedDispute.disputeStatus.startsWith("resolved_")) && (
                      <div className="relative animate-fade-in">
                        <div className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white dark:border-[#111111]" />
                        <div className="space-y-0.5 text-left">
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            {selectedDispute.resolvedAt ? new Date(selectedDispute.resolvedAt).toLocaleString() : "Active Review"}
                          </span>
                          <h5 className="text-xs font-bold text-slate-800 dark:text-white">Under Active QA Review</h5>
                          <p className="text-[10px] text-slate-500 leading-normal">
                            Assigned to compliance and grading operations managers for objective re-evaluation of voice parameters.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Step 3: Discussion Comments */}
                    {comments.length > 0 && (
                      <div className="relative">
                        <div className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white dark:border-[#111111]" />
                        <div className="space-y-0.5 text-left">
                          <h5 className="text-xs font-bold text-slate-800 dark:text-white">Discussion Active</h5>
                          <p className="text-[10px] text-slate-500 leading-normal">
                            {comments.length} coordinate reply log(s) recorded in review discussion thread.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Step 4: Resolved / Closed */}
                    {selectedDispute.disputeStatus.startsWith("resolved_") ? (
                      <div className="relative">
                        <div className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white dark:border-[#111111]" />
                        <div className="space-y-0.5 text-left">
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            {selectedDispute.resolvedAt ? new Date(selectedDispute.resolvedAt).toLocaleString() : ""}
                          </span>
                          <h5 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                            Dispute Resolved: 
                            <span className={selectedDispute.disputeStatus === "resolved_approved" ? "text-emerald-500" : "text-slate-500"}>
                              {selectedDispute.disputeStatus === "resolved_approved" ? "Approved" : "Rejected"}
                            </span>
                          </h5>
                          <p className="text-[10px] text-slate-500 leading-normal">
                            Resolved by {selectedDispute.resolverName || "QA Manager"}. Final score {selectedDispute.disputeStatus === "resolved_approved" ? `adjusted to ${selectedDispute.weightedScore}%` : `upheld at ${selectedDispute.weightedScore}%`}.
                          </p>
                          {selectedDispute.resolutionSummary && (
                            <div className="bg-emerald-50 dark:bg-white/5 p-2 rounded mt-2 border border-emerald-100 dark:border-white/5 text-[9px] text-slate-600 dark:text-slate-400 font-medium">
                              <strong className="text-slate-500">Summary:</strong> "{selectedDispute.resolutionSummary}"
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="relative opacity-40">
                        <div className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-slate-300 border-2 border-white dark:border-[#111111]" />
                        <div className="space-y-0.5 text-left">
                          <h5 className="text-xs font-bold text-slate-400">Resolution Pending</h5>
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Once resolution is processed, scorecard metrics will lock and freeze immediately.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* QA MANAGER RESOLUTION ACTION PANEL */}
                {isManagerOrAuditor && !selectedDispute.disputeStatus.startsWith("resolved_") && (
                  <div className="bg-slate-50 dark:bg-[#151515] rounded-xl border border-slate-200/60 dark:border-white/5 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                        QA MANAGER INTERVENTIONS (ADMIN ACTION)
                      </span>
                      {selectedDispute.disputeStatus === "open" && (
                        <button
                          onClick={updateDisputeStatusToReview}
                          className="px-2.5 py-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          Mark as Under Review
                        </button>
                      )}
                    </div>

                    <div className="border-t border-slate-200 dark:border-white/5 pt-3 space-y-3">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="resolutionAction"
                            checked={resolutionAction === "resolved_approved"}
                            onChange={() => setResolutionAction("resolved_approved")}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Approve Dispute (Recalculate Score)</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="resolutionAction"
                            checked={resolutionAction === "resolved_rejected"}
                            onChange={() => setResolutionAction("resolved_rejected")}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Reject Dispute (Uphold Score)</span>
                        </label>
                      </div>

                      {resolutionAction === "resolved_approved" && (
                        <div className="space-y-1 max-w-[200px]">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            New Final QA Score (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={adjustedScore}
                            onChange={(e) => setAdjustedScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Resolution Summary Comments
                        </label>
                        <textarea
                          value={resolutionComments}
                          onChange={(e) => setResolutionComments(e.target.value)}
                          placeholder="Provide audit decision notes, scoring adjustments explanation, or closing standard feedback..."
                          rows={3}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <button
                        disabled={submittingResolution}
                        onClick={submitResolution}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
                      >
                        <CheckCircle2 size={13} /> 
                        {submittingResolution ? "Processing Resolution..." : "Submit Decision & Lock Score"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Discussion Chat Section (Right Column) */}
              <div className="md:col-span-5 bg-white dark:bg-[#111111] rounded-xl border border-slate-200/60 dark:border-white/10 shadow-sm flex flex-col h-[70vh] overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#151515] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-indigo-600" />
                    <span className="font-bold text-xs text-slate-800 dark:text-white">Discussion replies</span>
                  </div>
                  <span className="bg-slate-200 dark:bg-white/10 text-[9px] font-bold px-1.5 py-0.5 rounded text-slate-500">
                    {comments.length} Comment(s)
                  </span>
                </div>

                {/* Comment Bubbles List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {loadingComments ? (
                    <div className="text-center text-[10px] text-slate-400 py-6 font-mono">Loading discussions...</div>
                  ) : comments.length === 0 ? (
                    <div className="text-center text-[10px] text-slate-400 py-12">
                      No discussion comments yet. Send a professional reply to coordinate resolution.
                    </div>
                  ) : (
                    comments.map((comment) => {
                      const isOwnComment = comment.userId === currentUser.id;
                      const cDate = new Date(comment.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div 
                          key={comment.id}
                          className={`flex flex-col max-w-[85%] ${isOwnComment ? "ml-auto items-end" : "mr-auto items-start"}`}
                        >
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold mb-0.5">
                            <span>{comment.userName}</span>
                            <span>•</span>
                            <span>{cDate}</span>
                          </div>

                          <div className={`p-2.5 rounded-xl text-[11px] leading-relaxed border ${
                            isOwnComment
                              ? "bg-indigo-600 border-transparent text-white rounded-tr-none"
                              : "bg-slate-50 border-slate-200/60 dark:bg-white/5 dark:border-white/5 text-slate-700 dark:text-slate-200 rounded-tl-none"
                          }`}>
                            {comment.commentText}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {/* Chat Input form */}
                {!selectedDispute.disputeStatus.startsWith("resolved_") ? (
                  <form onSubmit={handlePostComment} className="p-3 border-t border-slate-100 dark:border-white/5 flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Type reply..."
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#1c1c1c] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-[#151515] border-t border-slate-100 dark:border-white/5 text-[10px] text-slate-400 text-center font-bold flex items-center justify-center gap-1">
                    <Lock size={12} /> Discussion Locked
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#111111] rounded-xl border border-slate-200/60 dark:border-white/10 p-12 text-center text-slate-400 text-xs">
              Select a dispute challenge from the list to load history timeline and discussions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
