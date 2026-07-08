import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, Trash2, Edit, Copy, Download, Upload, Play, Check, X, 
  ChevronDown, ChevronUp, Sliders, HelpCircle, Activity, Eye, 
  Save, FileText, Sparkles, Lock, Shield, Search, ArrowLeft, 
  Calculator, Settings, AlertCircle, GripVertical, Info, RefreshCw, Star, Layers, CheckCircle2, ShieldAlert
} from "lucide-react";
import { User, UserRole } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { FormulaEngine } from "../../lib/formulaEngine";

// Form Studio specific interfaces
interface ValidationRule {
  type: "regex" | "min_max" | "custom";
  pattern?: string;
  min?: number;
  max?: number;
  errorMessage: string;
}

interface LookupConfig {
  source: "auditors" | "agents" | "teams" | "custom";
  customOptions?: string[];
}

interface Question {
  id: string;
  questionText: string;
  helpText?: string;
  tooltip?: string;
  placeholder?: string;
  defaultValue?: string;
  questionType: string;
  weight: number;
  isCritical: boolean;
  mandatory: boolean;
  readOnly: boolean;
  hidden: boolean;
  negativeMarks?: number;
  options?: string[];
  formula?: string;
  formulaOutputType?: "text" | "number" | "percentage" | "date" | "boolean";
  validationRules?: ValidationRule | null;
  lookupConfig?: LookupConfig | null;
}

interface Section {
  id: string;
  name: string;
  description?: string;
  weight: number;
  collapsible: boolean;
  hidden: boolean;
  visibilityRule?: {
    dependsOnQuestionId: string;
    condition: "equals" | "not_equals" | "contains";
    value: string;
  } | null;
  questions: Question[];
}

interface ScorecardForm {
  id?: string;
  name: string;
  description: string;
  client: string;
  lobId: string;
  process: string;
  category: string;
  version: string;
  status: "draft" | "published" | "archived";
  tags: string[];
  passingScore: number;
  sections: Section[];
}

interface PrecisionFormStudioProps {
  currentUser: User;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
}

export default function PrecisionFormStudio({ currentUser, addToast }: PrecisionFormStudioProps) {
  // Navigation / Mode state
  // "dashboard" | "create" | "edit" | "preview"
  const [viewMode, setViewMode] = useState<"dashboard" | "editor" | "preview">("dashboard");
  
  // Loaded forms list
  const [forms, setForms] = useState<ScorecardForm[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Options loaded from Admin Console
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [lobs, setLobs] = useState<{ id: string; name: string }[]>([]);
  const [processes, setProcesses] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Editing Form state
  const [selectedForm, setSelectedForm] = useState<ScorecardForm | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<"meta" | "sections" | "formulas" | "preview">("meta");

  // Section / Question expansion state
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // Preview evaluation state
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const [previewComments, setPreviewComments] = useState<Record<string, string>>({});

  // AI Scorecard Generation States
  const [aiIndustry, setAiIndustry] = useState<string>("");
  const [aiGoal, setAiGoal] = useState<string>("");
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);

  const handleGenerateAiScorecard = async () => {
    if (!selectedForm) return;
    if (!aiIndustry) {
      addToast("error", "Industry is required", "Please specify an industry sector to generate a scorecard draft.");
      return;
    }

    try {
      setAiGenerating(true);
      const res = await fetch("/api/ai/generate-scorecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: aiIndustry,
          lob: selectedForm.lobId || selectedForm.category || "General operations",
          goal: aiGoal
        })
      });

      if (!res.ok) throw new Error("AI Scorecard Generation failed");
      const data = await res.json();

      if (data && Array.isArray(data.sections)) {
        // Build the generated sections with unique UUIDs for sections and questions
        const mappedSections: Section[] = data.sections.map((sec: any) => ({
          id: crypto.randomUUID(),
          name: sec.name || "Generated Section",
          description: sec.description || `Assessment parameters for ${sec.name}`,
          weight: Number(sec.weight) || 50,
          collapsible: true,
          hidden: false,
          visibilityRule: null,
          questions: (sec.questions || []).map((q: any) => ({
            id: crypto.randomUUID(),
            questionText: q.questionText,
            helpText: q.helpText || "",
            questionType: q.questionType === "binary" ? "yes_no" : q.questionType === "rating" ? "rating_5" : "dropdown",
            weight: Number(q.weight) || 10,
            isCritical: !!q.isCritical,
            mandatory: true,
            readOnly: false,
            hidden: false,
            options: q.questionType === "binary" ? ["Yes", "No", "N/A"] : q.questionType === "dropdown" ? ["Pass", "Fail", "N/A"] : undefined
          }))
        }));

        setSelectedForm(prev => {
          if (!prev) return null;
          return {
            ...prev,
            sections: mappedSections
          };
        });

        // Switch to sections tab to let them edit
        setActiveEditorTab("sections");
        addToast("success", "AI Scorecard Draft Generated", "Drafted complete scorecard schema based on your criteria. You can now adjust weights or questions.");
      }
    } catch (err) {
      console.error("AI Scorecard Draft generation error:", err);
      addToast("error", "Generation Failed", "Could not compile custom scorecard sections via Gemini.");
    } finally {
      setAiGenerating(false);
    }
  };

  // Security constraint checks
  const canEdit = useMemo(() => {
    return (
      currentUser.role === "super_admin" || 
      currentUser.role === "admin" || 
      currentUser.role === "qa_manager" ||
      String(currentUser.role).toLowerCase() === "super admin"
    );
  }, [currentUser.role]);

  // Load all data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/form-studio/scorecards");
      if (res.ok) {
        const data = await res.json();
        setForms(data);
      } else {
        throw new Error("Failed to load forms from API.");
      }

      // Load admin lookup values (clients, lobs, processes, etc.)
      const adminRes = await fetch("/api/admin/config");
      if (adminRes.ok) {
        const adminData = await adminRes.json();
        setClients(adminData.clients || []);
        setLobs(adminData.lobs || []);
        setProcesses(adminData.processes || []);
        setCategories(adminData.auditCategories || []);
      }
    } catch (err: any) {
      console.error(err);
      addToast("error", "Data Load Error", err.message || "Failed to load forms schema.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Forms List
  const filteredForms = useMemo(() => {
    return forms.filter(f => {
      const matchesSearch = 
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.tags && f.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
      
      const matchesStatus = statusFilter === "all" || f.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || f.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [forms, searchQuery, statusFilter, categoryFilter]);

  // Bento-grid metrics
  const metrics = useMemo(() => {
    return {
      total: forms.length,
      published: forms.filter(f => f.status === "published").length,
      draft: forms.filter(f => f.status === "draft").length,
      archived: forms.filter(f => f.status === "archived").length,
    };
  }, [forms]);

  // Initialize new blank form
  const handleInitNewForm = () => {
    if (!canEdit) {
      addToast("warning", "Access Restrained", "Only administrators can build and configure QA templates.");
      return;
    }
    const newForm: ScorecardForm = {
      name: "",
      description: "",
      client: "",
      lobId: "",
      process: "",
      category: "voice",
      version: "1.0",
      status: "draft",
      tags: [],
      passingScore: 80,
      sections: [
        {
          id: crypto.randomUUID(),
          name: "Section 1: General Quality & Demeanor",
          description: "Assessment of initial greeting, verification protocols, and basic representative soft skills.",
          weight: 100,
          collapsible: true,
          hidden: false,
          visibilityRule: null,
          questions: [
            {
              id: crypto.randomUUID(),
              questionText: "Did the representative provide a professional greeting?",
              helpText: "Check for corporate brand compliance, name introduction, and helpful starting posture.",
              questionType: "yes_no",
              weight: 20,
              isCritical: false,
              mandatory: true,
              readOnly: false,
              hidden: false,
              options: ["Yes", "No", "N/A"]
            },
            {
              id: crypto.randomUUID(),
              questionText: "Professional Tone & Empathy: Rate the representative's demeanor.",
              helpText: "Greeting, tone, active listening, and rapport-building parameters.",
              questionType: "rating_5",
              weight: 30,
              isCritical: false,
              mandatory: true,
              readOnly: false,
              hidden: false
            }
          ]
        }
      ]
    };
    setSelectedForm(newForm);
    setActiveEditorTab("meta");
    setViewMode("editor");
  };

  // Open existing form for editing
  const handleEditForm = (form: ScorecardForm) => {
    // Clone form state deeply to prevent inline mutations
    const cloned = JSON.parse(JSON.stringify(form));
    setSelectedForm(cloned);
    setActiveEditorTab("meta");
    setViewMode("editor");
    
    // Clear preview states
    setPreviewAnswers({});
    setPreviewComments({});
  };

  // Clone an existing form
  const handleCloneForm = async (form: ScorecardForm) => {
    if (!canEdit) {
      addToast("warning", "Access Restrained", "Only administrators can clone scorecard templates.");
      return;
    }
    if (!form.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/form-studio/scorecards/${form.id}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (res.ok) {
        addToast("success", "Template Cloned", `Successfully created cloned copy of ${form.name}`);
        loadData();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to clone template.");
      }
    } catch (e: any) {
      addToast("error", "Clone Failed", e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Soft-delete form
  const handleDeleteForm = async (form: ScorecardForm) => {
    if (!canEdit) {
      addToast("warning", "Access Restrained", "Only administrators can delete scorecard templates.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${form.name}? This will remove it from active workspaces.`)) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/form-studio/scorecards/${form.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        addToast("success", "Template Deleted", `Successfully archived/deleted ${form.name}`);
        loadData();
      } else {
        throw new Error("Failed to delete form.");
      }
    } catch (e: any) {
      addToast("error", "Deletion Failed", e.message);
      setIsLoading(false);
    }
  };

  // Save/Publish active form
  const handleSaveActiveForm = async () => {
    if (!selectedForm) return;

    // Validation checks
    if (!selectedForm.name.trim()) {
      addToast("error", "Validation Error", "Form Name is a required field.");
      return;
    }

    // Validate weights sum to 100% across sections
    const totalSectionWeight = selectedForm.sections.reduce((acc, s) => acc + (Number(s.weight) || 0), 0);
    if (totalSectionWeight !== 100 && selectedForm.sections.length > 0) {
      if (!window.confirm(`Section weights sum to ${totalSectionWeight}%, not 100%. The evaluation score will be calculated dynamically. Proceed anyway?`)) {
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/form-studio/scorecards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectedForm,
          userId: currentUser.id
        })
      });

      if (res.ok) {
        const resData = await res.json();
        addToast("success", "Form Template Saved", `${selectedForm.name} has been saved successfully in '${selectedForm.status}' state.`);
        setViewMode("dashboard");
        loadData();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save form structure.");
      }
    } catch (err: any) {
      addToast("error", "Save Failed", err.message);
      setIsLoading(false);
    }
  };

  // Export Form Schema to JSON
  const handleExportJSON = (form: ScorecardForm) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(form, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${form.name.toLowerCase().replace(/\s+/g, "_")}_schema.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast("info", "Schema Exported", "Form template config downloaded successfully.");
  };

  // Import Form Schema from JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) {
      addToast("warning", "Access Restrained", "Only administrators can import scorecard schemas.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === "object" && parsed.name && parsed.sections) {
          // Reset ID to let it save as a new form
          delete parsed.id;
          parsed.sections.forEach((s: any) => {
            delete s.id;
            if (s.questions) {
              s.questions.forEach((q: any) => delete q.id);
            }
          });
          setSelectedForm(parsed);
          setViewMode("editor");
          setActiveEditorTab("meta");
          addToast("success", "JSON Import Successful", `Loaded blueprint: ${parsed.name}`);
        } else {
          throw new Error("Invalid schema structure. Missing required properties like name or sections.");
        }
      } catch (err: any) {
        addToast("error", "Import Failed", err.message || "Failed to parse JSON schema file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Clear file input
  };

  // Helper functions for inline form mutation
  const updateFormMeta = (key: keyof ScorecardForm, value: any) => {
    if (!selectedForm) return;
    setSelectedForm({
      ...selectedForm,
      [key]: value
    });
  };

  const addSection = () => {
    if (!selectedForm) return;
    const newSection: Section = {
      id: crypto.randomUUID(),
      name: `New Section ${selectedForm.sections.length + 1}`,
      description: "",
      weight: 0,
      collapsible: true,
      hidden: false,
      visibilityRule: null,
      questions: []
    };
    setSelectedForm({
      ...selectedForm,
      sections: [...selectedForm.sections, newSection]
    });
    setExpandedSectionId(newSection.id);
  };

  const removeSection = (sectionId: string) => {
    if (!selectedForm) return;
    setSelectedForm({
      ...selectedForm,
      sections: selectedForm.sections.filter(s => s.id !== sectionId)
    });
    if (expandedSectionId === sectionId) {
      setExpandedSectionId(null);
    }
  };

  const updateSection = (sectionId: string, updatedFields: Partial<Section>) => {
    if (!selectedForm) return;
    setSelectedForm({
      ...selectedForm,
      sections: selectedForm.sections.map(s => s.id === sectionId ? { ...s, ...updatedFields } : s)
    });
  };

  const addQuestion = (sectionId: string) => {
    if (!selectedForm) return;
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      questionText: "New Evaluation Checkpoint Statement",
      helpText: "",
      questionType: "yes_no",
      weight: 10,
      isCritical: false,
      mandatory: true,
      readOnly: false,
      hidden: false,
      options: ["Yes", "No", "N/A"]
    };
    setSelectedForm({
      ...selectedForm,
      sections: selectedForm.sections.map(s => {
        if (s.id === sectionId) {
          return {
            ...s,
            questions: [...s.questions, newQuestion]
          };
        }
        return s;
      })
    });
    setActiveQuestionId(newQuestion.id);
  };

  const removeQuestion = (sectionId: string, questionId: string) => {
    if (!selectedForm) return;
    setSelectedForm({
      ...selectedForm,
      sections: selectedForm.sections.map(s => {
        if (s.id === sectionId) {
          return {
            ...s,
            questions: s.questions.filter(q => q.id !== questionId)
          };
        }
        return s;
      })
    });
    if (activeQuestionId === questionId) {
      setActiveQuestionId(null);
    }
  };

  const updateQuestion = (sectionId: string, questionId: string, updatedFields: Partial<Question>) => {
    if (!selectedForm) return;
    setSelectedForm({
      ...selectedForm,
      sections: selectedForm.sections.map(s => {
        if (s.id === sectionId) {
          return {
            ...s,
            questions: s.questions.map(q => q.id === questionId ? { ...q, ...updatedFields } : q)
          };
        }
        return s;
      })
    });
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    if (!selectedForm) return;
    const sections = [...selectedForm.sections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    
    // Swap
    const temp = sections[index];
    sections[index] = sections[targetIndex];
    sections[targetIndex] = temp;

    setSelectedForm({
      ...selectedForm,
      sections
    });
  };

  const moveQuestion = (sectionId: string, qIndex: number, direction: "up" | "down") => {
    if (!selectedForm) return;
    setSelectedForm({
      ...selectedForm,
      sections: selectedForm.sections.map(s => {
        if (s.id === sectionId) {
          const questions = [...s.questions];
          const targetIndex = direction === "up" ? qIndex - 1 : qIndex + 1;
          if (targetIndex < 0 || targetIndex >= questions.length) return s;
          
          const temp = questions[qIndex];
          questions[qIndex] = questions[targetIndex];
          questions[targetIndex] = temp;
          
          return { ...s, questions };
        }
        return s;
      })
    });
  };

  // Preview Real-time Formula Evaluation Engine Integration
  const calculatedScores = useMemo(() => {
    if (!selectedForm) return { overallScore: 100, isCriticalFailed: false, formulaOutputs: {} as Record<string, any> };

    const contextValues: Record<string, any> = {};
    
    // Fill values based on preview states
    selectedForm.sections.forEach(sec => {
      sec.questions.forEach(q => {
        const ans = previewAnswers[q.id];
        if (ans !== undefined) {
          contextValues[q.id] = ans;
          contextValues[q.questionText.split(":")[0]] = ans;
        } else {
          // Default fallbacks
          contextValues[q.id] = q.defaultValue !== undefined ? q.defaultValue : null;
        }
      });
    });

    const formulaOutputs: Record<string, any> = {};

    // Evaluate formula questions
    selectedForm.sections.forEach(sec => {
      sec.questions.forEach(q => {
        if (q.questionType === "formula" && q.formula) {
          const result = FormulaEngine.evaluate(q.formula, {
            values: contextValues,
            currentUser,
            now: new Date()
          });
          formulaOutputs[q.id] = result;
          contextValues[q.id] = result;
        }
      });
    });

    // Score calculations
    let totalScoreSum = 0;
    let sectionWeightsSum = 0;
    let isCriticalFailed = false;

    selectedForm.sections.forEach(sec => {
      let secQuestionWeightSum = 0;
      let secScoreSum = 0;

      sec.questions.forEach(q => {
        const val = contextValues[q.id];
        if (val !== undefined && val !== null) {
          let qScorePct = 0;
          if (q.questionType === "yes_no" || q.questionType === "binary" || q.questionType === "checkbox") {
            const isYes = String(val).toLowerCase() === "yes" || val === true || String(val).toLowerCase() === "accurate";
            qScorePct = isYes ? 1.0 : 0.0;
          } else if (q.questionType === "rating_5") {
            qScorePct = (Number(val) || 0) / 5;
          } else if (q.questionType === "rating_10") {
            qScorePct = (Number(val) || 0) / 10;
          } else if (q.questionType === "percentage" || q.questionType === "slider") {
            qScorePct = (Number(val) || 0) / 100;
          } else if (q.questionType === "dropdown" || q.questionType === "radio") {
            // Check if options exist. Score is 1.0 if it's the first option or proportional
            const isFirst = q.options && q.options.indexOf(String(val)) === 0;
            qScorePct = isFirst ? 1.0 : 0.5; // fallback
          } else {
            qScorePct = 1.0; // visual text non-scoring
          }

          if (q.isCritical && qScorePct === 0) {
            isCriticalFailed = true;
          }

          secScoreSum += qScorePct * q.weight;
          secQuestionWeightSum += q.weight;
        }
      });

      const secPct = secQuestionWeightSum > 0 ? (secScoreSum / secQuestionWeightSum) * 100 : 100;
      totalScoreSum += secPct * (sec.weight / 100);
      sectionWeightsSum += sec.weight;
    });

    const finalScore = isCriticalFailed ? 0 : Math.round(totalScoreSum);

    return {
      overallScore: isNaN(finalScore) ? 100 : finalScore,
      isCriticalFailed,
      formulaOutputs
    };
  }, [selectedForm, previewAnswers]);

  return (
    <div className="space-y-6" id="precision-form-studio">
      {/* HEADER HUD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150 dark:border-white/5 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-950/20 px-2.5 py-1 rounded-md border border-indigo-100 dark:border-indigo-900/30">
              Form Studio Console
            </span>
            <span className="text-[10px] text-slate-500 font-mono font-bold flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md border border-slate-200/50 dark:border-white/5">
              <Shield size={12} className={canEdit ? "text-indigo-500" : "text-amber-500"} />
              Role: {canEdit ? "Template Designer" : "Reviewer (Read-Only)"}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Precision Form Studio
          </h1>
          <p className="text-xs text-slate-500 max-w-2xl font-medium leading-relaxed">
            Configure enterprise-grade scorecard guidelines, formula validators, field dependency triggers, and QA forms for high-performance omnichannel auditing.
          </p>
        </div>

        {/* TOP LEVEL ACTION BUTTONS */}
        {viewMode === "dashboard" && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-250 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 transition-all">
              <Upload size={14} />
              Import Schema
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportJSON} 
                className="hidden" 
                disabled={!canEdit}
              />
            </label>
            <button
              onClick={handleInitNewForm}
              disabled={!canEdit}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/10 text-xs font-bold transition-all disabled:opacity-50"
            >
              <Plus size={16} /> Create QA Template
            </button>
          </div>
        )}

        {viewMode !== "dashboard" && (
          <button
            onClick={() => setViewMode("dashboard")}
            className="flex items-center gap-1 px-3 py-2 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        )}
      </div>

      {/* VIEW: DASHBOARD PANEL */}
      {viewMode === "dashboard" && (
        <div className="space-y-6">
          {/* Bento metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Form Blueprints", value: metrics.total, icon: Layers, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20" },
              { label: "Published QA Forms", value: metrics.published, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" },
              { label: "Draft Templates", value: metrics.draft, icon: FileText, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20" },
              { label: "Archived & Legacy", value: metrics.archived, icon: Trash2, color: "text-slate-500 bg-slate-100 dark:bg-white/5" }
            ].map((m, i) => (
              <div key={i} className="bg-white dark:bg-[#111111] p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">{m.label}</span>
                  <div className={`p-1.5 rounded-lg ${m.color}`}><m.icon size={14} /></div>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Search and filter row */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-[#111111] p-3 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search templates by form name, description, category or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-[#151515] border border-slate-250 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 bg-slate-50 dark:bg-[#151515] border border-slate-250 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-semibold focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="p-2 bg-slate-50 dark:bg-[#151515] border border-slate-250 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-semibold focus:outline-none"
              >
                <option value="all">All Channels</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Form List table */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/5">
              <RefreshCw className="animate-spin text-indigo-500 mb-2" size={24} />
              <span className="text-xs font-semibold text-slate-500">Loading Form Blueprints...</span>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/5">
              <Sliders className="text-slate-400 mb-3" size={32} />
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">No Scorecards Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">Try modifying your filters, importing a blueprint file, or creating a new QA scorecard template.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-150 dark:border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                      <th className="py-3 px-4">Form Template Name</th>
                      <th className="py-3 px-4">LOB / Channel</th>
                      <th className="py-3 px-4">Questions</th>
                      <th className="py-3 px-4">Version</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-white/5">
                    {filteredForms.map((form) => {
                      const totalQuestions = form.sections.reduce((acc, s) => acc + s.questions.length, 0);
                      const lobName = lobs.find(l => l.id === form.lobId)?.name || "Global / Universal";
                      
                      return (
                        <tr key={form.id} className="hover:bg-slate-50/20 dark:hover:bg-white/5 transition-colors text-xs font-medium">
                          <td className="py-3.5 px-4 space-y-1">
                            <p className="font-bold text-slate-900 dark:text-white">{form.name}</p>
                            <p className="text-[11px] text-slate-400 font-medium truncate max-w-md">{form.description}</p>
                            {form.tags && form.tags.length > 0 && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                {form.tags.map((t, i) => (
                                  <span key={i} className="text-[8px] font-black font-mono tracking-wider bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-slate-500 uppercase">{t}</span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 space-y-1">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{lobName}</span>
                            <div className="text-[10px] font-mono text-slate-400 capitalize">{form.category} Stream</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{totalQuestions} Checkpoints</div>
                            <div className="text-[10px] font-mono text-slate-400">{form.sections.length} Sections</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-500">v{form.version}</td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 text-[9px] uppercase font-black tracking-widest font-mono px-2 py-0.5 rounded-full border ${
                              form.status === "published" 
                                ? "bg-green-50 border-green-200/50 text-green-700 dark:bg-green-950/20 dark:border-green-900/30 dark:text-green-400" 
                                : form.status === "draft"
                                ? "bg-amber-50 border-amber-200/50 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400"
                                : "bg-slate-100 border-slate-200/50 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-400"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                form.status === "published" ? "bg-emerald-500" : form.status === "draft" ? "bg-amber-500" : "bg-slate-400"
                              }`} />
                              {form.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditForm(form)}
                                className="p-1.5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-600 dark:text-slate-300 transition-all"
                                title={canEdit ? "Edit Schema" : "View Details"}
                              >
                                {canEdit ? <Edit size={14} /> : <Eye size={14} />}
                              </button>
                              <button
                                onClick={() => handleCloneForm(form)}
                                className="p-1.5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-600 dark:text-slate-300 transition-all"
                                title="Clone Template"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => handleExportJSON(form)}
                                className="p-1.5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-600 dark:text-slate-300 transition-all"
                                title="Export Schema (JSON)"
                              >
                                <Download size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteForm(form)}
                                className="p-1.5 border border-slate-200 dark:border-white/10 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-slate-600 hover:text-rose-600 transition-all"
                                title="Delete Blueprint"
                                disabled={!canEdit}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: FORM EDITOR PANELS */}
      {viewMode === "editor" && selectedForm && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel tabs/configuration options (8 Columns) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Editor Workspace tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#111111] p-1.5 rounded-xl border">
              {[
                { id: "meta", label: "Form Info Settings", icon: Settings },
                { id: "sections", label: "Sections & Questions", icon: Sliders },
                { id: "formulas", label: "Advanced Logic / Formulas", icon: Calculator },
                { id: "preview", label: "Live Interactive Preview", icon: Eye }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveEditorTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeEditorTab === tab.id
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT: FORM METADATA */}
            {activeEditorTab === "meta" && (
              <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-6">
                
                {/* AI Scorecard Draft Architect Card */}
                {canEdit && (
                  <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/15 p-5 rounded-2xl border border-violet-100 dark:border-violet-900/30 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-violet-600 text-white rounded-lg shadow-sm">
                        <Sparkles size={16} className="animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-violet-900 dark:text-violet-200">AI Scorecard Draft Architect</h4>
                        <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">Instantly generate structured scorecard sections and questions matching your industry operations.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300 font-mono block">Industry Sector *</label>
                        <input
                          type="text"
                          placeholder="e.g. Telehealth, FinTech Lending, E-Commerce Support"
                          value={aiIndustry}
                          onChange={(e) => setAiIndustry(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-zinc-850 border border-violet-200 dark:border-zinc-800 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-800 dark:text-slate-100"
                          disabled={aiGenerating}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300 font-mono block">Operational Focus / Goal</label>
                        <input
                          type="text"
                          placeholder="e.g. Empathy and active listening, accurate refund disclosures"
                          value={aiGoal}
                          onChange={(e) => setAiGoal(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-zinc-850 border border-violet-200 dark:border-zinc-800 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-violet-500 text-slate-800 dark:text-slate-100"
                          disabled={aiGenerating}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleGenerateAiScorecard}
                        disabled={aiGenerating || !aiIndustry}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm"
                      >
                        {aiGenerating ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" />
                            Drafting Scorecard Blueprint...
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            Generate Custom QA Scorecard Draft
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-1.5 border-b border-slate-150 dark:border-white/5 pb-2.5">
                  <FileText size={16} className="text-indigo-600" /> General Scorecard Info Schema
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Form Title Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Healthcare Compliance Audit Form"
                      value={selectedForm.name}
                      onChange={(e) => updateFormMeta("name", e.target.value)}
                      disabled={!canEdit}
                      className="w-full p-2 bg-slate-50 dark:bg-[#151515] border border-slate-250 dark:border-white/10 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Version Identifier</label>
                    <input
                      type="text"
                      placeholder="e.g. 1.0"
                      value={selectedForm.version}
                      onChange={(e) => updateFormMeta("version", e.target.value)}
                      disabled={!canEdit}
                      className="w-full p-2 bg-slate-50 dark:bg-[#151515] border border-slate-250 dark:border-white/10 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-mono"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Form Objective Description</label>
                    <textarea
                      rows={3}
                      placeholder="Describe the operational goals and assessment criteria of this scorecard guidelines..."
                      value={selectedForm.description}
                      onChange={(e) => updateFormMeta("description", e.target.value)}
                      disabled={!canEdit}
                      className="w-full p-2.5 bg-slate-50 dark:bg-[#151515] border border-slate-250 dark:border-white/10 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 leading-relaxed"
                    ></textarea>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Target Line of Business (LOB)</label>
                    <select
                      value={selectedForm.lobId || ""}
                      onChange={(e) => updateFormMeta("lobId", e.target.value)}
                      disabled={!canEdit}
                      className="w-full p-2 bg-slate-50 dark:bg-[#151515] border border-slate-250 dark:border-white/10 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                    >
                      <option value="">-- Apply to All LOBs --</option>
                      {lobs.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Auditing Category / Channel</label>
                    <select
                      value={selectedForm.category}
                      onChange={(e) => updateFormMeta("category", e.target.value)}
                      disabled={!canEdit}
                      className="w-full p-2 bg-slate-50 dark:bg-[#151515] border border-slate-250 dark:border-white/10 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Passing score Benchmark (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={selectedForm.passingScore}
                      onChange={(e) => updateFormMeta("passingScore", parseInt(e.target.value) || 80)}
                      disabled={!canEdit}
                      className="w-full p-2 bg-slate-50 dark:bg-[#151515] border border-slate-250 dark:border-white/10 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono block">Publishing Status State</label>
                    <select
                      value={selectedForm.status}
                      onChange={(e) => updateFormMeta("status", e.target.value)}
                      disabled={!canEdit}
                      className="w-full p-2 bg-slate-50 dark:bg-[#151515] border border-slate-250 dark:border-white/10 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                    >
                      <option value="draft">Draft (Private Schema)</option>
                      <option value="published">Published (Active Workspace)</option>
                      <option value="archived">Archived (Legacy Logs)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: SECTIONS & QUESTION BUILDER */}
            {activeEditorTab === "sections" && (
              <div className="space-y-6">
                
                {/* Header section management */}
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider font-mono">Form Sections Checklist ({selectedForm.sections.length})</h3>
                  <button
                    onClick={addSection}
                    disabled={!canEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-extrabold border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 transition-all"
                  >
                    <Plus size={14} /> Add Layout Section
                  </button>
                </div>

                {/* Section Accordions */}
                {selectedForm.sections.map((sec, secIndex) => {
                  const isExpanded = expandedSectionId === sec.id;
                  
                  return (
                    <div key={sec.id} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
                      {/* Section Header Controls */}
                      <div className="p-4 bg-slate-50 dark:bg-[#151515] border-b border-slate-150 dark:border-white/5 flex items-center justify-between gap-4">
                        <div className="flex-1 flex items-center gap-2">
                          <GripVertical className="text-slate-400 cursor-grab shrink-0" size={14} />
                          <input
                            type="text"
                            value={sec.name}
                            onChange={(e) => updateSection(sec.id, { name: e.target.value })}
                            disabled={!canEdit}
                            className="bg-transparent font-bold text-slate-800 dark:text-white text-xs focus:outline-none focus:border-b focus:border-indigo-500 w-full"
                          />
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1 bg-white dark:bg-black/20 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                            <span className="text-[10px] font-bold text-slate-400 px-1 font-mono">Weight (%):</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={sec.weight}
                              onChange={(e) => updateSection(sec.id, { weight: parseInt(e.target.value) || 0 })}
                              disabled={!canEdit}
                              className="w-12 bg-transparent text-center font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveSection(secIndex, "up")}
                              disabled={secIndex === 0}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-30"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              onClick={() => moveSection(secIndex, "down")}
                              disabled={secIndex === selectedForm.sections.length - 1}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-30"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>

                          <button
                            onClick={() => removeSection(sec.id)}
                            disabled={!canEdit || selectedForm.sections.length === 1}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>

                          <button
                            onClick={() => setExpandedSectionId(isExpanded ? null : sec.id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Section body showing description and questions checklist */}
                      {isExpanded && (
                        <div className="p-5 space-y-5">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono">Section Objective Description</label>
                            <input
                              type="text"
                              placeholder="e.g. Assessment details, grading rubrics, and guidance markers..."
                              value={sec.description || ""}
                              onChange={(e) => updateSection(sec.id, { description: e.target.value })}
                              disabled={!canEdit}
                              className="w-full p-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          {/* Questions Header */}
                          <div className="flex items-center justify-between border-t border-slate-150 dark:border-white/5 pt-4">
                            <h4 className="font-bold text-xs text-slate-500 font-mono">Questions & Controls ({sec.questions.length})</h4>
                            <button
                              onClick={() => addQuestion(sec.id)}
                              disabled={!canEdit}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg border text-indigo-600 dark:text-indigo-400 transition-all"
                            >
                              <Plus size={10} /> Add Control Field
                            </button>
                          </div>

                          {/* Questions Items List */}
                          <div className="space-y-4">
                            {sec.questions.map((q, qIndex) => {
                              const isQuestionActive = activeQuestionId === q.id;

                              return (
                                <div 
                                  key={q.id}
                                  className={`p-4 border rounded-xl transition-all ${
                                    isQuestionActive
                                      ? "border-indigo-500/50 bg-indigo-50/5 ring-1 ring-indigo-500/20"
                                      : "border-slate-200 dark:border-white/5 hover:border-slate-300"
                                  }`}
                                >
                                  {/* Top Question row */}
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 flex items-start gap-2">
                                      <GripVertical className="text-slate-400 mt-1 cursor-grab shrink-0" size={12} />
                                      <div className="w-full space-y-2">
                                        <input
                                          type="text"
                                          value={q.questionText}
                                          onChange={(e) => updateQuestion(sec.id, q.id, { questionText: e.target.value })}
                                          disabled={!canEdit}
                                          placeholder="Enter evaluation criteria question checkpoint text..."
                                          className="bg-transparent font-bold text-slate-800 dark:text-white text-xs w-full focus:outline-none focus:border-b focus:border-indigo-500"
                                        />
                                        <input
                                          type="text"
                                          value={q.helpText || ""}
                                          onChange={(e) => updateQuestion(sec.id, q.id, { helpText: e.target.value })}
                                          disabled={!canEdit}
                                          placeholder="Add supporting auditor guidance, examples or mandatory thresholds..."
                                          className="bg-transparent text-[11px] text-slate-400 font-medium w-full focus:outline-none"
                                        />
                                      </div>
                                    </div>

                                    {/* Question top actions */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        onClick={() => moveQuestion(sec.id, qIndex, "up")}
                                        disabled={qIndex === 0}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-30"
                                      >
                                        <ChevronUp size={12} />
                                      </button>
                                      <button
                                        onClick={() => moveQuestion(sec.id, qIndex, "down")}
                                        disabled={qIndex === sec.questions.length - 1}
                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-30"
                                      >
                                        <ChevronDown size={12} />
                                      </button>
                                      <button
                                        onClick={() => removeQuestion(sec.id, q.id)}
                                        disabled={!canEdit}
                                        className="p-1 hover:bg-rose-50 hover:text-rose-600 rounded text-slate-400 transition-colors"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                      <button
                                        onClick={() => setActiveQuestionId(isQuestionActive ? null : q.id)}
                                        className="p-1 hover:bg-slate-100 rounded text-indigo-500"
                                      >
                                        <Settings size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* EXPANDED ADVANCED CONFIGURATION PARAMETERS FOR THE QUESTION */}
                                  {isQuestionActive && (
                                    <div className="mt-4 pt-4 border-t border-slate-150 dark:border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-400 font-mono block">Control Input Type</label>
                                        <select
                                          value={q.questionType}
                                          onChange={(e) => updateQuestion(sec.id, q.id, { questionType: e.target.value })}
                                          disabled={!canEdit}
                                          className="w-full p-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl"
                                        >
                                          <option value="yes_no">Yes / No / N/A (Standard)</option>
                                          <option value="binary">Binary (Yes/No)</option>
                                          <option value="rating_5">Rating Star (1–5 Stars)</option>
                                          <option value="rating_10">Rating Range (1–10 Slider)</option>
                                          <option value="dropdown">Dropdown Select List</option>
                                          <option value="multi_select">Multi-Select Checkbox</option>
                                          <option value="percentage">Percentage (0–100%)</option>
                                          <option value="text">Single Line Text Field</option>
                                          <option value="long_text">Paragraph / Narrative Comment</option>
                                          <option value="date">Date Picker Field</option>
                                          <option value="time">Time Entry</option>
                                          <option value="url">URL Hyperlink</option>
                                          <option value="attachment">File Attachment / Proof</option>
                                          <option value="formula">Calculated Formula Cell</option>
                                        </select>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-400 font-mono block">Point Weightage</label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={q.weight}
                                          onChange={(e) => updateQuestion(sec.id, q.id, { weight: parseInt(e.target.value) || 0 })}
                                          disabled={!canEdit}
                                          className="w-full p-2 bg-slate-50 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl font-mono text-indigo-600 dark:text-indigo-400 font-bold"
                                        />
                                      </div>

                                      <div className="flex flex-col gap-3 justify-center">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                                          <input
                                            type="checkbox"
                                            checked={q.isCritical}
                                            onChange={(e) => updateQuestion(sec.id, q.id, { isCritical: e.target.checked })}
                                            disabled={!canEdit}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                          />
                                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                            <ShieldAlert size={12} /> Auto-Fail Case if Violated (Critical)
                                          </span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-600 dark:text-slate-300">
                                          <input
                                            type="checkbox"
                                            checked={q.mandatory}
                                            onChange={(e) => updateQuestion(sec.id, q.id, { mandatory: e.target.checked })}
                                            disabled={!canEdit}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                          />
                                          <span>Mandatory Evaluator Check</span>
                                        </label>
                                      </div>

                                      {/* Show Dynamic Option config if select based */}
                                      {(q.questionType === "dropdown" || q.questionType === "multi_select") && (
                                        <div className="md:col-span-3 space-y-2 bg-slate-50 dark:bg-[#151515] p-3 rounded-xl border">
                                          <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase text-slate-400 font-mono block">Dropdown list values / options</label>
                                            <button
                                              onClick={() => {
                                                const opts = q.options || [];
                                                updateQuestion(sec.id, q.id, { options: [...opts, `Option ${opts.length + 1}`] });
                                              }}
                                              className="text-[9px] font-black uppercase bg-white dark:bg-black/30 border px-2 py-0.5 rounded text-indigo-600 hover:bg-slate-100"
                                            >
                                              Add Option
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {(q.options || []).map((opt, oIdx) => (
                                              <div key={oIdx} className="flex items-center gap-1.5 bg-white dark:bg-black/40 p-1 rounded-lg border">
                                                <input
                                                  type="text"
                                                  value={opt}
                                                  onChange={(e) => {
                                                    const nextOpts = [...(q.options || [])];
                                                    nextOpts[oIdx] = e.target.value;
                                                    updateQuestion(sec.id, q.id, { options: nextOpts });
                                                  }}
                                                  className="w-full bg-transparent text-xs focus:outline-none font-bold"
                                                />
                                                <button
                                                  onClick={() => {
                                                    updateQuestion(sec.id, q.id, { options: (q.options || []).filter((_, idx) => idx !== oIdx) });
                                                  }}
                                                  className="text-slate-400 hover:text-rose-600"
                                                >
                                                  <X size={10} />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Show Formula fields if type is calculated */}
                                      {q.questionType === "formula" && (
                                        <div className="md:col-span-3 space-y-2 bg-blue-50/50 dark:bg-blue-950/10 p-3 rounded-xl border border-blue-200/50">
                                          <label className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 font-mono block">Mathematical Formula Expression</label>
                                          <input
                                            type="text"
                                            placeholder="e.g. Average([Question 1], [Question 2]) or If([Question 1] = 'Yes', 10, 0)"
                                            value={q.formula || ""}
                                            onChange={(e) => updateQuestion(sec.id, q.id, { formula: e.target.value })}
                                            className="w-full p-2 bg-white dark:bg-[#111] border border-blue-200 dark:border-blue-900 rounded-xl font-mono text-xs focus:outline-none"
                                          />
                                          <div className="flex items-center gap-3 text-[10px] text-blue-600 dark:text-blue-400">
                                            <Calculator size={12} />
                                            <span>Syntax: Use square brackets like <code className="bg-white px-1 py-0.5 rounded font-bold border font-mono">[Your Question Checkpoint Name]</code></span>
                                          </div>
                                        </div>
                                      )}

                                    </div>
                                  )}

                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB CONTENT: ADVANCED FORMULA ENGINE */}
            {activeEditorTab === "formulas" && (
              <div className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-150 dark:border-white/5 pb-3">
                  <Calculator size={18} className="text-indigo-600" />
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-white">Excel-Compatible Formula Engine Guidelines</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed font-medium text-slate-600 dark:text-slate-400">
                  <div className="space-y-2.5">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Supported Logic Operators & Functions:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong className="font-mono text-indigo-600">Sum(A, B, C...)</strong> - Adds all values.</li>
                      <li><strong className="font-mono text-indigo-600">Average(A, B, C...)</strong> - Proportional division.</li>
                      <li><strong className="font-mono text-indigo-600">Min(A, B...) / Max(A, B...)</strong> - Extremum values.</li>
                      <li><strong className="font-mono text-indigo-600">Round(value, decimals)</strong> - Decimal truncations.</li>
                      <li><strong className="font-mono text-indigo-600">If(condition, trueVal, falseVal)</strong> - Branch logic.</li>
                      <li><strong className="font-mono text-indigo-600">IfElse(c1, v1, c2, v2, fallback)</strong> - Nested switch paths.</li>
                    </ul>
                  </div>

                  <div className="space-y-2.5">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Pre-compiled User Functions:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong className="font-mono text-indigo-600">CurrentUser()</strong> - Auditor UUID.</li>
                      <li><strong className="font-mono text-indigo-600">CurrentUserName()</strong> - Logged-in full name.</li>
                      <li><strong className="font-mono text-indigo-600">CurrentUserEmail()</strong> - Domain address.</li>
                      <li><strong className="font-mono text-indigo-600">Today() / Now()</strong> - Assessment timestamp.</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-[#151515] rounded-xl border space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-800 dark:text-white">Form Field Reference Directory</h4>
                  <p className="text-[11px] text-slate-400">You can reference any question field in this form by its name in brackets. Copy reference syntax below:</p>
                  
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-150 dark:divide-white/5 pr-2">
                    {selectedForm.sections.flatMap(s => s.questions).map(q => (
                      <div key={q.id} className="py-2 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-xs">{q.questionText}</span>
                        <code className="bg-white dark:bg-black/30 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded font-mono text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                          [{q.questionText.split(":")[0]}]
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: LIVE PREVIEW & INTERACTIVE TESTER */}
            {activeEditorTab === "preview" && (
              <div className="space-y-6">
                
                {/* Visual scorecard banner */}
                <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 font-mono">Live Interactive Playground</p>
                    <h3 className="text-lg font-black text-white">{selectedForm.name || "Untitled Form Template"}</h3>
                    <p className="text-xs text-slate-400 max-w-md">{selectedForm.description || "No description provided."}</p>
                  </div>

                  <div className="bg-indigo-950/40 border border-indigo-900 px-4 py-3 rounded-xl text-center shrink-0 min-w-[120px]">
                    <span className="text-[9px] uppercase tracking-wider font-black text-indigo-400 font-mono block">Evaluating Score</span>
                    <span className={`text-2xl font-black font-mono block mt-0.5 ${
                      calculatedScores.overallScore >= selectedForm.passingScore 
                        ? "text-green-400" 
                        : "text-amber-400"
                    }`}>
                      {calculatedScores.overallScore}%
                    </span>
                    {calculatedScores.isCriticalFailed && (
                      <span className="text-[8px] uppercase font-black text-rose-500 font-mono tracking-widest block mt-0.5">Auto-Failed</span>
                    )}
                  </div>
                </div>

                {/* Scorecard Questions Sheet Preview */}
                <div className="space-y-4">
                  {selectedForm.sections.map((sec) => (
                    <div key={sec.id} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
                      <div className="p-4 bg-slate-50 dark:bg-[#151515] border-b border-slate-150 dark:border-white/5 flex justify-between items-center">
                        <span className="font-bold text-xs text-slate-800 dark:text-white">{sec.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-md font-bold">Weight: {sec.weight}%</span>
                      </div>

                      <div className="divide-y divide-slate-150 dark:divide-white/5">
                        {sec.questions.length === 0 ? (
                          <div className="p-5 text-center text-xs text-slate-400">No questions added in this section yet.</div>
                        ) : (
                          sec.questions.map((q) => {
                            const val = previewAnswers[q.id];
                            const formulaVal = calculatedScores.formulaOutputs[q.id];

                            return (
                              <div key={q.id} className="p-4 sm:p-5 space-y-3.5">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{q.questionText}</p>
                                    {q.helpText && <p className="text-[11px] text-slate-400 font-medium leading-normal">{q.helpText}</p>}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 text-[9px] font-mono font-bold">
                                    {q.isCritical && (
                                      <span className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">CRITICAL</span>
                                    )}
                                    <span className="bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md text-slate-500">{q.weight} pts</span>
                                  </div>
                                </div>

                                {/* Answers controls dynamic preview block */}
                                <div className="space-y-2">
                                  {/* Yes No controls */}
                                  {(q.questionType === "yes_no" || q.questionType === "binary") && (
                                    <div className="flex items-center gap-2 max-w-xs">
                                      {["Yes", "No", "N/A"].map((opt) => (
                                        <button
                                          key={opt}
                                          onClick={() => setPreviewAnswers({ ...previewAnswers, [q.id]: opt })}
                                          className={`flex-1 py-1 px-3 border rounded-xl text-xs font-bold transition-all ${
                                            val === opt
                                              ? opt === "Yes"
                                                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                                : opt === "No"
                                                ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                                                : "bg-slate-600 border-slate-600 text-white shadow-sm"
                                              : "bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
                                          }`}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {/* Star Rating controls */}
                                  {q.questionType === "rating_5" && (
                                    <div className="flex items-center gap-1">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                          key={star}
                                          onClick={() => setPreviewAnswers({ ...previewAnswers, [q.id]: star })}
                                          className="p-1 hover:scale-110 transition-transform"
                                        >
                                          <Star
                                            size={18}
                                            className={(val || 0) >= star ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-700"}
                                          />
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {/* Slider rating */}
                                  {q.questionType === "rating_10" && (
                                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 max-w-md">
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                        <button
                                          key={num}
                                          onClick={() => setPreviewAnswers({ ...previewAnswers, [q.id]: num })}
                                          className={`flex-1 py-1 rounded-lg font-bold font-mono text-[10px] text-center transition-all ${
                                            val === num
                                              ? "bg-indigo-600 text-white"
                                              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                                          }`}
                                        >
                                          {num}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {/* Dropdown menu select */}
                                  {q.questionType === "dropdown" && (
                                    <select
                                      value={val || ""}
                                      onChange={(e) => setPreviewAnswers({ ...previewAnswers, [q.id]: e.target.value })}
                                      className="p-2 bg-white dark:bg-black/30 border border-slate-250 dark:border-white/10 rounded-xl text-xs font-semibold focus:outline-none max-w-xs w-full text-slate-800 dark:text-slate-100"
                                    >
                                      <option value="">-- Select Option --</option>
                                      {(q.options || ["Accurate", "Partially Accurate", "Inaccurate"]).map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  )}

                                  {/* Percentage Slider */}
                                  {(q.questionType === "percentage" || q.questionType === "slider") && (
                                    <div className="flex items-center gap-3 max-w-sm">
                                      <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={val !== undefined ? val : 50}
                                        onChange={(e) => setPreviewAnswers({ ...previewAnswers, [q.id]: parseInt(e.target.value) })}
                                        className="flex-1 accent-indigo-600 h-1 cursor-pointer bg-slate-200 dark:bg-white/10 rounded-lg"
                                      />
                                      <span className="text-xs font-mono font-black text-indigo-600 shrink-0">{val !== undefined ? val : 50}%</span>
                                    </div>
                                  )}

                                  {/* Simple Input Box */}
                                  {q.questionType === "text" && (
                                    <input
                                      type="text"
                                      placeholder="Evaluator textual response check..."
                                      value={val || ""}
                                      onChange={(e) => setPreviewAnswers({ ...previewAnswers, [q.id]: e.target.value })}
                                      className="w-full max-w-md p-2 bg-slate-50 dark:bg-black/20 border border-slate-250 dark:border-white/10 rounded-xl text-xs font-semibold"
                                    />
                                  )}

                                  {/* Formula Cell representation */}
                                  {q.questionType === "formula" && (
                                    <div className="flex items-center gap-2 max-w-xs bg-blue-50 dark:bg-blue-900/10 p-2 rounded-xl border border-blue-100 dark:border-blue-800 font-mono text-xs">
                                      <Calculator size={14} className="text-blue-600" />
                                      <span className="font-bold text-slate-500">Value:</span>
                                      <span className="font-black text-indigo-600 dark:text-indigo-400">{formulaVal === undefined || formulaVal === null ? "..." : String(formulaVal)}</span>
                                    </div>
                                  )}

                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right side configuration context metadata panel (4 Columns) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Quick Summary card */}
            <div className="bg-white dark:bg-[#111111] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
              <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider font-mono">Template Outline Metadata</h4>
              
              <div className="divide-y divide-slate-150 dark:divide-white/5 text-xs font-semibold space-y-2.5 pb-1">
                <div className="flex justify-between py-1 mt-1">
                  <span className="text-slate-400">Template Title:</span>
                  <span className="text-slate-800 dark:text-white truncate max-w-[180px]">{selectedForm.name || "(Unnamed)"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Total Checkpoints:</span>
                  <span className="text-slate-800 dark:text-white">{selectedForm.sections.reduce((acc, s) => acc + s.questions.length, 0)} Controls</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Section Divisions:</span>
                  <span className="text-slate-800 dark:text-white">{selectedForm.sections.length} Units</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Workflow Target:</span>
                  <span className="text-slate-800 dark:text-white uppercase font-mono">{selectedForm.category}</span>
                </div>
              </div>

              {/* Designer controls save buttons */}
              {canEdit && (
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleSaveActiveForm}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/10 text-xs font-bold transition-all"
                  >
                    <Save size={14} /> Save changes & publish
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Abandon current changes and exit template designer? All unsaved edits will be discarded.")) {
                        setViewMode("dashboard");
                      }
                    }}
                    className="w-full py-2.5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancel Draft
                  </button>
                </div>
              )}
            </div>

            {/* Quick Instructions list */}
            <div className="bg-slate-50 dark:bg-[#111111]/40 p-5 rounded-2xl border border-slate-200 dark:border-white/5 text-xs text-slate-500 space-y-3 font-medium">
              <h5 className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest font-mono">Form Studio Manual</h5>
              <p className="leading-relaxed">To build high-performance scorecards:</p>
              <ul className="list-disc pl-4 space-y-1.5">
                <li>Keep the sum of all Section Weight parameters exactly at <strong>100%</strong> to keep standard scoring consistent.</li>
                <li>Ensure at least <strong>one critical failure condition</strong> is enabled for regulatory PCI/DPA compliance checkpoints.</li>
                <li>Test formulas dynamically inside the <strong>Live Interactive Preview</strong> tab prior to publishing.</li>
              </ul>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
