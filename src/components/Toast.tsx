import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { ToastMessage } from "../types";

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export default function Toast({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastItemProps {
  key?: string;
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 5000); // Auto remove after 5 seconds
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const config = {
    success: {
      bg: "bg-white border-emerald-200 shadow-emerald-500/5",
      icon: <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />,
      titleColor: "text-slate-900",
      descColor: "text-slate-500"
    },
    error: {
      bg: "bg-white border-rose-200 shadow-rose-500/5",
      icon: <AlertCircle className="text-rose-500 shrink-0" size={18} />,
      titleColor: "text-slate-900",
      descColor: "text-slate-500"
    },
    info: {
      bg: "bg-white border-blue-200 shadow-blue-500/5",
      icon: <Info className="text-blue-500 shrink-0" size={18} />,
      titleColor: "text-slate-900",
      descColor: "text-slate-500"
    },
    warning: {
      bg: "bg-white border-amber-200 shadow-amber-500/5",
      icon: <AlertTriangle className="text-amber-500 shrink-0" size={18} />,
      titleColor: "text-slate-900",
      descColor: "text-slate-500"
    }
  }[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-xl border shadow-lg ${config.bg} w-full`}
    >
      {config.icon}
      <div className="flex-1 min-w-0">
        <h4 className={`text-xs font-bold leading-none ${config.titleColor}`}>{toast.title}</h4>
        {toast.description && (
          <p className={`text-[11px] leading-relaxed mt-1.5 font-medium ${config.descColor}`}>
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-lg hover:bg-slate-50"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
