import React, { useState } from "react";
import { Plus, Trash2, GripVertical, ChevronDown, CheckCircle2, Calculator, Settings } from "lucide-react";
import { QAField, QAFieldType } from "../../types";
import { motion, Reorder } from "motion/react";
import FormulaBuilder from "./FormulaBuilder";

interface QAFormBuilderProps {
  fields: QAField[];
  onChange: (fields: QAField[]) => void;
  importedHeaders?: string[];
}

const FIELD_TYPES: { type: QAFieldType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "long_text", label: "Long Text" },
  { type: "number", label: "Number" },
  { type: "percentage", label: "Percentage" },
  { type: "date", label: "Date" },
  { type: "yes_no", label: "Yes/No" },
  { type: "checkbox", label: "Checkbox" },
  { type: "dropdown", label: "Dropdown" },
  { type: "multi_select", label: "Multi Select" },
  { type: "rating_5", label: "Rating (1–5)" },
  { type: "rating_10", label: "Rating (1–10)" },
  { type: "url", label: "URL" },
  { type: "attachment", label: "Attachment" },
  { type: "formula", label: "Formula" },
];

export default function QAFormBuilder({ fields, onChange, importedHeaders = [] }: QAFormBuilderProps) {
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);

  const addField = () => {
    const newField: QAField = {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      mandatory: true,
      critical: false,
      weight: 10,
      orderIndex: fields.length,
      type: "yes_no",
      options: [],
    };
    onChange([...fields, newField]);
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<QAField>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const editingField = fields.find(f => f.id === editingFormulaId);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Custom QA Form Configuration</h3>
        <button
          onClick={addField}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-sm"
        >
          <Plus size={14} /> Add Question
        </button>
      </div>

      <Reorder.Group axis="y" values={fields} onReorder={onChange} className="space-y-3">
        {fields.map((field) => (
          <Reorder.Item
            key={field.id}
            value={field}
            className="bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm"
          >
            <div className="flex gap-4">
              <div className="mt-2 text-slate-400 cursor-grab active:cursor-grabbing">
                <GripVertical size={16} />
              </div>
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Question Text</label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(field.id, { name: e.target.value })}
                      placeholder="e.g., Did the agent greet correctly?"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                    <select
                      value={field.type}
                      onChange={(e) => updateField(field.id, { type: e.target.value as QAFieldType })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.type} value={t.type}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Weight</label>
                    <input
                      type="number"
                      value={field.weight}
                      onChange={(e) => updateField(field.id, { weight: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {field.type === "formula" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Formula Expression</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={field.formula || ""}
                          placeholder="Click build to create formula..."
                          className="flex-1 px-3 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono outline-none"
                        />
                        <button 
                          onClick={() => setEditingFormulaId(field.id)}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-2"
                        >
                          <Calculator size={14} /> Build
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Output Type</label>
                      <select
                        value={field.formulaOutputType || "text"}
                        onChange={(e) => updateField(field.id, { formulaOutputType: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="percentage">Percentage</option>
                        <option value="date">Date</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>
                  </div>
                )}

                {(field.type === "dropdown" || field.type === "multi_select") && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Options (Comma separated)</label>
                    <input
                      type="text"
                      value={field.options?.join(", ")}
                      onChange={(e) => updateField(field.id, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                      placeholder="e.g., Yes, No, Partially"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={field.mandatory}
                      onChange={(e) => updateField(field.id, { mandatory: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Mandatory</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={field.critical}
                      onChange={(e) => updateField(field.id, { critical: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 text-rose-600 dark:text-rose-400">Critical Failure</span>
                  </label>
                  <div className="flex-1" />
                  <button
                    onClick={() => removeField(field.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {fields.length === 0 && (
        <div className="text-center py-12 border border-dashed border-slate-300 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/5">
          <p className="text-xs text-slate-500">No custom questions added yet.</p>
        </div>
      )}

      {editingField && (
        <FormulaBuilder
          fields={fields}
          currentFieldId={editingField.id}
          initialFormula={editingField.formula || ""}
          onSave={(formula) => {
            updateField(editingField.id, { formula });
            setEditingFormulaId(null);
          }}
          onClose={() => setEditingFormulaId(null)}
          importedHeaders={importedHeaders}
        />
      )}
    </div>
  );
}
