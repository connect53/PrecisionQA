import React, { useState, useEffect } from "react";
import { 
  Database, Link2, Upload, Check, AlertTriangle, HelpCircle, 
  Settings, ChevronLeft, ChevronRight, RefreshCw, Trash2, 
  History, ArrowRight, Play, Server, FileSpreadsheet, CheckSquare, 
  Search, AlertCircle, FileText, LayoutGrid, Users, Filter, Save,
  X, ExternalLink, Download, UserPlus
} from "lucide-react";
import { User, QAField, AssignmentRule, ImportProfile, QAFieldType } from "../../types";
import { syncService } from "../../lib/syncService";
import { initAuth, googleSignIn, logout } from "../../lib/googleAuth";
import { googleWorkspace, DriveFile, SheetProperties } from "../../lib/googleWorkspace";
import { motion, AnimatePresence } from "motion/react";
import QAFormBuilder from "./QAFormBuilder";
import { safeString } from "../../lib/safeUtils";

interface GoogleSheetsImporterProps {
  currentUser: User;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
  onImportSuccess?: () => void;
}

type StepId = 
  | "source" 
  | "mapping" 
  | "qa_form" 
  | "validate" 
  | "assign" 
  | "summary";

export default function GoogleSheetsImporter({ currentUser, addToast, onImportSuccess }: GoogleSheetsImporterProps) {
  const [currentStep, setCurrentStep] = useState<StepId>("source");
  const [isLoading, setIsLoading] = useState(false);
  
  // 1. Source State
  const [activeSourceType, setActiveSourceType] = useState<"google" | "local">("google");
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [spreadsheets, setSpreadsheets] = useState<DriveFile[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<string>("");
  const [worksheets, setWorksheets] = useState<SheetProperties[]>([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState<string>("");
  
  // 2. Data State
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetRawRows, setSheetRawRows] = useState<any[][]>([]);
  const [batchName, setBatchName] = useState("");
  
  // 3. Mapping State
  const [mandatoryMapping, setMandatoryMapping] = useState<Record<string, string>>({
    caseId: "",
    agentEmail: "",
    agentName: "",
    auditDate: ""
  });
  const [optionalMapping, setOptionalMapping] = useState<Record<string, { mode: "ignore" | "metadata" | "assignment", target?: string }>>({});
  
  // 4. QA Form State
  const [qaFormMode, setQaFormMode] = useState<"columns" | "custom" | "studio">("columns");
  const [saveToFormStudio, setSaveToFormStudio] = useState(false);
  const [qaFields, setQaFields] = useState<QAField[]>([]);
  const [studioForms, setStudioForms] = useState<any[]>([]);
  const [selectedStudioFormId, setSelectedStudioFormId] = useState<string>("");

  useEffect(() => {
    if (qaFormMode === "studio" && selectedStudioFormId) {
      const matched = studioForms.find(f => f.id === selectedStudioFormId);
      if (matched) {
        // Flatten all questions across sections into a flat QAField array
        const flatFields: QAField[] = [];
        let index = 0;
        matched.sections.forEach((sec: any) => {
          sec.questions.forEach((q: any) => {
            flatFields.push({
              id: q.id,
              name: q.questionText,
              description: q.helpText,
              mandatory: q.mandatory !== false,
              critical: q.isCritical === true,
              weight: q.weight || 10,
              orderIndex: index++,
              type: q.questionType as any,
              options: q.options || [],
              formula: q.formula,
              formulaOutputType: q.formulaOutputType
            });
          });
        });
        setQaFields(flatFields);
      }
    }
  }, [qaFormMode, selectedStudioFormId, studioForms]);
  
  // 5. Validation & Import State
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<any>(null);
  
  // 6. Assignment State
  const [assignmentRule, setAssignmentRule] = useState<AssignmentRule>({
    mode: "random",
    distributionMode: "random",
    auditorIds: []
  });
  const [auditors, setAuditors] = useState<User[]>([]);
  
  // 7. Profiles State
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  
  // 8. Batches State
  const [batches, setBatches] = useState<any[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadBatches = async () => {
    try {
      const res = await fetch("/api/batches");
      if (res.ok) {
        setBatches(await res.json());
      }
    } catch (err) {
      console.error("Failed to load batches", err);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        addToast("success", "Batch deleted", "The batch and its associated cases have been deleted.");
        loadBatches();
        if (onImportSuccess) {
          onImportSuccess();
        }
      } else {
        const errData = await res.json();
        addToast("error", "Deletion failed", errData.error || "An error occurred.");
      }
    } catch (err: any) {
      addToast("error", "Deletion failed", err.message || "An error occurred.");
    }
  };

  useEffect(() => {
    loadInitialData();
    loadBatches();
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        loadSpreadsheets();
      },
      () => {
        setGoogleUser(null);
        setSpreadsheets([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadInitialData = async () => {
    try {
      const [profilesData, auditorsRes, studioRes] = await Promise.all([
        syncService.getProfiles(),
        fetch("/api/assignment/auditors"),
        fetch("/api/form-studio/scorecards")
      ]);
      setProfiles(profilesData);
      if (auditorsRes.ok) {
        setAuditors(await auditorsRes.json());
      }
      if (studioRes.ok) {
        const formsData = await studioRes.json();
        setStudioForms(formsData.filter((f: any) => f.status === "published" || f.isActive));
      }
    } catch (err) {
      console.error("Failed to load initial data", err);
    }
  };

  const loadSpreadsheets = async () => {
    try {
      setIsLoading(true);
      const files = await googleWorkspace.listSpreadsheets();
      setSpreadsheets(files);
    } catch (err: any) {
      addToast("error", "Google Drive Error", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSourceSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpreadsheet || !selectedWorksheet) {
      addToast("warning", "Selection Required", "Please select a spreadsheet and worksheet.");
      return;
    }

    setIsLoading(true);
    try {
      const sheetNameSelected = worksheets.find(w => w.title === selectedWorksheet)?.title || selectedWorksheet;
      const data = await googleWorkspace.getSheetData(selectedSpreadsheet, sheetNameSelected);
      setSheetHeaders(data.headers);
      setSheetRawRows(data.rows);
      
      const docName = spreadsheets.find(s => s.id === selectedSpreadsheet)?.name || "Sheet";
      setBatchName(`${docName} - ${new Date().toLocaleDateString()}`);
      
      // Auto-detect mandatory mapping
      const newMapping = { ...mandatoryMapping };
      data.headers.forEach(h => {
        const low = h.toLowerCase();
        if (low.includes("case id") || low === "caseid" || low === "id") newMapping.caseId = h;
        if (low.includes("agent email") || low.includes("email")) newMapping.agentEmail = h;
        if (low.includes("agent name") || low.includes("name")) newMapping.agentName = h;
        if (low.includes("date") || low.includes("timestamp")) newMapping.auditDate = h;
      });
      setMandatoryMapping(newMapping);
      
      setCurrentStep("mapping");
    } catch (err: any) {
      addToast("error", "Read Failed", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const data = await syncService.readFile(file);
      setSheetHeaders(data.headers);
      setSheetRawRows(data.rows);
      setBatchName(`${file.name} - ${new Date().toLocaleDateString()}`);
      setCurrentStep("mapping");
    } catch (err: any) {
      addToast("error", "File Read Error", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateAndIngest = async () => {
    setIsLoading(true);
    try {
      // 1. Validation
      const result = syncService.validateUniversalRows(
        sheetRawRows,
        sheetHeaders,
        mandatoryMapping,
        optionalMapping,
        [] // existing cases check
      );
      setValidationResult(result);

      if (result.errors.some((e: any) => e.severity === "error")) {
        addToast("error", "Validation Errors", "Please fix errors before proceeding.");
        setIsLoading(false);
        return;
      }

      // Optional: Save to Form Studio
      if (saveToFormStudio) {
        try {
          await fetch("/api/form-studio/scorecards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: batchName || "Imported Form",
              status: "published",
              sections: [
                {
                  id: crypto.randomUUID(),
                  title: "Imported Questions",
                  questions: qaFields.map(f => ({
                    id: f.id,
                    questionText: f.name,
                    helpText: f.description,
                    questionType: f.type,
                    mandatory: f.mandatory,
                    isCritical: f.critical,
                    weight: f.weight,
                    options: f.options
                  }))
                }
              ],
              userId: currentUser.id
            })
          });
          addToast("success", "Form Saved", "Form successfully saved to Form Studio.");
        } catch (err) {
          console.error("Failed to save to Form Studio", err);
          addToast("error", "Form Save Failed", "Could not save to Form Studio.");
        }
      }

      // 2. Ingestion
      const importRes = await syncService.performUniversalImport(
        result.validatedCases,
        batchName,
        qaFields,
        mandatoryMapping,
        optionalMapping,
        currentUser,
        (p) => setImportProgress(p)
      );
      
      setImportSummary(importRes);
      setCurrentStep("assign");
    } catch (err: any) {
      addToast("error", "Import Failed", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAssignment = async () => {
    setIsLoading(true);
    try {
      const res = await syncService.executeAssignment(importSummary.batchId, assignmentRule, currentUser.id);
      addToast("success", "Assignment Complete", `Distributed ${res.assignedCount} cases to auditors.`);
      setCurrentStep("summary");
      if (onImportSuccess) onImportSuccess();
    } catch (err: any) {
      addToast("error", "Assignment Failed", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    const name = prompt("Enter Profile Name:");
    if (!name) return;
    
    try {
      await syncService.saveProfile({
        name,
        mandatoryMapping,
        optionalMapping,
        qaFormConfig: qaFields,
        assignmentRules: assignmentRule,
        userId: currentUser.id
      } as any);
      addToast("success", "Profile Saved", "Import profile successfully created.");
      loadInitialData();
    } catch (err) {
      addToast("error", "Save Failed", "Could not save profile.");
    }
  };

  const applyProfile = (profileId: string) => {
    const p = profiles.find(x => x.id === profileId);
    if (!p) return;
    setMandatoryMapping(p.mandatoryMapping);
    setOptionalMapping(p.optionalMapping);
    setQaFields(p.qaFormConfig);
    if (p.assignmentRules) setAssignmentRule(p.assignmentRules);
    setSelectedProfileId(profileId);
    addToast("info", "Profile Applied", `Applied mapping and configuration from "${p.name}".`);
  };

  // --- RENDERING HELPERS ---
  const renderStepper = () => {
    const steps: { id: StepId; label: string; icon: any }[] = [
      { id: "source", label: "Source", icon: FileSpreadsheet },
      { id: "mapping", label: "Mapping", icon: Link2 },
      { id: "qa_form", label: "QA Form", icon: CheckSquare },
      { id: "validate", label: "Ingest", icon: Upload },
      { id: "assign", label: "Assign", icon: Users },
      { id: "summary", label: "Finish", icon: Check },
    ];

    const currentIdx = steps.findIndex(s => s.id === currentStep);

    return (
      <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-xs overflow-x-auto mb-6">
        <div className="flex justify-between items-center min-w-[600px] select-none">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < currentIdx;
            const isActive = step.id === currentStep;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center gap-2 min-w-[80px]">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-110" 
                      : isCompleted 
                        ? "bg-emerald-500 text-white" 
                        : "bg-slate-100 dark:bg-white/5 text-slate-400"
                  }`}>
                    {isCompleted ? <Check size={18} /> : <Icon size={18} />}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${idx < currentIdx ? "bg-emerald-500" : "bg-slate-100 dark:bg-white/5"}`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {renderStepper()}

      <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm overflow-hidden min-h-[500px]">
        <AnimatePresence mode="wait">
          {currentStep === "source" && (
            <motion.div
              key="source"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8 space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Connect Your Data Source</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto">Upload a local file or sync directly from Google Sheets to begin your audit ingestion.</p>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setActiveSourceType("google")}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
                    activeSourceType === "google"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                  }`}
                >
                  <FileSpreadsheet size={18} /> Google Sheets
                </button>
                <button
                  onClick={() => setActiveSourceType("local")}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
                    activeSourceType === "local"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                  }`}
                >
                  <Upload size={18} /> Local File (Excel/CSV)
                </button>
              </div>

              <div className="max-w-xl mx-auto">
                {activeSourceType === "google" ? (
                  <div className="space-y-6">
                    {!googleUser ? (
                      <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl bg-slate-50/50 dark:bg-white/5">
                        <button onClick={googleSignIn} className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-black border border-slate-200 dark:border-white/20 rounded-2xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all mx-auto">
                           <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Connect Google Account
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSourceSelect} className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                          {googleUser.photoURL && <img src={googleUser.photoURL} className="w-8 h-8 rounded-full" alt="Avatar" />}
                          <div className="flex-1">
                            <p className="text-[11px] font-bold">{googleUser.displayName}</p>
                            <p className="text-[10px] text-slate-500">{googleUser.email}</p>
                          </div>
                          <button type="button" onClick={logout} className="text-[10px] font-bold text-rose-500 px-3 py-1 hover:bg-rose-50 rounded-lg">Sign Out</button>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Select Spreadsheet</label>
                            <select
                              value={selectedSpreadsheet}
                              onChange={async (e) => {
                                const id = e.target.value;
                                setSelectedSpreadsheet(id);
                                if (id) {
                                  setIsLoading(true);
                                  const details = await googleWorkspace.getSpreadsheetDetails(id);
                                  setWorksheets(details.sheets);
                                  setIsLoading(false);
                                }
                              }}
                              className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            >
                              <option value="">Select a spreadsheet...</option>
                              {spreadsheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          {selectedSpreadsheet && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Select Worksheet</label>
                              <select
                                value={selectedWorksheet}
                                onChange={(e) => setSelectedWorksheet(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              >
                                <option value="">Select a worksheet...</option>
                                {worksheets.map(w => <option key={w.sheetId} value={w.title}>{w.title}</option>)}
                              </select>
                            </div>
                          )}
                          <button
                            type="submit"
                            disabled={isLoading || !selectedWorksheet}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} />}
                            Connect & Fetch Data
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="group cursor-pointer p-12 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl bg-slate-50/50 dark:bg-white/5 hover:border-blue-500 hover:bg-blue-50/10 transition-all text-center space-y-4"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = ".xlsx,.xls,.csv";
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleFileUpload(file);
                        };
                        input.click();
                      }}
                    >
                      <div className="w-16 h-16 bg-white dark:bg-black border border-slate-200 dark:border-white/20 rounded-2xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform">
                        <Upload size={24} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Drop your file here</p>
                        <p className="text-xs text-slate-500 mt-1">Supports Excel (.xlsx) and CSV formats</p>
                      </div>
                      <div className="px-4 py-2 bg-blue-600 text-white text-[11px] font-bold rounded-xl inline-block shadow-lg shadow-blue-500/20">
                        Browse Files
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentStep === "mapping" && (
            <motion.div
              key="mapping"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8 space-y-8"
            >
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Smart Column Mapping</h2>
                  <p className="text-xs text-slate-500">Map your spreadsheet headers to PrecisionQA mandatory and optional fields.</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedProfileId}
                    onChange={(e) => applyProfile(e.target.value)}
                    className="px-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value="">Load Profile...</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={saveProfile} className="p-2 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-blue-600 rounded-xl border border-slate-200 dark:border-white/10 transition-all shadow-sm">
                    <Save size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Mandatory Mapping */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600 px-1">Mandatory Fields</h3>
                  <div className="space-y-3">
                    {[
                      { key: "caseId", label: "Unique Case ID", icon: FileText },
                      { key: "agentEmail", label: "Agent Email (Required)", icon: Users },
                      { key: "agentName", label: "Agent Name (Optional)", icon: UserPlus },
                      { key: "auditDate", label: "Audit Date (Recommended)", icon: History },
                    ].map((m) => (
                      <div key={m.key} className="flex items-center gap-4 p-4 bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl group transition-all hover:bg-white dark:hover:bg-[#151515] hover:border-slate-300">
                        <div className="w-10 h-10 bg-white dark:bg-black border border-slate-200 dark:border-white/20 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 shadow-xs">
                          <m.icon size={18} />
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{m.label}</p>
                          <p className="text-[10px] text-slate-500">Maps to unique record key</p>
                        </div>
                        <select
                          value={mandatoryMapping[m.key]}
                          onChange={(e) => setMandatoryMapping(prev => ({ ...prev, [m.key]: e.target.value }))}
                          className="px-4 py-2.5 bg-white dark:bg-black border border-slate-200 dark:border-white/20 rounded-xl text-xs font-bold min-w-[160px] outline-none focus:border-blue-500 transition-all"
                        >
                          <option value="">Select Header...</option>
                          {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optional Mapping */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 px-1">Optional Attributes</h3>
                  <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2">
                    {sheetHeaders.filter(h => !Object.values(mandatoryMapping).includes(h)).map((h) => {
                      const current = optionalMapping[h] || { mode: "metadata" };
                      return (
                        <div key={h} className="flex items-center gap-4 p-3 bg-slate-50/30 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl">
                          <span className="flex-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate">{h}</span>
                          <select
                            value={current.mode}
                            onChange={(e) => setOptionalMapping(prev => ({ ...prev, [h]: { ...current, mode: e.target.value as any } }))}
                            className="px-3 py-1.5 bg-white dark:bg-black border border-slate-200 dark:border-white/20 rounded-lg text-[10px] font-bold outline-none"
                          >
                            <option value="metadata">Store as Metadata</option>
                            <option value="assignment">Use for Assignment</option>
                            <option value="ignore">Ignore Column</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100 dark:border-white/5">
                <button onClick={() => setCurrentStep("source")} className="px-6 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 rounded-xl">Back</button>
                <button 
                  onClick={() => setCurrentStep("qa_form")}
                  disabled={!mandatoryMapping.caseId || !mandatoryMapping.agentEmail}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  Configure QA Form <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === "qa_form" && (
            <motion.div
              key="qa_form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8 space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">QA Audit Form Builder</h2>
                <p className="text-sm text-slate-500 max-w-lg mx-auto">Define how auditors will score these cases. Use existing columns or build a custom scorecard.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                <button
                  onClick={() => {
                    setQaFormMode("columns");
                    if (qaFields.length === 0) {
                      const newFields: QAField[] = sheetHeaders
                        .filter(h => !Object.values(mandatoryMapping).includes(h))
                        .slice(0, 5)
                        .map((h, i) => ({
                          id: crypto.randomUUID(),
                          name: h,
                          mandatory: true,
                          critical: false,
                          weight: 10,
                          orderIndex: i,
                          type: "yes_no"
                        }));
                      setQaFields(newFields);
                    }
                  }}
                  className={`p-6 border-2 rounded-3xl text-left space-y-3 transition-all ${
                    qaFormMode === "columns"
                      ? "border-blue-500 bg-blue-50/10"
                      : "border-slate-100 dark:border-white/10 hover:border-slate-300"
                  }`}
                >
                  <LayoutGrid className={qaFormMode === "columns" ? "text-blue-600" : "text-slate-400"} />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Use Spreadsheet Columns</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Automatically convert your headers into audit questions.</p>
                  </div>
                </button>
                <button
                  onClick={() => setQaFormMode("custom")}
                  className={`p-6 border-2 rounded-3xl text-left space-y-3 transition-all ${
                    qaFormMode === "custom"
                      ? "border-blue-500 bg-blue-50/10"
                      : "border-slate-100 dark:border-white/10 hover:border-slate-300"
                  }`}
                >
                  <Settings className={qaFormMode === "custom" ? "text-blue-600" : "text-slate-400"} />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Build Custom QA Form</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Design a unique audit scorecard from scratch.</p>
                  </div>
                </button>
                <button
                  onClick={() => setQaFormMode("studio")}
                  className={`p-6 border-2 rounded-3xl text-left space-y-3 transition-all ${
                    qaFormMode === "studio"
                      ? "border-blue-500 bg-blue-50/10"
                      : "border-slate-100 dark:border-white/10 hover:border-slate-300"
                  }`}
                >
                  <Database className={qaFormMode === "studio" ? "text-blue-600" : "text-slate-400"} />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Precision Form Studio</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Select a published template from Form Studio.</p>
                  </div>
                </button>
              </div>

              {qaFormMode === "studio" ? (
                <div className="bg-slate-50/50 dark:bg-white/5 rounded-3xl p-6 border border-slate-100 dark:border-white/10 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 font-mono">Select Published Scorecard</h4>
                  <select
                    value={selectedStudioFormId}
                    onChange={(e) => setSelectedStudioFormId(e.target.value)}
                    className="w-full max-w-md p-3 bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="">-- Choose Scorecard Template --</option>
                    {studioForms.map(f => (
                      <option key={f.id} value={f.id}>{f.name} (v{f.version})</option>
                    ))}
                  </select>
                  {selectedStudioFormId && (
                    <div className="text-xs text-slate-500 font-medium bg-blue-50/50 dark:bg-blue-950/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
                      Successfully loaded scorecard questions. Total questions in selected blueprint: <span className="font-bold text-indigo-600">{qaFields.length} Checkpoints</span>.
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50/50 dark:bg-white/5 rounded-3xl p-6 border border-slate-100 dark:border-white/10">
                  <QAFormBuilder fields={qaFields} onChange={setQaFields} importedHeaders={sheetHeaders} />
                </div>
              )}

              <div className="flex justify-between pt-6 border-t border-slate-100 dark:border-white/5">
                <button onClick={() => setCurrentStep("mapping")} className="px-6 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 rounded-xl">Back</button>
                
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={saveToFormStudio} 
                      onChange={(e) => setSaveToFormStudio(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Save to Form Studio
                  </label>
                  
                  <button 
                    onClick={handleValidateAndIngest}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                    Validate & Start Ingest
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === "assign" && (
            <motion.div
              key="assign"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8 space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Assignment Engine Configuration</h2>
                <p className="text-sm text-slate-500 max-w-lg mx-auto">Configure how the {importSummary?.importedCount} imported cases will be distributed among your auditors.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-4">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 px-1">Assignment Mode</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setAssignmentRule(prev => ({ ...prev, mode: "random" }))}
                      className={`w-full p-4 border rounded-2xl text-left transition-all ${
                        assignmentRule.mode === "random"
                          ? "border-blue-500 bg-blue-50/10 shadow-sm"
                          : "border-slate-100 dark:border-white/10 bg-white dark:bg-[#151515]"
                      }`}
                    >
                      <LayoutGrid size={18} className="mb-2 text-slate-400" />
                      <h4 className="text-xs font-bold">Random Distribution</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Spread cases evenly across all selected auditors.</p>
                    </button>
                    <button
                      onClick={() => setAssignmentRule(prev => ({ ...prev, mode: "header_based" }))}
                      className={`w-full p-4 border rounded-2xl text-left transition-all ${
                        assignmentRule.mode === "header_based"
                          ? "border-blue-500 bg-blue-50/10 shadow-sm"
                          : "border-slate-100 dark:border-white/10 bg-white dark:bg-[#151515]"
                      }`}
                    >
                      <Filter size={18} className="mb-2 text-slate-400" />
                      <h4 className="text-xs font-bold">Header Based</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Assign based on specific column values (e.g. LOB).</p>
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                  {assignmentRule.mode === "random" ? (
                    <div className="space-y-4">
                      <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 px-1">Select Auditors</h3>
                      <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                        {auditors.map((auditor) => (
                          <label
                            key={auditor.id}
                            className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${
                              assignmentRule.auditorIds?.includes(auditor.id)
                                ? "border-blue-500 bg-blue-50/10"
                                : "border-slate-100 dark:border-white/10 bg-white dark:bg-[#151515]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={assignmentRule.auditorIds?.includes(auditor.id)}
                              onChange={(e) => {
                                const current = assignmentRule.auditorIds || [];
                                if (e.target.checked) {
                                  setAssignmentRule(prev => ({ ...prev, auditorIds: [...current, auditor.id] }));
                                } else {
                                  setAssignmentRule(prev => ({ ...prev, auditorIds: current.filter(id => id !== auditor.id) }));
                                }
                              }}
                            />
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-600">
                              {safeString(auditor.name).slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 truncate">
                              <p className="text-xs font-bold truncate">{auditor.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">{auditor.email}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 px-1">Logic Rules</h3>
                      <div className="space-y-4 p-5 bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Distribution Column</label>
                          <select
                            value={assignmentRule.headerColumn}
                            onChange={(e) => setAssignmentRule(prev => ({ ...prev, headerColumn: e.target.value }))}
                            className="w-full px-4 py-2 bg-white dark:bg-black border border-slate-200 dark:border-white/20 rounded-xl text-sm outline-none"
                          >
                            <option value="">Select Header...</option>
                            {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">Configure value mappings once column is selected.</p>
                      </div>
                    </div>
                  )}

                  <div className="p-5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-2xl space-y-2">
                    <h5 className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Ingestion Summary</h5>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xl font-black text-emerald-800 dark:text-emerald-200">{importSummary?.importedCount || 0}</p>
                        <p className="text-[10px] text-emerald-600 font-medium">Valid cases in current batch</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">100% Ingested</p>
                        <p className="text-[10px] text-emerald-600 font-medium">Ready for distribution</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100 dark:border-white/5">
                <button onClick={() => setCurrentStep("qa_form")} className="px-6 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 rounded-xl">Back</button>
                <button 
                  onClick={handleExecuteAssignment}
                  disabled={isLoading || (assignmentRule.mode === "random" && (!assignmentRule.auditorIds || assignmentRule.auditorIds.length === 0))}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Users size={16} />}
                  Distribute & Finalize
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === "summary" && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 text-center space-y-8"
            >
              <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Check size={40} className="stroke-[3]" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Data Intake Cycle Complete</h2>
                <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                  The batch <strong>"{batchName}"</strong> has been successfully ingested, mapped, and assigned to the audit queue.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto pt-4">
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/10 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Imported</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{importSummary?.importedCount || 0}</p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/10 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">QA Questions</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{qaFields.length}</p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/10 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned</p>
                  <p className="text-2xl font-black text-emerald-600">{importSummary?.importedCount || 0}</p>
                </div>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => window.location.reload()} 
                  className="px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-black font-bold rounded-2xl shadow-xl shadow-slate-900/10 hover:scale-105 transition-all flex items-center gap-2 mx-auto"
                >
                  Return to Dashboard <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <History size={16} className="text-blue-500" /> Intake History
          </h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{batches.length} Batches Total</span>
        </div>
        <div className="space-y-3">
          {batches.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-medium">
              No previous import batches found.
            </div>
          ) : (
            batches.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-4 p-4 border border-slate-100 dark:border-white/5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center text-slate-400 flex-shrink-0">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{b.name || `Batch ${b.id.slice(0, 8)}`}</p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Processed {b.caseCount ?? 0} cases • {b.createdAt ? new Date(b.createdAt).toLocaleString() : "Unknown date"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${
                    b.status === "completed" 
                      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800" 
                      : "text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800"
                  }`}>
                    {b.status || "SUCCESS"}
                  </span>
                  {deleteConfirmId === b.id ? (
                    <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 px-2 py-1 rounded-lg border border-rose-100 dark:border-rose-900/30">
                      <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">Delete?</span>
                      <button
                        onClick={() => {
                          handleDeleteBatch(b.id);
                          setDeleteConfirmId(null);
                        }}
                        className="text-[9px] font-black text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-200 uppercase tracking-widest px-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded transition-colors"
                      >
                        Yes
                      </button>
                      <span className="text-rose-200 dark:text-rose-900">|</span>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="text-[9px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 uppercase tracking-widest px-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setDeleteConfirmId(b.id)}
                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                      title="Delete Batch"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
