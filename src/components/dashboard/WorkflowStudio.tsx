import React, { useState, useEffect } from "react";
import { 
  GitBranch, Play, Check, AlertTriangle, Clock, Lock, Archive, Plus, 
  Trash2, Edit2, Copy, Download, Folder, FileText, CheckSquare, 
  MessageSquare, Search, Users, Upload, X, Shield, ChevronUp, 
  ChevronDown, Sparkles, BookOpen, UserCheck, RefreshCw, Layers, Save,
  ArrowRight, FileSpreadsheet, Eye, Sliders, Volume2, ShieldCheck, Mail
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WorkflowStudioProps {
  currentUser: any;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
}

interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  color: string; // 'slate' | 'indigo' | 'blue' | 'cyan' | 'violet' | 'purple' | 'amber' | 'orange' | 'rose' | 'emerald' | 'red' | 'teal'
  icon: string; // upload, user_check, clock, alert, etc.
  orderIndex: number;
  sla?: number; // hours
  autoAssignment?: {
    enabled: boolean;
    strategy: "random" | "round_robin" | "balanced";
  };
  autoNotification?: {
    enabled: boolean;
    channels: ("in_app" | "email" | "slack" | "teams")[];
    template: string;
  };
  permissions: {
    viewRoles: string[];
    editRoles: string[];
    approveRoles: string[];
    rejectRoles: string[];
    reopenRoles: string[];
  };
  transitions: string[]; // Target stage IDs
  conditionalRouting?: {
    field: "score" | "critical_error" | "dispute_reason";
    operator: "<" | ">" | "=" | "is_yes";
    value: string;
    targetStageId: string;
    elseStageId: string;
  }[];
  automationRules?: {
    id: string;
    actionType: "assign_qa" | "assign_supervisor" | "notify" | "send_email" | "lock_audit" | "unlock_audit" | "log_activity";
    params: Record<string, any>;
  }[];
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  client: string;
  lob: string;
  process: string;
  category: string;
  tags: string[];
  status: "draft" | "published" | "archived";
  version: string;
  owner: string;
  updatedAt: string;
  stages: WorkflowStage[];
}

// Starter Templates Definition
const STARTER_TEMPLATES: Record<string, Omit<Workflow, "id" | "updatedAt" | "owner">> = {
  voice: {
    name: "Standard Voice Audit Workflow",
    description: "Multi-stage workflow designed for contact center call recordings and speech analysis.",
    client: "all",
    lob: "all",
    process: "Customer Support",
    category: "Voice Audits",
    tags: ["voice", "call_center", "support"],
    status: "draft",
    version: "1.0",
    stages: [
      {
        id: "Imported",
        name: "Call Ingested",
        description: "Audio file and transcript successfully imported.",
        color: "slate",
        icon: "Upload",
        orderIndex: 0,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: ["admin"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: ["Assigned"]
      },
      {
        id: "Assigned",
        name: "Auditor Allocated",
        description: "Assigned to QA specialist via Round Robin routing.",
        color: "indigo",
        icon: "UserCheck",
        orderIndex: 1,
        sla: 24,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: ["admin", "qa_manager"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: ["In Progress"]
      },
      {
        id: "In Progress",
        name: "Audit In Progress",
        description: "QA Engineer actively grading the call recording scorecard.",
        color: "blue",
        icon: "Clock",
        orderIndex: 2,
        sla: 48,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: ["qa_engineer"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: ["Audit Completed"]
      },
      {
        id: "Audit Completed",
        name: "Score Released",
        description: "Audit finished, scores ready to deliver to Agent.",
        color: "emerald",
        icon: "CheckSquare",
        orderIndex: 3,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer", "agent"], editRoles: ["qa_manager"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: ["Feedback Shared", "Dispute Raised"]
      },
      {
        id: "Feedback Shared",
        name: "Feedback Delivered",
        description: "Agent has received scores and audio comments.",
        color: "violet",
        icon: "MessageSquare",
        orderIndex: 4,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer", "agent"], editRoles: ["agent"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: ["Acknowledged", "Dispute Raised"]
      },
      {
        id: "Dispute Raised",
        name: "Dispute Pending Review",
        description: "Agent challenged the score. Routing to Supervisor Review.",
        color: "amber",
        icon: "AlertTriangle",
        orderIndex: 5,
        sla: 48,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer", "agent"], editRoles: ["qa_manager"], approveRoles: ["qa_manager"], rejectRoles: ["qa_manager"], reopenRoles: [] },
        transitions: ["Supervisor Review"]
      },
      {
        id: "Supervisor Review",
        name: "Under Review",
        description: "QA Supervisor assessing the dispute challenge.",
        color: "rose",
        icon: "Users",
        orderIndex: 6,
        permissions: { viewRoles: ["admin", "qa_manager"], editRoles: ["qa_manager"], approveRoles: ["qa_manager"], rejectRoles: ["qa_manager"], reopenRoles: [] },
        transitions: ["Approved", "Closed"]
      },
      {
        id: "Closed",
        name: "Workflow Completed",
        description: "All disputes resolved, final score permanently locked.",
        color: "gray",
        icon: "Lock",
        orderIndex: 7,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer", "agent"], editRoles: [], approveRoles: [], rejectRoles: [], reopenRoles: ["admin"] },
        transitions: []
      }
    ]
  },
  chat: {
    name: "Chat & Social QC Workflow",
    description: "Designed for omnichannel chat transcripts, social feeds, and digital customer interactions.",
    client: "all",
    lob: "all",
    process: "Live Chat support",
    category: "Chat Audits",
    tags: ["chat", "digital", "social"],
    status: "draft",
    version: "1.0",
    stages: [
      {
        id: "Imported",
        name: "Chat Ingested",
        description: "Live chat log loaded.",
        color: "slate",
        icon: "Upload",
        orderIndex: 0,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: ["admin"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: ["Assigned"]
      },
      {
        id: "Assigned",
        name: "Auditor Allocated",
        description: "QA Auditor assigned.",
        color: "indigo",
        icon: "UserCheck",
        orderIndex: 1,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: ["admin"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: ["In Progress"]
      },
      {
        id: "In Progress",
        name: "Audit In Progress",
        description: "Grading chat protocol compliance.",
        color: "blue",
        icon: "Clock",
        orderIndex: 2,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: ["qa_engineer"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: ["Closed"]
      },
      {
        id: "Closed",
        name: "Completed",
        description: "Audit completed successfully.",
        color: "emerald",
        icon: "CheckSquare",
        orderIndex: 3,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer", "agent"], editRoles: [], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: []
      }
    ]
  },
  compliance: {
    name: "Regulatory & Compliance Audit Flow",
    description: "High-security audit process incorporating mandatory Supervisor verification and strict locks.",
    client: "all",
    lob: "all",
    process: "Compliance Review",
    category: "Compliance",
    tags: ["compliance", "regulatory", "audit"],
    status: "draft",
    version: "1.0",
    stages: [
      {
        id: "Imported",
        name: "Imported",
        description: "Record ingested for compliance checking.",
        color: "slate",
        icon: "Upload",
        orderIndex: 0,
        permissions: { viewRoles: ["admin", "qa_manager"], editRoles: ["admin"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: ["In Progress"]
      },
      {
        id: "In Progress",
        name: "In Progress",
        description: "Compliance agent verifying protocol compliance.",
        color: "blue",
        icon: "Clock",
        orderIndex: 1,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: ["qa_engineer"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: ["Supervisor Review"]
      },
      {
        id: "Supervisor Review",
        name: "Supervisor Signoff",
        description: "Must be double-signed by supervisor for compliance approval.",
        color: "rose",
        icon: "Users",
        orderIndex: 2,
        permissions: { viewRoles: ["admin", "qa_manager"], editRoles: ["qa_manager"], approveRoles: ["qa_manager"], rejectRoles: ["qa_manager"], reopenRoles: [] },
        transitions: ["Approved", "Rejected"]
      },
      {
        id: "Approved",
        name: "Compliance Approved",
        description: "Record fully validated, non-critical status passed.",
        color: "emerald",
        icon: "Shield",
        orderIndex: 3,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: [], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: []
      },
      {
        id: "Rejected",
        name: "Non-Compliant Alert",
        description: "Failed compliance standards. CAPA flow triggered.",
        color: "red",
        icon: "AlertTriangle",
        orderIndex: 4,
        permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: ["qa_manager"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
        transitions: []
      }
    ]
  }
};

const COLOR_MAP: Record<string, string> = {
  slate: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800/60",
  indigo: "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900/60",
  blue: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/60",
  cyan: "bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-900/60",
  violet: "bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/60",
  purple: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-900/60",
  amber: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50",
  orange: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-900/50",
  rose: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/60",
  emerald: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/60",
  red: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60",
  teal: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900/60"
};

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Upload: Upload,
  UserCheck: UserCheck,
  Clock: Clock,
  CheckSquare: CheckSquare,
  MessageSquare: MessageSquare,
  Check: Check,
  AlertTriangle: AlertTriangle,
  Search: Search,
  Users: Users,
  X: X,
  Lock: Lock,
  Archive: Archive,
  Shield: Shield
};

export default function WorkflowStudio({ currentUser, addToast }: WorkflowStudioProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [lobs, setLobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Builder state
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [activeBuilderTab, setActiveBuilderTab] = useState<"info" | "stages" | "transitions" | "permissions" | "automation">("info");
  
  // Node stage editor helper modal state
  const [editingStage, setEditingStage] = useState<WorkflowStage | null>(null);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);

  useEffect(() => {
    loadMasterDataAndWorkflows();
  }, []);

  const loadMasterDataAndWorkflows = async () => {
    setLoading(true);
    try {
      // 1. Fetch workflows from specialized api
      const wfRes = await fetch("/api/workflows");
      const wfData = await wfRes.json();
      
      // 2. Fetch clients and lobs from config to map relations
      const configRes = await fetch("/api/admin/config");
      const configData = await configRes.json();

      setClients(configData.clients || []);
      setLobs(configData.lobs || []);

      if (wfData && wfData.length > 0) {
        setWorkflows(wfData);
      } else {
        // Initialize with default templates saved in settings
        const demoWorkflows: Workflow[] = [
          {
            id: "wf-voice-default",
            ...STARTER_TEMPLATES.voice,
            owner: currentUser.email,
            updatedAt: new Date().toISOString()
          } as Workflow
        ];
        setWorkflows(demoWorkflows);
        // Persist default demo
        saveWorkflowsToServer(demoWorkflows);
      }
    } catch (err: any) {
      console.error(err);
      addToast("error", "Failed to load workflow assets", err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveWorkflowsToServer = async (updatedList: Workflow[]) => {
    try {
      const res = await fetch("/api/admin/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "workflows",
          payload: updatedList,
          userId: currentUser.id,
          userEmail: currentUser.email,
          description: "Updated administrative workflow engines list"
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", "Workflow Database Synchronized", "All changes persisted to PostgreSQL store.");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      addToast("error", "Persistence Failure", err.message);
    }
  };

  const handleCreateNew = () => {
    const newWorkflow: Workflow = {
      id: crypto.randomUUID(),
      name: "New Custom Workflow",
      description: "Define custom quality states and routing criteria.",
      client: "all",
      lob: "all",
      process: "Custom Process",
      category: "Custom",
      tags: ["custom"],
      status: "draft",
      version: "1.0",
      owner: currentUser.email,
      updatedAt: new Date().toISOString(),
      stages: [
        {
          id: "Imported",
          name: "Imported",
          description: "Initial case ingestion stage.",
          color: "slate",
          icon: "Upload",
          orderIndex: 0,
          permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: ["admin"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
          transitions: ["Assigned"]
        },
        {
          id: "Assigned",
          name: "Assigned",
          description: "Ready for audit allocation.",
          color: "indigo",
          icon: "UserCheck",
          orderIndex: 1,
          permissions: { viewRoles: ["admin", "qa_manager", "qa_engineer"], editRoles: ["admin"], approveRoles: [], rejectRoles: [], reopenRoles: [] },
          transitions: []
        }
      ]
    };
    setEditingWorkflow(newWorkflow);
    setActiveBuilderTab("info");
    setIsBuilderOpen(true);
  };

  const handleLoadTemplate = (tempKey: string) => {
    const template = STARTER_TEMPLATES[tempKey];
    if (!template) return;
    const newWf: Workflow = {
      ...template,
      id: crypto.randomUUID(),
      name: `${template.name} (${new Date().toLocaleDateString()})`,
      owner: currentUser.email,
      updatedAt: new Date().toISOString()
    };
    const updated = [...workflows, newWf];
    setWorkflows(updated);
    saveWorkflowsToServer(updated);
    addToast("success", "Template Loaded", `Successfully initialized workflow from "${template.name}".`);
  };

  const handleClone = (wf: Workflow) => {
    const cloned: Workflow = {
      ...wf,
      id: crypto.randomUUID(),
      name: `${wf.name} (Copy)`,
      status: "draft",
      version: `${parseFloat(wf.version) + 0.1}`,
      updatedAt: new Date().toISOString()
    };
    const updated = [...workflows, cloned];
    setWorkflows(updated);
    saveWorkflowsToServer(updated);
    addToast("success", "Workflow Cloned", `Created exact copy of ${wf.name}.`);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this workflow? This action is immutable.")) return;
    const updated = workflows.filter(w => w.id !== id);
    setWorkflows(updated);
    saveWorkflowsToServer(updated);
    addToast("warning", "Workflow Purged", "The workflow configuration was safely removed.");
  };

  const handleSaveBuilder = () => {
    if (!editingWorkflow) return;
    
    // Sort stages by order index to be bulletproof
    const sortedStages = [...editingWorkflow.stages].map((st, idx) => ({
      ...st,
      orderIndex: idx
    }));

    const finalWf = {
      ...editingWorkflow,
      stages: sortedStages,
      updatedAt: new Date().toISOString()
    };

    const exists = workflows.some(w => w.id === finalWf.id);
    let updated;
    if (exists) {
      updated = workflows.map(w => w.id === finalWf.id ? finalWf : w);
    } else {
      updated = [...workflows, finalWf];
    }

    setWorkflows(updated);
    saveWorkflowsToServer(updated);
    setIsBuilderOpen(false);
    setEditingWorkflow(null);
  };

  const handleAddStage = () => {
    if (!editingWorkflow) return;
    const newStage: WorkflowStage = {
      id: `custom-stage-${crypto.randomUUID().slice(0, 5)}`,
      name: "New Quality Stage",
      description: "Define audit actions for this stage.",
      color: "blue",
      icon: "Clock",
      orderIndex: editingWorkflow.stages.length,
      permissions: {
        viewRoles: ["admin", "qa_manager", "qa_engineer"],
        editRoles: ["qa_engineer"],
        approveRoles: [],
        rejectRoles: [],
        reopenRoles: []
      },
      transitions: []
    };

    setEditingWorkflow({
      ...editingWorkflow,
      stages: [...editingWorkflow.stages, newStage]
    });
    setEditingStage(newStage);
    setIsStageModalOpen(true);
  };

  const handleUpdateStage = (updatedStage: WorkflowStage) => {
    if (!editingWorkflow) return;
    const updatedStages = editingWorkflow.stages.map(st => st.id === updatedStage.id ? updatedStage : st);
    setEditingWorkflow({
      ...editingWorkflow,
      stages: updatedStages
    });
  };

  const handleMoveStage = (index: number, direction: "up" | "down") => {
    if (!editingWorkflow) return;
    const newStages = [...editingWorkflow.stages];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newStages.length) return;

    // Swap elements
    const temp = newStages[index];
    newStages[index] = newStages[targetIdx];
    newStages[targetIdx] = temp;

    // Re-index
    const reindexed = newStages.map((st, idx) => ({ ...st, orderIndex: idx }));
    setEditingWorkflow({
      ...editingWorkflow,
      stages: reindexed
    });
  };

  const handleDeleteStage = (stageId: string) => {
    if (!editingWorkflow) return;
    const filtered = editingWorkflow.stages.filter(st => st.id !== stageId).map((st, idx) => ({ ...st, orderIndex: idx }));
    setEditingWorkflow({
      ...editingWorkflow,
      stages: filtered
    });
  };

  return (
    <div className="space-y-8" id="workflow-studio-root">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#111111] p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <GitBranch size={22} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-sans">Workflow Studio</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Configure state routing, automatic assignments, conditional review loops, and SLAs dynamically.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCreateNew}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm transition-all flex items-center gap-2"
          >
            <Plus size={16} /> Create Workflow
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="animate-spin text-indigo-600" size={32} />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading Enterprise Workflows...</p>
        </div>
      ) : (
        <>
          {/* OVERVIEW PANEL / TELEMETRY */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="p-5 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Engine Routings</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{workflows.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-500">
                <GitBranch size={18} />
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Published</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                  {workflows.filter(w => w.status === "published").length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-500">
                <Check size={18} />
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Draft Routines</p>
                <p className="text-2xl font-bold text-amber-500 mt-1.5">
                  {workflows.filter(w => w.status === "draft").length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-500">
                <FileText size={18} />
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SLA Active Triggers</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">On-demand</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-500">
                <Clock size={18} />
              </div>
            </div>
          </div>

          {/* TEMPLATE LIBRARY PRESETS */}
          <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/60 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight">Interactive Starter Templates</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Quickly bootstrap standards-compliant enterprise workflows tailored for specific interaction channels.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200/80 dark:border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="text-indigo-600" size={16} />
                    <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Voice Channels</span>
                  </div>
                  <h4 className="text-sm font-medium text-slate-800 dark:text-white mt-1">Voice Quality Assurance</h4>
                  <p className="text-xs text-slate-500 mt-1">Multi-stage audit with advanced compliance filters, Dispute escalation, Supervisor audits, and automatic locks.</p>
                </div>
                <button
                  onClick={() => handleLoadTemplate("voice")}
                  className="mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                >
                  Load Template <ArrowRight size={12} />
                </button>
              </div>

              <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200/80 dark:border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="text-blue-500" size={16} />
                    <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Omnichannel Chat</span>
                  </div>
                  <h4 className="text-sm font-medium text-slate-800 dark:text-white mt-1">Chat & Ticket Audits</h4>
                  <p className="text-xs text-slate-500 mt-1">Compact grading workflow for live-chats, emails, and backoffice support queues.</p>
                </div>
                <button
                  onClick={() => handleLoadTemplate("chat")}
                  className="mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                >
                  Load Template <ArrowRight size={12} />
                </button>
              </div>

              <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200/80 dark:border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-emerald-500" size={16} />
                    <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Compliance</span>
                  </div>
                  <h4 className="text-sm font-medium text-slate-800 dark:text-white mt-1">Compliance & Risk Signoff</h4>
                  <p className="text-xs text-slate-500 mt-1">High-scrutiny processes involving double compliance signoffs, custom alerts, and regulatory gating.</p>
                </div>
                <button
                  onClick={() => handleLoadTemplate("compliance")}
                  className="mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                >
                  Load Template <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* ACTIVE WORKFLOWS GRID */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">Configured Quality Workflows</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {workflows.map((wf) => (
                <div 
                  key={wf.id}
                  className="p-6 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200/80 dark:border-white/5 hover:shadow-md transition-all flex flex-col justify-between gap-5 relative group"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          wf.status === "published" ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40" : 
                          wf.status === "archived" ? "bg-slate-100 text-slate-500 dark:bg-slate-800" : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}>
                          {wf.status}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">v{wf.version}</span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleClone(wf)}
                          title="Clone Workflow"
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <Copy size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            setEditingWorkflow({ ...wf });
                            setActiveBuilderTab("info");
                            setIsBuilderOpen(true);
                          }}
                          title="Edit Workflow"
                          className="p-1.5 text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(wf.id)}
                          title="Delete Workflow"
                          className="p-1.5 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-base font-semibold text-slate-900 dark:text-white mt-3 leading-snug">{wf.name}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{wf.description}</p>

                    {/* Metadata attributes */}
                    <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-slate-400 border-t border-slate-100 dark:border-white/5 pt-3">
                      <div>
                        <span className="font-medium text-slate-500">LOB Allocation:</span>{" "}
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                          {lobs.find(l => l.id === wf.lob)?.name || "Universal / All"}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-500">Process Type:</span>{" "}
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">{wf.process || "Universal"}</span>
                      </div>
                    </div>
                  </div>

                  {/* MINI TIMELINE PATH PREVIEW */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Flowpath Stages ({wf.stages.length})</p>
                    <div className="flex flex-wrap items-center gap-1 bg-slate-50 dark:bg-white/5 p-2 rounded-xl border border-slate-100 dark:border-white/5">
                      {wf.stages.map((st, i) => {
                        const IconComponent = ICON_MAP[st.icon] || Clock;
                        return (
                          <React.Fragment key={st.id}>
                            <div className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border bg-white dark:bg-slate-900">
                              <IconComponent size={10} className="text-indigo-500 shrink-0" />
                              <span className="text-slate-700 dark:text-slate-200">{st.name}</span>
                            </div>
                            {i < wf.stages.length - 1 && <ArrowRight size={10} className="text-slate-300" />}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* FULL SCREEN INTERACTIVE WORKFLOW BUILDER MODAL */}
      <AnimatePresence>
        {isBuilderOpen && editingWorkflow && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white dark:bg-[#0E0E0E] w-full max-w-6xl h-[90vh] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Builder Header */}
              <div className="p-6 border-b border-slate-200/80 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500 rounded-xl text-white">
                    <GitBranch size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editingWorkflow.name}</h2>
                    <p className="text-xs text-slate-500">Dynamically mapping transition routing permissions and SLAs.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveBuilder}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-indigo-500/20"
                  >
                    <Save size={14} /> Save & Publish Engine
                  </button>
                  <button
                    onClick={() => { setIsBuilderOpen(false); setEditingWorkflow(null); }}
                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl text-slate-500 dark:text-slate-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Tabs navigation */}
              <div className="flex border-b border-slate-200/80 dark:border-white/10 px-6 bg-slate-50/50 dark:bg-white/5">
                {[
                  { id: "info", label: "Metadata & Details", icon: FileText },
                  { id: "stages", label: "Interactive Stages List", icon: Layers },
                  { id: "transitions", label: "Connected Transitions", icon: ArrowRight },
                  { id: "permissions", label: "RBAC Gating Controls", icon: Shield },
                  { id: "automation", label: "Automation Rules (Webhooks)", icon: Sliders }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveBuilderTab(tab.id as any)}
                      className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
                        activeBuilderTab === tab.id 
                          ? "border-indigo-600 text-indigo-600 dark:text-white" 
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      }`}
                    >
                      <Icon size={14} /> {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Builder Content Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. METADATA & DETAILS */}
                {activeBuilderTab === "info" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Workflow Name</label>
                        <input
                          type="text"
                          value={editingWorkflow.name}
                          onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                          className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Description</label>
                        <textarea
                          rows={3}
                          value={editingWorkflow.description}
                          onChange={(e) => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })}
                          className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Version</label>
                          <input
                            type="text"
                            value={editingWorkflow.version}
                            onChange={(e) => setEditingWorkflow({ ...editingWorkflow, version: e.target.value })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Status</label>
                          <select
                            value={editingWorkflow.status}
                            onChange={(e) => setEditingWorkflow({ ...editingWorkflow, status: e.target.value as any })}
                            className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm"
                          >
                            <option value="draft">Draft</option>
                            <option value="published">Published (Active)</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Allocated Client Relation</label>
                        <select
                          value={editingWorkflow.client}
                          onChange={(e) => setEditingWorkflow({ ...editingWorkflow, client: e.target.value })}
                          className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm"
                        >
                          <option value="all">Universal / All Clients</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Line of Business (LOB)</label>
                        <select
                          value={editingWorkflow.lob}
                          onChange={(e) => setEditingWorkflow({ ...editingWorkflow, lob: e.target.value })}
                          className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm"
                        >
                          <option value="all">Universal / All LOBs</option>
                          {lobs.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Audit Process Name</label>
                        <input
                          type="text"
                          value={editingWorkflow.process}
                          onChange={(e) => setEditingWorkflow({ ...editingWorkflow, process: e.target.value })}
                          className="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. STAGES CONFIGURATION LIST */}
                {activeBuilderTab === "stages" && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Workflow Routing Stages</h3>
                        <p className="text-xs text-slate-500">Add, reorder, or edit custom audit stages. Drag or use arrow keys to change sequencing.</p>
                      </div>
                      <button
                        onClick={handleAddStage}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-medium flex items-center gap-1.5"
                      >
                        <Plus size={14} /> Add Stage Component
                      </button>
                    </div>

                    <div className="space-y-2">
                      {editingWorkflow.stages.map((st, idx) => {
                        const IconComponent = ICON_MAP[st.icon] || Clock;
                        return (
                          <div
                            key={st.id}
                            className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-slate-400">#{idx + 1}</span>
                              <div className={`p-2 rounded-lg border ${COLOR_MAP[st.color || 'slate']}`}>
                                <IconComponent size={14} />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{st.name}</h4>
                                <p className="text-xs text-slate-500">{st.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="flex flex-col gap-0.5">
                                <button
                                  disabled={idx === 0}
                                  onClick={() => handleMoveStage(idx, "up")}
                                  className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                                >
                                  <ChevronUp size={12} />
                                </button>
                                <button
                                  disabled={idx === editingWorkflow.stages.length - 1}
                                  onClick={() => handleMoveStage(idx, "down")}
                                  className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                                >
                                  <ChevronDown size={12} />
                                </button>
                              </div>

                              <button
                                onClick={() => { setEditingStage(st); setIsStageModalOpen(true); }}
                                className="p-2 hover:bg-indigo-50 dark:hover:bg-white/5 text-indigo-600 rounded-lg"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteStage(st.id)}
                                className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. CONNECTED TRANSITIONS */}
                {activeBuilderTab === "transitions" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Transition & Routing Logic Map</h3>
                      <p className="text-xs text-slate-500">Configure allowable state-to-state routing targets for each stage.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {editingWorkflow.stages.map((st) => (
                        <div key={st.id} className="p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span className={`w-2.5 h-2.5 rounded-full ${COLOR_MAP[st.color || 'slate'].split(' ')[0]}`}></span>
                              {st.name}
                            </h4>
                            <span className="text-xs text-slate-400">Target Destinations</span>
                          </div>

                          <div className="space-y-2">
                            <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Permitted destination stages:</p>
                            <div className="flex flex-wrap gap-2">
                              {editingWorkflow.stages
                                .filter(target => target.id !== st.id)
                                .map((target) => {
                                  const isConnected = st.transitions?.includes(target.id);
                                  return (
                                    <button
                                      key={target.id}
                                      onClick={() => {
                                        const currentTrans = st.transitions || [];
                                        const nextTrans = currentTrans.includes(target.id)
                                          ? currentTrans.filter(id => id !== target.id)
                                          : [...currentTrans, target.id];
                                        
                                        handleUpdateStage({
                                          ...st,
                                          transitions: nextTrans
                                        });
                                      }}
                                      className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
                                        isConnected
                                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                          : "bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-white border-slate-200 dark:border-white/10"
                                      }`}
                                    >
                                      {target.name}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. RBAC ROLE PERMISSIONS */}
                {activeBuilderTab === "permissions" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Role-Based Stage Gating (RBAC)</h3>
                      <p className="text-xs text-slate-500 font-sans">Control which user roles have authorization to view or execute actions on each stage.</p>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-white/5 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="p-4">Stage Name</th>
                            <th className="p-4">Can View</th>
                            <th className="p-4">Can Edit Score</th>
                            <th className="p-4">Can Approve</th>
                            <th className="p-4">Can Reject</th>
                            <th className="p-4">Can Reopen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {editingWorkflow.stages.map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                              <td className="p-4 font-semibold text-slate-800 dark:text-white">{st.name}</td>
                              <td className="p-4">
                                <div className="flex gap-1">
                                  {["admin", "qa_manager", "qa_engineer", "agent"].map(role => (
                                    <button
                                      key={role}
                                      onClick={() => {
                                        const viewRoles = st.permissions.viewRoles || [];
                                        const nextRoles = viewRoles.includes(role) ? viewRoles.filter(r => r !== role) : [...viewRoles, role];
                                        handleUpdateStage({ ...st, permissions: { ...st.permissions, viewRoles: nextRoles } });
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${st.permissions.viewRoles?.includes(role) ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}
                                    >
                                      {role.slice(0, 3)}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex gap-1">
                                  {["admin", "qa_manager", "qa_engineer"].map(role => (
                                    <button
                                      key={role}
                                      onClick={() => {
                                        const editRoles = st.permissions.editRoles || [];
                                        const nextRoles = editRoles.includes(role) ? editRoles.filter(r => r !== role) : [...editRoles, role];
                                        handleUpdateStage({ ...st, permissions: { ...st.permissions, editRoles: nextRoles } });
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${st.permissions.editRoles?.includes(role) ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}
                                    >
                                      {role.slice(0, 3)}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex gap-1">
                                  {["admin", "qa_manager"].map(role => (
                                    <button
                                      key={role}
                                      onClick={() => {
                                        const approveRoles = st.permissions.approveRoles || [];
                                        const nextRoles = approveRoles.includes(role) ? approveRoles.filter(r => r !== role) : [...approveRoles, role];
                                        handleUpdateStage({ ...st, permissions: { ...st.permissions, approveRoles: nextRoles } });
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${st.permissions.approveRoles?.includes(role) ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}
                                    >
                                      {role.slice(0, 3)}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex gap-1">
                                  {["admin", "qa_manager"].map(role => (
                                    <button
                                      key={role}
                                      onClick={() => {
                                        const rejectRoles = st.permissions.rejectRoles || [];
                                        const nextRoles = rejectRoles.includes(role) ? rejectRoles.filter(r => r !== role) : [...rejectRoles, role];
                                        handleUpdateStage({ ...st, permissions: { ...st.permissions, rejectRoles: nextRoles } });
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${st.permissions.rejectRoles?.includes(role) ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}
                                    >
                                      {role.slice(0, 3)}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex gap-1">
                                  {["admin"].map(role => (
                                    <button
                                      key={role}
                                      onClick={() => {
                                        const reopenRoles = st.permissions.reopenRoles || [];
                                        const nextRoles = reopenRoles.includes(role) ? reopenRoles.filter(r => r !== role) : [...reopenRoles, role];
                                        handleUpdateStage({ ...st, permissions: { ...st.permissions, reopenRoles: nextRoles } });
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${st.permissions.reopenRoles?.includes(role) ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}
                                    >
                                      {role.slice(0, 3)}
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. AUTOMATION RULES */}
                {activeBuilderTab === "automation" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Dynamic Stage Event Webhooks & Triggers</h3>
                      <p className="text-xs text-slate-500">Configure automatic task assignments, email dispatches, audit locks/unlocks when a case transitions into a stage.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {editingWorkflow.stages.map((st) => (
                        <div key={st.id} className="p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 space-y-4">
                          <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-2">
                            <span className="text-sm font-bold text-slate-800 dark:text-white">When Case Enters Stage: "{st.name}"</span>
                            <button
                              onClick={() => {
                                const activeRules = st.automationRules || [];
                                const newRule = { id: crypto.randomUUID(), actionType: "notify" as any, params: {} };
                                handleUpdateStage({ ...st, automationRules: [...activeRules, newRule] });
                              }}
                              className="px-2 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg font-medium"
                            >
                              + Add Trigger
                            </button>
                          </div>

                          {st.automationRules && st.automationRules.length > 0 ? (
                            <div className="space-y-3">
                              {st.automationRules.map((rule) => (
                                <div key={rule.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                                  <select
                                    value={rule.actionType}
                                    onChange={(e) => {
                                      const nextRules = st.automationRules?.map(r => r.id === rule.id ? { ...r, actionType: e.target.value as any } : r);
                                      handleUpdateStage({ ...st, automationRules: nextRules });
                                    }}
                                    className="px-3 py-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900 text-xs"
                                  >
                                    <option value="notify">Notify Agent / Auditor</option>
                                    <option value="assign_qa">Assign Auditor via Round Robin</option>
                                    <option value="lock_audit">Lock Scorecard permanently</option>
                                    <option value="unlock_audit">Unlock Scorecard to drafts</option>
                                    <option value="send_email">Send External Email Alert</option>
                                  </select>

                                  <div className="flex-1 text-xs text-slate-500 font-sans">
                                    {rule.actionType === "notify" && "Sends an in-app alert detailing the case movement."}
                                    {rule.actionType === "assign_qa" && "Allocates the auditor from the active queue mapping."}
                                    {rule.actionType === "lock_audit" && "Immutably locks answers and saves weights."}
                                    {rule.actionType === "unlock_audit" && "Re-opens scorecard editing permission."}
                                    {rule.actionType === "send_email" && "Triggers third-party email notifications."}
                                  </div>

                                  <button
                                    onClick={() => {
                                      const nextRules = st.automationRules?.filter(r => r.id !== rule.id);
                                      handleUpdateStage({ ...st, automationRules: nextRules });
                                    }}
                                    className="p-1 hover:bg-rose-50 text-rose-500 rounded"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">No automation triggers configured for this stage.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INDIVIDUAL STAGE CONFIGURATION DETAIL MODAL */}
      <AnimatePresence>
        {isStageModalOpen && editingStage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-[#0E0E0E] w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Configure Quality Stage Details</h3>
                <button
                  onClick={() => { setIsStageModalOpen(false); setEditingStage(null); }}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Stage Name</label>
                  <input
                    type="text"
                    value={editingStage.name}
                    onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Description</label>
                  <input
                    type="text"
                    value={editingStage.description}
                    onChange={(e) => setEditingStage({ ...editingStage, description: e.target.value })}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Stage Theme Color</label>
                    <select
                      value={editingStage.color}
                      onChange={(e) => setEditingStage({ ...editingStage, color: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm"
                    >
                      <option value="slate">Slate (Gray)</option>
                      <option value="indigo">Indigo</option>
                      <option value="blue">Blue</option>
                      <option value="cyan">Cyan</option>
                      <option value="emerald">Emerald</option>
                      <option value="teal">Teal</option>
                      <option value="amber">Amber</option>
                      <option value="orange">Orange</option>
                      <option value="rose">Rose</option>
                      <option value="red">Red</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Stage Visual Icon</label>
                    <select
                      value={editingStage.icon}
                      onChange={(e) => setEditingStage({ ...editingStage, icon: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm"
                    >
                      <option value="Upload">Upload File</option>
                      <option value="UserCheck">Assign User</option>
                      <option value="Clock">Clock (In Progress)</option>
                      <option value="CheckSquare">Completed Checkbox</option>
                      <option value="MessageSquare">Feedback Dialog</option>
                      <option value="AlertTriangle">Alert Caution</option>
                      <option value="Search">Search</option>
                      <option value="Users">Multi-Users</option>
                      <option value="Lock">Locked padlock</option>
                      <option value="Archive">Archived folder</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">SLA Resolution Time (Hours)</label>
                    <input
                      type="number"
                      value={editingStage.sla || ""}
                      onChange={(e) => setEditingStage({ ...editingStage, sla: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="No SLA"
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex justify-end gap-2">
                <button
                  onClick={() => { setIsStageModalOpen(false); setEditingStage(null); }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (editingStage) {
                      handleUpdateStage(editingStage);
                      setIsStageModalOpen(false);
                      setEditingStage(null);
                      addToast("success", "Stage Configured", "Quality Stage metadata updated.");
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
                >
                  Apply Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
