import React, { useState } from "react";
import { Search, X, ChevronDown, ChevronUp, AlertCircle, Info } from "lucide-react";

// ==========================================
// 1. DASHBOARD CARD COMPONENT
// ==========================================
interface DashboardCardProps {
  key?: string | number;
  id?: string;
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  subtitle?: string;
  icon: React.ComponentType<any>;
  iconColorClass?: string;
  bgColorClass?: string;
  loading?: boolean;
}

export function DashboardCard({
  id,
  title,
  value,
  change,
  isPositive = true,
  subtitle,
  icon: Icon,
  iconColorClass = "text-indigo-600 bg-indigo-50 border-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-800/30",
  bgColorClass = "bg-white dark:bg-[#111111]",
  loading = false,
}: DashboardCardProps) {
  if (loading) {
    return <LoadingSkeleton type="card" />;
  }

  return (
    <div
      id={id}
      className={`relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 p-5 ${bgColorClass} transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/50 group`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </span>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {value}
            </span>
            {change && (
              <span
                className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isPositive
                    ? "text-emerald-700 bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800/30 dark:text-emerald-400"
                    : "text-rose-700 bg-rose-50 border border-rose-100 dark:bg-rose-900/20 dark:border-rose-800/30 dark:text-rose-400"
                }`}
              >
                {isPositive ? "+" : ""}
                {change}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${iconColorClass}`}>
          <Icon size={20} className="transition-transform group-hover:scale-110 duration-300" />
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. DATA TABLE COMPONENT
// ==========================================
interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  id?: string;
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowsPerPage?: number;
}

export function DataTable<T extends { id: string | number }>({
  id,
  columns,
  data,
  emptyMessage = "No active records found.",
  onRowClick,
  rowsPerPage = 5,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));

  const paginatedData = data.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  return (
    <div id={id} className="w-full border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111111] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
            <tr>
              {columns.map((col, index) => (
                <th key={index} className={`px-6 py-4 ${col.className || ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-700 dark:text-slate-200 font-medium">
            {paginatedData.length > 0 ? (
              paginatedData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors duration-150 ${
                    onRowClick ? "hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" : "hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  {columns.map((col, idx) => (
                    <td key={idx} className={`px-6 py-4 ${col.className || ""}`}>
                      {typeof col.accessor === "function"
                        ? col.accessor(row)
                        : (row[col.accessor] as any)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center">
                  <EmptyState title="No Records Found" description={emptyMessage} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-[#111111] border-t border-slate-200 dark:border-white/10 px-6 py-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <div>
            Showing <span className="text-slate-900 dark:text-white font-semibold">{(currentPage - 1) * rowsPerPage + 1}</span> to{" "}
            <span className="text-slate-900 dark:text-white font-semibold">
              {Math.min(currentPage * rowsPerPage, data.length)}
            </span>{" "}
            of <span className="text-slate-900 dark:text-white font-semibold">{data.length}</span> results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111] hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-slate-700 dark:text-slate-300"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111111] hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-slate-700 dark:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. PAGE HEADER COMPONENT
// ==========================================
interface PageHeaderProps {
  id?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  actions?: React.ReactNode;
}

export function PageHeader({ id, title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div id={id} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-3 shrink-0 items-center">{actions}</div>}
    </div>
  );
}

// ==========================================
// 4. SEARCH INPUT COMPONENT
// ==========================================
interface SearchInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ id, value, onChange, placeholder = "Search...", className = "" }: SearchInputProps) {
  return (
    <div id={id} className={`relative flex items-center ${className}`}>
      <Search className="absolute left-3.5 text-slate-400 pointer-events-none" size={16} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm pl-10 pr-10 py-2 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl outline-none transition-all bg-white dark:bg-[#111111] text-slate-900 dark:text-white"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ==========================================
// 5. STATUS BADGE COMPONENT
// ==========================================
interface StatusBadgeProps {
  id?: string;
  status: string;
  customMap?: Record<string, { label: string; bg: string; dot: string }>;
}

export function StatusBadge({ id, status, customMap }: StatusBadgeProps) {
  const defaultMap: Record<string, { label: string; bg: string; dot: string }> = {
    active: { label: "Active", bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30", dot: "bg-emerald-500" },
    inactive: { label: "Inactive", bg: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10", dot: "bg-slate-400 dark:bg-slate-500" },
    pending: { label: "Pending", bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30", dot: "bg-amber-500" },
    completed: { label: "Completed", bg: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800/30", dot: "bg-sky-500" },
    disputed: { label: "Disputed", bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/30", dot: "bg-rose-500" },
    open: { label: "Open", bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/30", dot: "bg-indigo-500" },
  };

  const key = status.toLowerCase();
  const config = (customMap || defaultMap)[key] || {
    label: status,
    bg: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10",
    dot: "bg-slate-500",
  };

  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${config.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
      {config.label}
    </span>
  );
}

// ==========================================
// 6. FILTER BAR COMPONENT
// ==========================================
interface FilterBarProps {
  id?: string;
  searchVal: string;
  onSearchChange: (val: string) => void;
  filterOption: string;
  onFilterChange: (val: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}

export function FilterBar({
  id,
  searchVal,
  onSearchChange,
  filterOption,
  onFilterChange,
  options,
  placeholder = "Search...",
}: FilterBarProps) {
  return (
    <div id={id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <SearchInput value={searchVal} onChange={onSearchChange} placeholder={placeholder} className="flex-1" />
      <div className="relative shrink-0">
        <select
          value={filterOption}
          onChange={(e) => onFilterChange(e.target.value)}
          className="appearance-none w-full sm:w-auto text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 rounded-xl pl-4 pr-10 py-2 outline-none cursor-pointer transition-all focus:border-indigo-500 dark:focus:border-indigo-500"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
               {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
      </div>
    </div>
  );
}

// ==========================================
// 7. CONFIRMATION DIALOG COMPONENT
// ==========================================
interface ConfirmationDialogProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: "danger" | "warning" | "info";
}

export function ConfirmationDialog({
  id,
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm Action",
  cancelLabel = "Cancel",
  type = "info",
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      icon: AlertCircle,
      accentClass: "text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800/30",
      btnClass: "bg-rose-600 hover:bg-rose-700 text-white",
    },
    warning: {
      icon: AlertCircle,
      accentClass: "text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/30",
      btnClass: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    info: {
      icon: Info,
      accentClass: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/30",
      btnClass: "bg-indigo-600 hover:bg-indigo-700 text-white",
    },
  }[type];

  const Icon = typeConfig.icon;

  return (
    <div id={id} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
        <div className="flex gap-4 items-start">
          <div className={`w-12 h-12 rounded-full border flex items-center justify-center shrink-0 ${typeConfig.accentClass}`}>
            <Icon size={20} />
          </div>
          <div className="space-y-2 flex-1 pt-1">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white leading-none">{title}</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-8 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${typeConfig.btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 8. EMPTY STATE COMPONENT
// ==========================================
interface EmptyStateProps {
  id?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ id, title, description, action }: EmptyStateProps) {
  return (
    <div id={id} className="flex flex-col items-center justify-center text-center p-12 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
      <div className="w-12 h-12 rounded-xl bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm">
        <Info size={20} />
      </div>
      <h4 className="text-base font-semibold text-slate-900 dark:text-white mt-4">{title}</h4>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed mt-1.5">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ==========================================
// 9. LOADING SKELETON COMPONENT
// ==========================================
interface LoadingSkeletonProps {
  id?: string;
  type: "card" | "table" | "chart" | "row";
  rows?: number;
}

export function LoadingSkeleton({ id, type, rows = 3 }: LoadingSkeletonProps) {
  if (type === "card") {
    return (
      <div id={id} className="border border-slate-200 dark:border-white/10 rounded-2xl p-5 bg-white dark:bg-[#111111] space-y-4 animate-pulse">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="h-3 bg-slate-100 dark:bg-white/10 rounded w-1/3"></div>
            <div className="h-8 bg-slate-100 dark:bg-white/10 rounded w-1/2"></div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/10"></div>
        </div>
      </div>
    );
  }

  if (type === "table") {
    return (
      <div id={id} className="border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#111111] overflow-hidden animate-pulse">
        <div className="h-12 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10"></div>
        <div className="divide-y divide-slate-100 dark:divide-white/5 px-6 py-4 space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2 gap-4">
              <div className="h-4 bg-slate-100 dark:bg-white/10 rounded w-1/4"></div>
              <div className="h-4 bg-slate-100 dark:bg-white/10 rounded w-1/3"></div>
              <div className="h-4 bg-slate-100 dark:bg-white/10 rounded w-1/6"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "chart") {
    return (
      <div id={id} className="border border-slate-200 dark:border-white/10 rounded-2xl p-5 bg-white dark:bg-[#111111] space-y-4 animate-pulse">
        <div className="h-5 bg-slate-100 dark:bg-white/10 rounded w-1/4"></div>
        <div className="h-[250px] bg-slate-50 dark:bg-white/5 rounded-xl flex items-end justify-between px-8 pb-6 gap-2">
          <div className="h-[40%] flex-1 bg-slate-100 dark:bg-white/10 rounded-t"></div>
          <div className="h-[70%] flex-1 bg-slate-100 dark:bg-white/10 rounded-t"></div>
          <div className="h-[55%] flex-1 bg-slate-100 dark:bg-white/10 rounded-t"></div>
          <div className="h-[90%] flex-1 bg-slate-100 dark:bg-white/10 rounded-t"></div>
          <div className="h-[30%] flex-1 bg-slate-100 dark:bg-white/10 rounded-t"></div>
        </div>
      </div>
    );
  }

  return (
    <div id={id} className="flex items-center gap-3 py-2 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10"></div>
      <div className="space-y-2 flex-1">
        <div className="h-3 bg-slate-100 dark:bg-white/10 rounded w-1/3"></div>
        <div className="h-2.5 bg-slate-100 dark:bg-white/10 rounded w-1/4"></div>
      </div>
    </div>
  );
}

