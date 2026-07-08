import React, { useState, useEffect } from "react";
import { 
  X, Calculator, Info, AlertCircle, ChevronDown, 
  Plus, Brackets, Check, Play, Search, Code
} from "lucide-react";
import { QAField } from "../../types";
import { FormulaEngine } from "../../lib/formulaEngine";
import { motion, AnimatePresence } from "motion/react";

interface FormulaBuilderProps {
  fields: QAField[];
  currentFieldId: string;
  initialFormula: string;
  onSave: (formula: string) => void;
  onClose: () => void;
  importedHeaders?: string[];
}

const FUNCTIONS = [
  { category: "Date & Time", items: ["Now()", "Today()", "CurrentDate()", "CurrentTime()", "CurrentTimestamp()"] },
  { category: "User", items: ["CurrentUser()", "CurrentUserName()", "CurrentUserEmail()", "CurrentUserRole()"] },
  { category: "Score", items: ["Sum()", "Average()", "Min()", "Max()", "Count()", "Round(val, dec)", "Percentage(val, total)"] },
  { category: "Conditional", items: ["If(cond, t, f)", "IfElse(c1, t1, c2, t2, f)", "IsBlank(val)", "NotBlank(val)", "Equals(a, b)", "Contains(str, sub)"] },
  { category: "Text", items: ["Upper(str)", "Lower(str)", "Concat(a, b, ...)", "Trim(str)", "Replace(str, s, r)"] },
];

const OPERATORS = ["+", "-", "*", "/", "(", ")", ">", "<", "==", "!=", "&&", "||"];

export default function FormulaBuilder({ fields, currentFieldId, initialFormula, onSave, onClose, importedHeaders = [] }: FormulaBuilderProps) {
  const [formula, setFormula] = useState(initialFormula || "");
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"visual" | "advanced">("visual");
  const [search, setSearch] = useState("");

  const availableFields = fields.filter(f => f.id !== currentFieldId);

  useEffect(() => {
    validateAndPreview();
  }, [formula]);

  const validateAndPreview = () => {
    if (!formula.trim()) {
      setPreview(null);
      setError(null);
      return;
    }

    const validation = FormulaEngine.validate(formula, availableFields, importedHeaders);
    if (!validation.valid) {
      setError(validation.error || "Invalid formula");
      setPreview(null);
    } else {
      setError(null);
      const res = FormulaEngine.evaluate(formula, { 
        values: {
          ...availableFields.reduce((acc, f) => ({ ...acc, [f.name]: 10 }), {}),
          ...importedHeaders.reduce((acc, h) => ({ ...acc, [h]: "Metadata Value" }), {})
        }
      });
      setPreview(res);
    }
  };

  const insertText = (text: string) => {
    setFormula(prev => prev + text);
  };

  const insertField = (name: string) => {
    insertText(`[${name}]`);
  };

  const insertFunction = (func: string) => {
    // Extract function name from Function(args)
    const name = func.split("(")[0];
    insertText(`${name}( )`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Formula Builder</h3>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Dynamic Score Calculation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Main Workspace */}
          <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Equation Editor</label>
                <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
                  <button 
                    onClick={() => setActiveTab("visual")}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === "visual" ? "bg-white dark:bg-black shadow-sm text-blue-600" : "text-slate-500"}`}
                  >Visual</button>
                  <button 
                    onClick={() => setActiveTab("advanced")}
                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${activeTab === "advanced" ? "bg-white dark:bg-black shadow-sm text-blue-600" : "text-slate-500"}`}
                  >Advanced</button>
                </div>
              </div>

              <div className="relative group">
                <textarea
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="e.g., Sum([Question 1], [Question 2])"
                  className={`w-full h-32 p-4 bg-slate-50 dark:bg-white/5 border rounded-2xl text-sm font-mono focus:ring-2 transition-all outline-none resize-none ${
                    error ? "border-rose-500 focus:ring-rose-500/20" : "border-slate-200 dark:border-white/10 focus:ring-blue-500/20 focus:border-blue-500"
                  }`}
                />
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setFormula("")} className="p-1.5 bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-lg text-slate-400 hover:text-rose-500 transition-colors shadow-sm">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <p className="text-[10px] font-bold leading-tight">{error}</p>
                </div>
              )}

              {/* Quick Operators */}
              <div className="flex flex-wrap gap-2">
                {OPERATORS.map(op => (
                  <button
                    key={op}
                    onClick={() => insertText(` ${op} `)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600 transition-all"
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Section */}
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center">
                  <Play size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Live Preview</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {preview === null ? "Waiting for valid formula..." : String(preview)}
                  </p>
                </div>
              </div>
              {preview !== null && (
                <div className="flex items-center gap-1 text-emerald-600">
                  <Check size={14} />
                  <span className="text-[10px] font-bold">VALID</span>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Helper List */}
          <div className="w-full lg:w-80 border-l border-slate-100 dark:border-white/5 flex flex-col bg-slate-50/30 dark:bg-white/1">
            <div className="p-4 border-b border-slate-100 dark:border-white/5 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search fields/functions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-black border border-slate-200 dark:border-white/20 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Fields */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Questions</h4>
                <div className="space-y-1.5">
                  {availableFields.filter(f => f.name.toLowerCase().includes(search.toLowerCase())).map(f => (
                    <button
                      key={f.id}
                      onClick={() => insertField(f.name)}
                      className="w-full text-left p-2.5 bg-white dark:bg-black border border-slate-100 dark:border-white/10 rounded-xl hover:border-blue-500 group transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors truncate">{f.name}</span>
                        <Plus size={12} className="text-slate-300 group-hover:text-blue-600" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Import Metadata Headers */}
              {importedHeaders && importedHeaders.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Import Metadata Headers</h4>
                  <div className="space-y-1.5">
                    {importedHeaders.filter(h => h.toLowerCase().includes(search.toLowerCase())).map(h => (
                      <button
                        key={h}
                        onClick={() => insertField(h)}
                        className="w-full text-left p-2.5 bg-white dark:bg-black border border-slate-100 dark:border-white/10 rounded-xl hover:border-emerald-500 group transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 transition-colors truncate">{h}</span>
                          <Plus size={12} className="text-slate-300 group-hover:text-emerald-600" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Functions */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Functions</h4>
                {FUNCTIONS.map(cat => {
                  const filtered = cat.items.filter(i => i.toLowerCase().includes(search.toLowerCase()));
                  if (filtered.length === 0) return null;
                  
                  return (
                    <div key={cat.category} className="space-y-1.5">
                      <p className="text-[9px] font-bold text-slate-400 px-1">{cat.category}</p>
                      <div className="space-y-1">
                        {filtered.map(func => (
                          <button
                            key={func}
                            onClick={() => insertFunction(func)}
                            className="w-full text-left p-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 rounded-lg hover:border-blue-500 group transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-medium text-blue-700 dark:text-blue-400">{func}</span>
                              <Brackets size={10} className="text-blue-300 group-hover:text-blue-500" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/2 flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-400">
            <Info size={14} />
            <span className="text-[10px] font-medium">Use [brackets] to reference questions.</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-6 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
            <button 
              onClick={() => onSave(formula)}
              disabled={!!error || !formula}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              Save Formula
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
