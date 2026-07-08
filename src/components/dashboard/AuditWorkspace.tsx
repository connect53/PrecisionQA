import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Activity, 
  RefreshCw, 
  SlidersHorizontal, 
  ChevronRight, 
  ChevronLeft, 
  UserCheck, 
  ExternalLink,
  ShieldAlert,
  Calendar,
  Calculator,
  Layers,
  ArrowRight,
  Copy,
  Check,
  Lock,
  Save,
  AlertCircle,
  Award,
  TrendingUp,
  User,
  ChevronDown,
  ChevronUp,
  Mic,
  Star,
  Sparkles,
  Info,
  X,
  Play,
  ArrowLeft,
  FileText
} from "lucide-react";
import { FormulaEngine } from "../../lib/formulaEngine";
import { motion, AnimatePresence } from "motion/react";
import { ErrorBoundary } from "../ErrorBoundary";
import { getInitial, safeString, safeArray, safeNumber } from "../../lib/safeUtils";

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

interface AuditWorkspaceProps {
  currentUser: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  addToast: (toast: { title: string; description: string; type: "success" | "error" | "info" }) => void;
}

export default function AuditWorkspace({ currentUser, addToast }: AuditWorkspaceProps) {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [scorecard, setScorecard] = useState<any>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { value: any; comment: string }>>({});
  const [generalComments, setGeneralComments] = useState("");
  const [coachingNotes, setCoachingNotes] = useState("");
  const [strengths, setStrengths] = useState("");
  const [opportunities, setOpportunities] = useState("");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submittingAudit, setSubmittingAudit] = useState(false);

  const isEditable = useMemo(() => {
    if (!selectedCase) return false;
    const isSupervAdmin = [
      "super_admin",
      "admin",
      "qa_manager",
      "manager"
    ].includes(currentUser.role);
    return selectedCase.status === "assigned" || isSupervAdmin;
  }, [selectedCase, currentUser.role]);

  // Workflow Engine States
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [transitionComments, setTransitionComments] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Audio Playback Preview State (Simulated)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Live Auditing Processing Timer (APT)
  const [timerSeconds, setTimerSeconds] = useState(0);

  // AI Feature States
  const [aiSearching, setAiSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState("");
  const [searchSources, setSearchSources] = useState<{ title: string; uri: string }[]>([]);
  const [aiEvaluating, setAiEvaluating] = useState(false);
  const [aiEvaluationDepth, setAiEvaluationDepth] = useState<"standard" | "high_thinking">("standard");
  const [aiReassurance, setAiReassurance] = useState("");

  useEffect(() => {
    if (!selectedCase || !isEditable) return;
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedCase, isEditable]);

  const handleComplianceSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setAiSearching(true);
      setSearchResult("");
      setSearchSources([]);
      
      const res = await fetch("/api/ai/compliance-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery })
      });
      
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResult(data.text);
      setSearchSources(data.sources || []);
    } catch (err) {
      console.error("AI Search failed:", err);
      addToast({
        title: "Policy Search Failed",
        description: "Could not fetch grounded regulatory search results.",
        type: "error"
      });
    } finally {
      setAiSearching(false);
    }
  };

  const handleAiCoAudit = async () => {
    if (!selectedCase || !scorecard) return;
    
    // Flatten scorecard questions list
    const allQuestions: any[] = [];
    safeArray(scorecard.sections).forEach((sec: any) => {
      safeArray(sec.questions).forEach((q: any) => {
        if (q) {
          allQuestions.push({
            id: q.id,
            questionText: q.questionText,
            helpText: q.helpText,
            questionType: q.questionType,
            options: q.options
          });
        }
      });
    });

    if (allQuestions.length === 0) {
      addToast({
        title: "No Questions",
        description: "This scorecard has no questions to evaluate.",
        type: "error"
      });
      return;
    }

    try {
      setAiEvaluating(true);
      
      // Setup reassurance timer interval
      const reassuranceMsgs = [
        "Analyzing dialogue transcript for compliance checkpoints...",
        "Evaluating representative identity verification steps...",
        "Extracting direct quotes and conversation evidence...",
        "Comparing interaction details against scorecard weights...",
        "Formulating audit justifications and drafting growth recommendations..."
      ];
      let msgIndex = 0;
      setAiReassurance(reassuranceMsgs[0]);
      const rInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % reassuranceMsgs.length;
        setAiReassurance(reassuranceMsgs[msgIndex]);
      }, 4000);

      const res = await fetch("/api/ai/evaluate-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id,
          questions: allQuestions,
          depth: aiEvaluationDepth
        })
      });

      clearInterval(rInterval);

      if (!res.ok) throw new Error("Co-Audit failed");
      const data = await res.json();

      // Apply populated grades and comments to state
      const newAnswers: Record<string, { value: any; comment: string }> = { ...answers };
      if (Array.isArray(data.answers)) {
        data.answers.forEach((ans: any) => {
          newAnswers[ans.questionId] = {
            value: ans.value,
            comment: ans.comment
          };
        });
      }
      setAnswers(newAnswers);

      if (data.generalComments) setGeneralComments(data.generalComments);
      if (data.strengths) setStrengths(data.strengths);
      if (data.opportunities) setOpportunities(data.opportunities);

      addToast({
        title: "AI Co-Audit Complete",
        description: `Successfully analyzed case using ${aiEvaluationDepth === "high_thinking" ? "Deep Reasoning Model" : "Standard Flash Model"}. Draft populated.`,
        type: "success"
      });
    } catch (err) {
      console.error("AI Evaluation failed:", err);
      addToast({
        title: "AI Co-Audit Failed",
        description: "An error occurred while compiling AI audit recommendations.",
        type: "error"
      });
    } finally {
      setAiEvaluating(false);
      setAiReassurance("");
    }
  };

  useEffect(() => {
    fetch("/api/workflows")
      .then(r => r.json())
      .then(data => setWorkflows(data || []))
      .catch(err => console.error("Error loading workflows inside AuditWorkspace:", err));
  }, []);

  useEffect(() => {
    if (!auditId) return;
    loadAuditData();
  }, [auditId]);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      // 1. Fetch case details
      const caseRes = await fetch(`/api/assignment/cases`);
      if (!caseRes.ok) throw new Error("Failed to fetch cases");
      const caseContentType = caseRes.headers.get("content-type");
      if (!caseContentType || !caseContentType.includes("application/json")) {
        throw new Error("Expected JSON from cases API, got: " + (await caseRes.text()).substring(0, 100));
      }
      const allCases: CaseRecord[] = await caseRes.json();
      const caseRecord = allCases.find(c => c.id === auditId);
      
      if (!caseRecord) {
        addToast({
          title: "Audit Not Found",
          description: "The requested audit record does not exist or has been deleted.",
          type: "error"
        });
        navigate("/dashboard/audit-queue");
        return;
      }

      // 2. Check permissions - allow super_admin, admin, qa_manager, or original auditor
      const isManagerOrAdmin = [
        "super_admin",
        "admin",
        "qa_manager",
        "manager"
      ].includes(currentUser.role);
      
      if (!isManagerOrAdmin && caseRecord.auditorId !== currentUser.id) {
        addToast({
          title: "Access Denied",
          description: "You do not have permission to perform this audit.",
          type: "error"
        });
        navigate("/dashboard/audit-queue");
        return;
      }

      setSelectedCase(caseRecord);
      setScorecardLoading(true);

      // 3. Fetch current active scorecard layout (including batch-specific form check)
      const scRes = await fetch(`/api/audit/scorecard?caseId=${auditId}`);
      if (!scRes.ok) throw new Error("Failed to load scorecard layout");
      const scContentType = scRes.headers.get("content-type");
      if (!scContentType || !scContentType.includes("application/json")) {
        throw new Error("Expected JSON from scorecard API, got: " + (await scRes.text()).substring(0, 100));
      }
      const scData = await scRes.json();
      setScorecard(scData);

      // Initialize sections collapsed state
      const initialCollapse: Record<string, boolean> = {};
      scData.sections?.forEach((sec: any) => {
        initialCollapse[sec.id] = false; // Expand by default
      });
      setCollapsedSections(initialCollapse);

      // 4. Fetch completed audit results or draft if exists
      const resultsRes = await fetch(`/api/audit/results/${auditId}`);
      if (resultsRes.ok) {
        const resultsContentType = resultsRes.headers.get("content-type");
        if (resultsContentType && resultsContentType.includes("application/json")) {
          const auditData = await resultsRes.json();
          if (auditData) {
            const rawAnswers = auditData.answers || {};
            setAnswers(rawAnswers);
            setGeneralComments(auditData.generalComments || "");
            setCoachingNotes(auditData.coachingNotes || "");
            setStrengths(rawAnswers._strengths || "");
            setOpportunities(rawAnswers._opportunities || "");
            
            if (auditData.status === "draft") {
              addToast({
                title: "Draft Restored",
                description: "Previous progress has been successfully recovered.",
                type: "info"
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      addToast({
        title: "Load Error",
        description: err.message || "Failed to initialize audit workspace.",
        type: "error"
      });
    } finally {
      setLoading(false);
      setScorecardLoading(false);
    }
  };

  const handleWorkflowTransition = async (targetStageId: string) => {
    if (!selectedCase) return;
    setIsTransitioning(true);
    try {
      const res = await fetch("/api/workflows/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id,
          targetStageId,
          comments: transitionComments,
          userId: currentUser.id,
          userEmail: currentUser.email
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedCase(prev => prev ? {
          ...prev,
          status: data.physicalStatus,
          metadata: { ...(prev.metadata || {}), workflowState: data.workflowState }
        } : null);
        setTransitionComments("");
        addToast({
          type: "success",
          title: "Transition Successful",
          description: `Case moved to ${data.workflowState.currentStageName}.`
        });
      } else {
        throw new Error(data.error || "Transition rejected");
      }
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Transition Failed",
        description: err.message
      });
    } finally {
      setIsTransitioning(false);
    }
  };

  const scoresSummary = useMemo(() => {
    if (!scorecard || !scorecard.sections) {
      return { 
        overallScore: 100, 
        complianceScore: 100, 
        isCriticalFailed: false, 
        sectionScores: {} as Record<string, number>, 
        remainingQuestions: 0, 
        answeredQuestions: 0,
        totalQuestions: 0,
        formulaResults: {} as Record<string, any>
      };
    }

    let totalScorecardWeight = 0;
    let overallScoreSum = 0;
    let isCriticalFailed = false;
    const sectionScores: Record<string, number> = {};
    let totalQuestionsCount = 0;
    let answeredQuestionsCount = 0;
    const formulaResults: Record<string, any> = {};
    const contextValues: Record<string, any> = {};

    if (selectedCase) {
      contextValues["id"] = safeString(selectedCase.id);
      contextValues["caseId"] = safeString(selectedCase.caseId);
      contextValues["agentName"] = safeString(selectedCase.agentName);
      contextValues["agentEmail"] = safeString(selectedCase.agentEmail);
      contextValues["client"] = safeString(selectedCase.client);
      contextValues["lob"] = safeString(selectedCase.lob);
      contextValues["auditDate"] = safeString(selectedCase.auditDate);
      contextValues["language"] = safeString(selectedCase.language);
      if (selectedCase.metadata) {
        Object.entries(selectedCase.metadata).forEach(([k, v]) => {
          contextValues[k] = v;
        });
      }
    }

    safeArray(scorecard.sections).forEach((sec: any) => {
      safeArray(sec?.questions).forEach((q: any) => {
        const ans = answers[q?.id];
        if (ans && ans.value !== undefined) {
          contextValues[q.id] = ans.value;
          contextValues[safeString(q?.questionText).split(":")[0]] = ans.value;
        }
      });
    });

    safeArray(scorecard.sections).forEach((sec: any) => {
      safeArray(sec?.questions).forEach((q: any) => {
        if (q && q.questionType === "formula" && q.formula) {
          const result = FormulaEngine.evaluate(q.formula, { 
            values: contextValues,
            currentUser: {
              id: currentUser.id,
              email: currentUser.email,
              name: currentUser.fullName,
              role: currentUser.role as any,
              status: "active",
              createdAt: ""
            },
            now: new Date()
          });
          formulaResults[q.id] = result;
          contextValues[q.id] = result;
          contextValues[safeString(q?.questionText).split(":")[0]] = result;
        }
      });
    });

    safeArray(scorecard.sections).forEach((sec: any) => {
      let secQuestionWeightSum = 0;
      let secScoreSum = 0;
      
      safeArray(sec?.questions).forEach((q: any) => {
        if (!q) return;
        totalQuestionsCount++;
        let ansValue = answers[q.id]?.value;
        if (q.questionType === "formula") ansValue = formulaResults[q.id];
        
        if (ansValue !== undefined && ansValue !== null && ansValue !== "") {
          answeredQuestionsCount++;
          let qScorePct = 0;
          if (q.questionType === "binary") qScorePct = ansValue === "Yes" ? 1.0 : 0.0;
          else if (q.questionType === "rating") qScorePct = (Number(ansValue) || 0) / 5;
          else if (q.questionType === "radio") {
            if (ansValue === "Excellent") qScorePct = 1.0;
            else if (ansValue === "Good") qScorePct = 0.75;
            else if (ansValue === "Fair") qScorePct = 0.5;
            else qScorePct = 0.0;
          } else if (q.questionType === "dropdown") {
            if (ansValue === "Accurate") qScorePct = 1.0;
            else if (ansValue === "Partially Accurate") qScorePct = 0.5;
            else qScorePct = 0.0;
          } else if (q.questionType === "percentage") qScorePct = (Number(ansValue) || 0) / 100;
          else if (q.questionType === "multiselect") {
            const selectedCount = Array.isArray(ansValue) ? ansValue.length : 0;
            qScorePct = Math.min(selectedCount / 4, 1.0);
          } else if (q.questionType === "formula") {
            if (q.formulaOutputType === "number" || q.formulaOutputType === "percentage") {
              const num = Number(ansValue);
              if (!isNaN(num)) qScorePct = q.formulaOutputType === "percentage" ? num / 100 : Math.min(num, 1);
              else qScorePct = 1.0;
            } else if (q.formulaOutputType === "boolean") qScorePct = ansValue === true ? 1.0 : 0.0;
            else qScorePct = 1.0;
          } else qScorePct = 1.0;

          if (q.isCritical && qScorePct === 0) isCriticalFailed = true;
          secScoreSum += qScorePct * safeNumber(q.weight);
        }
        secQuestionWeightSum += safeNumber(q.weight);
      });

      const secScore = secQuestionWeightSum > 0 ? (secScoreSum / secQuestionWeightSum) * 100 : 100;
      if (sec && sec.id) {
        sectionScores[sec.id] = Math.round(secScore * 100) / 100;
        overallScoreSum += (secScore / 100) * safeNumber(sec.weight);
        totalScorecardWeight += safeNumber(sec.weight);
      }
    });

    const calculatedOverall = totalScorecardWeight > 0 ? (overallScoreSum / totalScorecardWeight) * 100 : 100;
    const finalOverall = Math.round(calculatedOverall * 100) / 100;
    const finalCompliance = isCriticalFailed ? 0.0 : finalOverall;

    return {
      overallScore: finalOverall,
      complianceScore: finalCompliance,
      isCriticalFailed,
      sectionScores,
      formulaResults,
      remainingQuestions: totalQuestionsCount - answeredQuestionsCount,
      answeredQuestions: answeredQuestionsCount,
      totalQuestions: totalQuestionsCount
    };
  }, [scorecard, answers, selectedCase, currentUser]);

  const handleSaveDraft = async (silent: boolean = false) => {
    if (!selectedCase || !scorecard || !isEditable) return;
    try {
      const formulaAnswers: Record<string, any> = {};
      Object.entries(scoresSummary.formulaResults).forEach(([id, val]) => {
        formulaAnswers[id] = { value: val, comment: "" };
      });

      const answersPayload = {
        ...answers,
        ...formulaAnswers,
        _strengths: strengths,
        _opportunities: opportunities
      };

      const res = await fetch("/api/audit/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id,
          scorecardId: scorecard.id,
          auditorId: currentUser.id,
          rawScore: scoresSummary.overallScore,
          weightedScore: scoresSummary.complianceScore,
          isCriticalFailed: scoresSummary.isCriticalFailed,
          answers: answersPayload,
          generalComments,
          coachingNotes,
          status: "draft"
        })
      });

      if (!res.ok) throw new Error("Save draft failed");
      setLastSaved(new Date());
      if (!silent) addToast({ title: "Draft Saved", description: "Changes secured on cloud storage.", type: "success" });
    } catch (err) {
      console.error("Draft Save Failure:", err);
      if (!silent) addToast({ title: "Save Failed", description: "Could not sync with server.", type: "error" });
    }
  };

  useEffect(() => {
    if (!selectedCase || !isEditable) return;
    const interval = setInterval(() => handleSaveDraft(true), 30000);
    return () => clearInterval(interval);
  }, [selectedCase, isEditable, answers, generalComments, coachingNotes, strengths, opportunities, scoresSummary]);

  const validateAuditForm = (): boolean => {
    const errors: string[] = [];
    if (!scorecard || !scorecard.sections) return false;
    if (!safeString(generalComments).trim()) errors.push("Overall QA Comments are required.");
    safeArray(scorecard.sections).forEach((sec: any) => {
      safeArray(sec?.questions).forEach((q: any) => {
        if (!q) return;
        const ans = answers[q.id];
        const isAnswered = ans && ans.value !== undefined && ans.value !== null && ans.value !== "";
        if (!isAnswered && safeNumber(q.weight) > 0) {
          errors.push(`Unanswered: "${safeString(sec?.name)}" -> "${safeString(q.questionText).split(":")[0]}"`);
        }
        if (isAnswered && q.isCritical) {
          let isFailed = false;
          if (q.questionType === "binary" && ans.value === "No") isFailed = true;
          else if (q.questionType === "rating" && Number(ans.value) < 3) isFailed = true;
          if (isFailed && (!ans.comment || !safeString(ans.comment).trim())) {
            errors.push(`Comment required for failed critical item: "${safeString(q.questionText).split(":")[0]}"`);
          }
        }
      });
    });
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmitEvaluation = async () => {
    if (!selectedCase || !scorecard) return;
    if (!validateAuditForm()) {
      addToast({ title: "Validation Incomplete", description: "Please complete all mandatory fields.", type: "error" });
      return;
    }
    try {
      setSubmittingAudit(true);
      const formulaAnswers: Record<string, any> = {};
      Object.entries(scoresSummary.formulaResults).forEach(([id, val]) => {
        formulaAnswers[id] = { value: val, comment: "" };
      });
      const answersPayload = { ...answers, ...formulaAnswers, _strengths: strengths, _opportunities: opportunities };
      const res = await fetch("/api/audit/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id,
          scorecardId: scorecard.id,
          auditorId: currentUser.id,
          rawScore: scoresSummary.overallScore,
          weightedScore: scoresSummary.complianceScore,
          isCriticalFailed: scoresSummary.isCriticalFailed,
          answers: answersPayload,
          generalComments,
          coachingNotes,
          durationSeconds: timerSeconds
        })
      });
      if (!res.ok) throw new Error("Submit audit failed");
      addToast({ title: "Audit Finalized", description: "Results posted successfully!", type: "success" });
      navigate("/dashboard/audit-queue");
    } catch (err: any) {
      console.error(err);
      addToast({ title: "Submission Error", description: "Failed to store records.", type: "error" });
    } finally {
      setSubmittingAudit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="animate-spin text-indigo-600" size={40} />
        <p className="text-sm font-bold text-slate-500 font-mono">Initializing Audit Workspace...</p>
      </div>
    );
  }

  if (!selectedCase) {
    return (
      <div className="p-12 text-center space-y-4">
        <AlertTriangle size={48} className="text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold">Audit Case Not Found</h2>
        <button onClick={() => navigate("/dashboard/audit-queue")} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">Back to Queue</button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-50 dark:bg-[#0c0c0c] rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-150 dark:border-white/5 bg-white dark:bg-[#111] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/dashboard/audit-queue")} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest text-indigo-600 font-mono bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md">Workspace</span>
                {!isEditable ? (
                  <span className="text-[10px] font-black tracking-widest text-green-600 font-mono bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded-md flex items-center gap-1"><Lock size={8} /> Read Only</span>
                ) : (
                  <span className="text-[10px] font-black tracking-widest text-amber-600 font-mono bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-sm border border-amber-200/20 animate-pulse">
                    <Clock size={10} className="animate-spin text-amber-500" /> Live Timer: {Math.floor(timerSeconds / 60).toString().padStart(2, "0")}:{(timerSeconds % 60).toString().padStart(2, "0")}
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">Evaluating: <span className="font-mono text-indigo-600">{safeString(selectedCase?.caseId, "-")}</span></h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastSaved && <span className="text-[10px] text-slate-400 font-mono font-bold hidden sm:block">Last Auto-save: {lastSaved.toLocaleTimeString()}</span>}
            <button onClick={() => navigate("/dashboard/audit-queue")} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 transition-colors">Exit Workspace</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-[#FAFAFA] dark:bg-[#080808]">
          {/* Left Panel: Info & Transcription */}
          <div className="lg:col-span-5 border-r border-slate-200 dark:border-white/5 overflow-y-auto p-5 space-y-6">
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="font-extrabold text-sm flex items-center gap-2 border-b border-slate-150 dark:border-white/5 pb-3"><Info size={16} className="text-slate-400" /> Interaction Metadata</h4>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Representative</span><span className="text-xs font-bold">{safeString(selectedCase?.agentName, "Unknown")}</span></div>
                <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Audit Date</span><span className="text-xs font-bold">{selectedCase?.auditDate ? new Date(selectedCase.auditDate).toLocaleDateString() : new Date().toLocaleDateString()}</span></div>
                <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Client Account</span><span className="text-xs font-bold">{safeString(selectedCase?.client, "-")}</span></div>
                <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Business Unit</span><span className="text-xs font-bold">{safeString(selectedCase?.lob, "-")}</span></div>
                {selectedCase?.metadata && Object.entries(selectedCase.metadata)
                  .filter(([key]) => !["interactionId", "recordingUrl", "language", "workflowState", "agentNameRaw"].includes(key))
                  .map(([key, value]) => {
                    const strVal = safeString(value as any, "-");
                    const isUrl = strVal.startsWith("http://") || strVal.startsWith("https://");
                    return (
                      <div key={key}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1 truncate" title={key}>{key}</span>
                        {isUrl ? (
                          <a href={strVal} target="_blank" rel="noopener noreferrer" className="text-xs font-bold truncate block text-indigo-600 dark:text-indigo-400 hover:underline" title={strVal}>{strVal}</a>
                        ) : (
                          <span className="text-xs font-bold truncate block" title={strVal}>{strVal}</span>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            </div>



            {safeArray(scorecard?.sections).map((sec: any) => (
              <div key={sec?.id || Math.random()} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden transition-all">
                <div onClick={() => setCollapsedSections(prev => ({ ...prev, [sec?.id]: !prev[sec?.id] }))} className="p-4 bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-150 dark:border-white/5 flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-xs">{safeString(sec?.name, "Unnamed Section")}</span>
                    <span className="text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 px-1.5 py-0.5 rounded-md">Weight: {safeNumber(sec?.weight)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black font-mono">Sec Score: {scoresSummary.sectionScores[sec?.id] || 0}%</span>
                    {collapsedSections[sec?.id] ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </div>
                </div>
                {!collapsedSections[sec?.id] && (
                  <div className="divide-y divide-slate-150 dark:divide-white/5">
                    {safeArray(sec?.questions).map((q: any) => {
                      if (!q) return null;
                      const ans = answers[q.id] || { value: null, comment: "" };
                      const isReadOnly = !isEditable;
                      return (
                        <div key={q.id} className="p-5 space-y-4 hover:bg-slate-50/30 dark:hover:bg-white/5 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{safeString(q.questionText)}</p>
                              {q.helpText && <p className="text-[11px] text-slate-400 font-medium">{safeString(q.helpText)}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {q.isCritical && <span className="text-[8px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md border border-rose-200/50">CRITICAL</span>}
                              <span className="text-[9px] font-black bg-slate-100 dark:bg-white/10 text-slate-500 px-1.5 py-0.5 rounded-md">{safeNumber(q.weight)} pts</span>
                            </div>
                          </div>
                          <div className="space-y-4">
                            {q.questionType === "binary" && (
                              <div className="flex items-center gap-2 max-w-xs">
                                {["Yes", "No"].map(opt => (
                                  <button key={opt} disabled={isReadOnly} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: { ...(prev[q.id] || {}), value: opt } }))} className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition-all ${ans.value === opt ? (opt === "Yes" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white") : "bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10"}`}>{opt}</button>
                                ))}
                              </div>
                            )}
                            {q.questionType === "rating" && (
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(star => <Star key={star} size={20} className={`cursor-pointer ${star <= (ans.value || 0) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} onClick={() => !isReadOnly && setAnswers(prev => ({ ...prev, [q.id]: { ...(prev[q.id] || {}), value: star } }))} />)}
                              </div>
                            )}
                            {q.questionType === "dropdown" && (
                              <select disabled={isReadOnly} value={safeString(ans.value)} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { ...(prev[q.id] || {}), value: e.target.value } }))} className="w-full max-w-xs p-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold">
                                <option value="">Select...</option>
                                {safeArray(q.options || ["Pass", "Fail", "N/A"]).map((o: string) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            )}
                            {q.questionType === "formula" && (
                              <div className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 flex items-center gap-2 max-w-xs">
                                <Calculator size={14} className="text-blue-500" />
                                <span className="text-xs font-black font-mono">{scoresSummary.formulaResults[q.id] ?? "..."}</span>
                              </div>
                            )}
                            <textarea rows={1} disabled={isReadOnly} placeholder="Evaluator notes..." value={safeString(ans.comment)} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: { ...(prev[q.id] || {}), comment: e.target.value } }))} className="w-full p-2 bg-slate-50 dark:bg-black/20 rounded-xl text-xs border border-slate-200 dark:border-white/5 focus:ring-1 focus:ring-indigo-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* AI Policy Search Panel (Grounded) */}
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-zinc-900/50 dark:to-zinc-950/20 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-150 dark:border-white/5 pb-3">
                <Sparkles size={16} className="text-indigo-500 animate-pulse" />
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">AI Regulatory Grounding Search</h4>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Instantly search regulatory standards, policies, or operational standards (HIPAA, PCI, SOC 2, GLBA) verified via Google Search Grounding.
              </p>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask e.g. What are telephone verification standards?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleComplianceSearch()}
                  className="flex-1 bg-white dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-400 font-bold"
                />
                <button
                  onClick={handleComplianceSearch}
                  disabled={aiSearching || !searchQuery.trim()}
                  className="px-3 bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                >
                  {aiSearching ? "Searching..." : "Search"}
                </button>
              </div>

              {aiSearching && (
                <div className="py-4 text-center space-y-2">
                  <RefreshCw size={18} className="animate-spin text-indigo-500 mx-auto" />
                  <p className="text-[10px] font-black text-slate-400">Grounded Search in progress...</p>
                </div>
              )}

              {searchResult && (
                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800/80 space-y-2 max-h-60 overflow-y-auto text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {searchResult}
                  </div>
                  
                  {searchSources.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Verified Sources</span>
                      <div className="flex flex-wrap gap-1.5">
                        {searchSources.map((src, i) => (
                          <a
                            key={i}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-lg border border-slate-200/50 dark:border-zinc-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                          >
                            <ExternalLink size={10} />
                            {src.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Scorecard */}
          <div className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0c0c0c]">
             {/* Sticky Metrics Header */}
             <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full flex flex-col items-center justify-center font-mono font-black border-2 ${scoresSummary.isCriticalFailed ? "bg-rose-950/80 border-rose-500 text-rose-400" : scoresSummary.complianceScore >= (scorecard?.passing_score || 80) ? "bg-emerald-950/80 border-emerald-500 text-emerald-400" : "bg-amber-950/80 border-amber-500 text-amber-400"}`}>
                    <span className="text-sm">{Math.round(scoresSummary.complianceScore)}%</span>
                    <span className="text-[7px] uppercase mt-0.5">Score</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Evaluation Performance</h4>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold">
                      <span>{scoresSummary.answeredQuestions}/{scoresSummary.totalQuestions} Answered</span>
                      {scoresSummary.isCriticalFailed && <span className="text-rose-400 font-black flex items-center gap-1 animate-pulse"><ShieldAlert size={10} /> CRITICAL FAIL</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {isEditable && (
                    <div className="text-right hidden md:block border-r border-slate-800 pr-6">
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest font-mono">Auditing Time</p>
                      <p className="text-sm font-black text-amber-400 font-mono mt-0.5">
                        {Math.floor(timerSeconds / 60).toString().padStart(2, "0")}:{(timerSeconds % 60).toString().padStart(2, "0")}
                      </p>
                    </div>
                  )}
                  <div className="w-40 space-y-1.5">
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-500"><span>Progress</span><span>{Math.round((scoresSummary.answeredQuestions / (scoresSummary.totalQuestions || 1)) * 100)}%</span></div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5"><div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${(scoresSummary.answeredQuestions / (scoresSummary.totalQuestions || 1)) * 100}%` }} /></div>
                  </div>
                </div>
             </div>

             {/* Scrollable Form */}
             <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {scorecardLoading ? (
                  <div className="py-20 text-center space-y-3"><RefreshCw size={32} className="animate-spin text-indigo-500 mx-auto" /><p className="text-xs font-bold text-slate-400">Loading Form Layout...</p></div>
                ) : !scorecard ? (
                  <div className="py-20 text-center"><AlertTriangle size={32} className="text-rose-500 mx-auto" /><p className="text-sm font-bold text-rose-500 mt-2">Scorecard schema error.</p></div>
                ) : (
                  <div className="space-y-8">
                    {validationErrors.length > 0 && (
                      <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl space-y-2">
                        <h5 className="text-xs font-black text-rose-700 flex items-center gap-1.5"><AlertCircle size={14} /> Submission Errors ({validationErrors.length})</h5>
                        <ul className="list-disc list-inside text-[10px] text-rose-600 space-y-1">{validationErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                      </div>
                    )}

                    {/* AI Copilot Panel */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-sm">
                            <Sparkles size={18} className="animate-pulse" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-indigo-950 dark:text-indigo-100 flex items-center gap-1">
                              AI Quality Copilot
                            </h4>
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">Pre-fill draft grades & quotes with Deep Evidence Audits.</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <select
                            value={aiEvaluationDepth}
                            onChange={(e) => setAiEvaluationDepth(e.target.value as any)}
                            className="bg-white dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none"
                            disabled={aiEvaluating}
                          >
                            <option value="standard">⚡ Standard Audit (Fast)</option>
                            <option value="high_thinking">🧠 Deep Compliance Audit (Thinking Mode)</option>
                          </select>
                          <button
                            onClick={handleAiCoAudit}
                            disabled={aiEvaluating}
                            className={`flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] rounded-lg transition-all shadow-sm ${aiEvaluating ? "opacity-50 cursor-not-allowed animate-pulse" : ""}`}
                          >
                            <Sparkles size={12} />
                            {aiEvaluating ? "Running..." : "Evaluate with AI"}
                          </button>
                        </div>
                      </div>

                      {aiEvaluating && (
                        <div className="p-3 bg-white/70 dark:bg-zinc-900/40 rounded-xl border border-indigo-50/50 dark:border-indigo-950/20 flex items-center gap-3">
                          <RefreshCw className="animate-spin text-indigo-500 shrink-0" size={14} />
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Evaluating Audit Criteria...</p>
                            <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono italic">{aiReassurance}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 bg-white dark:bg-[#151515] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                       <h4 className="font-extrabold text-sm border-b border-slate-100 dark:border-white/5 pb-3">Final Performance Summary</h4>
                       <div className="space-y-4">
                          <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 font-mono">QA Remarks *</label><textarea rows={4} disabled={!isEditable} value={generalComments} onChange={e => setGeneralComments(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl text-xs border border-slate-200 dark:border-white/10" placeholder="Required overall compliance findings..." /></div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 font-mono">Strengths</label><textarea rows={3} disabled={!isEditable} value={strengths} onChange={e => setStrengths(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl text-xs border border-slate-200 dark:border-white/10" /></div>
                             <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 font-mono">Opportunities</label><textarea rows={3} disabled={!isEditable} value={opportunities} onChange={e => setOpportunities(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl text-xs border border-slate-200 dark:border-white/10" /></div>
                          </div>
                       </div>
                    </div>
                  </div>
                )}
             </div>

             {/* Footer Actions */}
             <div className="p-4 border-t border-slate-150 dark:border-white/5 bg-slate-50 dark:bg-[#111] flex items-center justify-between gap-3 shrink-0">
                <div className="hidden sm:block"><span className="text-[10px] font-black text-slate-400 font-mono uppercase">Audit Status: {isEditable ? "Evaluation Mode" : "Locked"}</span></div>
                <div className="flex items-center gap-3">
                   <button onClick={() => navigate("/dashboard/audit-queue")} className="px-4 py-2 text-xs font-bold border rounded-xl hover:bg-slate-100">Cancel</button>
                   {isEditable && (
                     <>
                        <button onClick={() => handleSaveDraft(false)} className="px-4 py-2 text-xs font-bold border rounded-xl bg-white shadow-sm flex items-center gap-2"><Save size={14} /> Save Draft</button>
                        <button onClick={handleSubmitEvaluation} disabled={submittingAudit} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2">{submittingAudit ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />} Submit Audit</button>
                     </>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
