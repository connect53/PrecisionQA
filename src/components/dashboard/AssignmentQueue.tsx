import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, Clock, CheckSquare, Sparkles, Check, X, ChevronLeft, ChevronRight, 
  ArrowUpDown, SlidersHorizontal, UserPlus, ShieldAlert, ListFilter, 
  Building2, Globe, Calendar, Briefcase, LayoutGrid, AlertTriangle, RefreshCw, 
  UserCheck, AlertCircle, Edit2, CheckCircle2, Circle, ArrowRight, Info, HelpCircle
} from "lucide-react";
import { 
  useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, 
  getFilteredRowModel, flexRender, ColumnDef, SortingState
} from "@tanstack/react-table";
import { safeString } from "../../lib/safeUtils";

interface Auditor {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  isActive: boolean;
  teamName: string | null;
  todayAssigned: number;
  pendingAudits: number;
  completedToday: number;
  dailyCapacity: number;
  capacityPercent: number;
  availabilityStatus: string;
}

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
  recordingUrl: string | null;
  transcriptUrl: string | null;
  language: string;
  status: string;
  auditorId: string | null;
  auditorName: string | null;
  priority: string;
  importedAt: string;
}

interface Summary {
  totalCases: number;
  assignedCases: number;
  unassignedCases: number;
  completedAudits: number;
  avgAssignmentTime: number;
  activeAuditorsCount: number;
}

interface HistoryLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  description: string;
  createdAt: string;
  payload: {
    caseId: string;
    caseName: string;
    assignedBy: string;
    assignedByName?: string;
    assignedTo: string;
    assignedToName?: string;
    previousAuditorId: string | null;
    previousAuditorName: string | null;
    isReassignment: boolean;
    reassignedBy?: string;
    reason: string;
    timestamp: string;
  };
}

export default function AssignmentQueue({ addToast, currentUser }: { addToast: any, currentUser: any }) {
  // Navigation tabs within Assignment workspace
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"workspace" | "history">("workspace");

  // Data State
  const [summary, setSummary] = useState<Summary>({
    totalCases: 0,
    assignedCases: 0,
    unassignedCases: 0,
    completedAudits: 0,
    avgAssignmentTime: 0,
    activeAuditorsCount: 0
  });
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filter State (Support multi-select)
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedLobs, setSelectedLobs] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["unassigned"]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [showFilters, setShowFilters] = useState(true);

  // Table State
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [globalFilter, setGlobalFilter] = useState("");

  // Assignment Modal & Method States
  const [assignmentMethod, setAssignmentMethod] = useState<"manual" | "bulk" | "round_robin" | "random" | "capacity">("manual");
  const [showCapacityEditModal, setShowCapacityEditModal] = useState(false);
  const [editingCapacities, setEditingCapacities] = useState<Record<string, number>>({});
  
  // Reassignment Reason Prompt State
  const [showReassignmentModal, setShowReassignmentModal] = useState(false);
  const [pendingReassignmentData, setPendingReassignmentData] = useState<{ caseIds: string[]; auditorId: string | null } | null>(null);
  const [customReassignmentReason, setCustomReassignmentReason] = useState("");

  // Auto Assign Preview State
  const [showAutoAssignPreview, setShowAutoAssignPreview] = useState(false);
  const [proposedAssignments, setProposedAssignments] = useState<{ caseId: string; caseName: string; auditorId: string; auditorName: string }[]>([]);

  // Drag-Over Feedback tracking
  const [dragOverAuditorId, setDragOverAuditorId] = useState<string | null>(null);

  // Fetch all data
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [sumRes, audRes, casesRes] = await Promise.all([
        fetch("/api/assignment/summary").then(r => r.json()),
        fetch("/api/assignment/auditors").then(r => r.json()),
        fetch("/api/assignment/cases").then(r => r.json())
      ]);

      if (sumRes.error || audRes.error || casesRes.error) {
        throw new Error("One or more APIs failed to fetch assignment details.");
      }

      setSummary(sumRes);
      setAuditors(audRes);
      setCases(casesRes);
      
      // Initialize editing capacities
      const caps: Record<string, number> = {};
      audRes.forEach((aud: Auditor) => {
        caps[aud.id] = aud.dailyCapacity;
      });
      setEditingCapacities(caps);
    } catch (err: any) {
      addToast("error", "Failed to Load data", err.message || "Could not synchronize dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistoryLogs = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/assignment/history");
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistoryLogs(data);
    } catch (err: any) {
      addToast("error", "Logs Fetch Error", "Failed to load chronological audit log.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeWorkspaceTab === "history") {
      loadHistoryLogs();
    }
  }, [activeWorkspaceTab]);

  // Filter Unique Lists
  const filterOptions = useMemo(() => {
    const clients = Array.from(new Set(cases.map(c => c.client).filter(Boolean)));
    const lobs = Array.from(new Set(cases.map(c => c.lob).filter(Boolean)));
    const teams = Array.from(new Set(cases.map(c => c.team).filter(Boolean)));
    const agents = Array.from(new Set(cases.map(c => c.agentName).filter(Boolean)));
    const languages = Array.from(new Set(cases.map(c => c.language).filter(Boolean)));
    const batches = Array.from(new Set(cases.map(c => c.batchName).filter(Boolean)));
    const statuses = Array.from(new Set(cases.map(c => c.status).filter(Boolean)));
    const priorities = Array.from(new Set(cases.map(c => c.priority).filter(Boolean)));

    return { clients, lobs, teams, agents, languages, batches, statuses, priorities };
  }, [cases]);

  // Handle Multi-select Filters
  const toggleFilter = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
    setRowSelection({}); // reset table selection on filter change
  };

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (selectedClients.length > 0 && !selectedClients.includes(c.client)) return false;
      if (selectedLobs.length > 0 && !selectedLobs.includes(c.lob)) return false;
      if (selectedTeams.length > 0 && !selectedTeams.includes(c.team)) return false;
      if (selectedAgents.length > 0 && !selectedAgents.includes(c.agentName)) return false;
      if (selectedLanguages.length > 0 && !selectedLanguages.includes(c.language)) return false;
      if (selectedBatches.length > 0 && !selectedBatches.includes(c.batchName)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(c.status)) return false;
      if (selectedPriorities.length > 0 && !selectedPriorities.includes(c.priority)) return false;
      if (selectedDate && !safeString(c.auditDate).startsWith(selectedDate)) return false;
      
      // Global text filter
      if (globalFilter) {
        const text = `${c.caseId} ${c.interactionId} ${c.agentName} ${c.client} ${c.lob}`.toLowerCase();
        if (!text.includes(globalFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [cases, selectedClients, selectedLobs, selectedTeams, selectedAgents, selectedLanguages, selectedBatches, selectedStatuses, selectedPriorities, selectedDate, globalFilter]);

  // Table Columns Definition
  const columns = useMemo<ColumnDef<CaseRecord>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="w-4.5 h-4.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            className="w-4.5 h-4.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
          />
        </div>
      ),
      size: 40,
    },
    {
      accessorKey: "caseId",
      header: "Case ID",
      cell: info => <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{info.getValue() as string}</span>
    },
    {
      accessorKey: "agentName",
      header: "Agent",
      cell: info => (
        <div className="text-xs font-semibold">
          {info.getValue() as string}
          <div className="text-[10px] text-slate-400 font-normal">{(info.row.original.agentEmail)}</div>
        </div>
      )
    },
    {
      accessorKey: "team",
      header: "Team",
      cell: info => <span className="text-xs bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-medium">{(info.getValue() as string) || "N/A"}</span>
    },
    {
      accessorKey: "lob",
      header: "LOB",
      cell: info => <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">{info.getValue() as string}</span>
    },
    {
      accessorKey: "client",
      header: "Client",
      cell: info => <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{info.getValue() as string}</span>
    },
    {
      accessorKey: "auditDate",
      header: "Audit Date",
      cell: info => <span className="text-xs text-slate-500 font-mono">{new Date(info.getValue() as string).toLocaleDateString()}</span>
    },
    {
      accessorKey: "language",
      header: "Language",
      cell: info => <span className="text-xs bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded">{info.getValue() as string || "English"}</span>
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: info => {
        const priority = info.getValue() as string;
        let style = "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400";
        if (priority === "High") style = "bg-rose-50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-400";
        if (priority === "Low") style = "bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400";
        return <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${style}`}>{priority}</span>;
      }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: info => {
        const status = info.getValue() as string;
        let badge = "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300";
        if (status === "assigned") badge = "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400";
        if (status === "audited") badge = "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`text-xs font-semibold px-2 py-1 rounded-md inline-block text-center uppercase ${badge}`}>
              {status}
            </span>
            {info.row.original.auditorName && (
              <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={`Assigned to ${info.row.original.auditorName}`}>
                → {info.row.original.auditorName}
              </span>
            )}
          </div>
        );
      }
    }
  ], [cases]);

  const table = useReactTable({
    data: filteredCases,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    initialState: {
      pagination: {
        pageSize: 15
      }
    }
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCaseIds = selectedRows.map(r => (r.original as CaseRecord).id);

  // --- Capacity Manager Submit ---
  const handleSaveCapacities = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/assignment/capacities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacities: editingCapacities })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update capacities.");

      addToast("success", "Capacities Saved", "Daily QA auditor capacities updated successfully.");
      setShowCapacityEditModal(false);
      loadData();
    } catch (err: any) {
      addToast("error", "Error Saving Capacities", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Assignment Router Execution ---
  const handleExecuteAssignment = async (auditorId: string | null, reason?: string) => {
    if (selectedCaseIds.length === 0) {
      addToast("warning", "No Cases Selected", "Please select at least one audit case to assign.");
      return;
    }

    const targetAuditor = auditors.find(a => a.id === auditorId);
    if (targetAuditor && (targetAuditor.todayAssigned + selectedCaseIds.length > targetAuditor.dailyCapacity)) {
      addToast("error", "Capacity Breach Stopped", `${targetAuditor.fullName} has only ${targetAuditor.dailyCapacity - targetAuditor.todayAssigned} spots remaining. System blocked this allocation to prevent overload.`);
      return;
    }

    // Check if any of the selected cases are already assigned to a DIFFERENT auditor.
    // If so, we prompt for a reassignment reason!
    const reassignmentsExist = selectedRows.some(row => {
      const c = row.original as CaseRecord;
      return c.auditorId && c.auditorId !== auditorId;
    });

    if (reassignmentsExist && !reason) {
      // Open Reassignment Modal to collect a reason!
      setPendingReassignmentData({ caseIds: selectedCaseIds, auditorId });
      setCustomReassignmentReason("");
      setShowReassignmentModal(true);
      return;
    }

    const assignments = selectedCaseIds.map(caseId => ({
      caseId,
      auditorId,
      reason: reason || "Manual Workspace Allocation"
    }));

    try {
      setIsSaving(true);
      const res = await fetch("/api/assignment/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments,
          userId: currentUser?.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save assignments.");

      addToast("success", "Allocation Complete", `Successfully processed ${assignments.length} allocations.`);
      setRowSelection({});
      setShowReassignmentModal(false);
      setPendingReassignmentData(null);
      loadData();
    } catch (err: any) {
      addToast("error", "Assignment Failed", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit collected reassignment reason
  const handleConfirmReassignment = () => {
    if (!pendingReassignmentData) return;
    handleExecuteAssignment(pendingReassignmentData.auditorId, customReassignmentReason || "Manual Workload Balanced Allocation");
  };

  // --- Auto Assign Generator (Capacity & Affinity Routing) ---
  const handleGenerateAutoAssign = () => {
    const unassignedToDistribute = filteredCases.filter(c => c.status === "unassigned");
    if (unassignedToDistribute.length === 0) {
      addToast("warning", "No Unassigned Cases", "There are no unassigned cases matching the current filters.");
      return;
    }

    const activeAuditors = auditors.filter(a => a.isActive && a.dailyCapacity > 0);
    if (activeAuditors.length === 0) {
      addToast("error", "No Active Auditors Available", "All QA auditors are offline or have zero daily capacity.");
      return;
    }

    const simulatedAuditors = activeAuditors.map(a => ({
      ...a,
      currentAssigned: a.todayAssigned,
      remainingCapacity: Math.max(0, a.dailyCapacity - a.todayAssigned),
      newAssignedCount: 0
    }));

    const computedAssignments: { caseId: string; caseName: string; auditorId: string; auditorName: string }[] = [];

    unassignedToDistribute.forEach(c => {
      let eligible = simulatedAuditors.filter(a => a.remainingCapacity > 0);
      if (eligible.length === 0) return; // All auditors are fully loaded

      // Affinity routing: Prefer matches with same Team Name or Team LOB
      let candidate = eligible.find(a => a.teamName === c.team || a.teamName?.toLowerCase() === c.team?.toLowerCase());
      
      if (!candidate) {
        // Fallback to least loaded active auditor to ensure load balance
        eligible.sort((a, b) => {
          const aUsage = a.dailyCapacity > 0 ? (a.currentAssigned + a.newAssignedCount) / a.dailyCapacity : 1;
          const bUsage = b.dailyCapacity > 0 ? (b.currentAssigned + b.newAssignedCount) / b.dailyCapacity : 1;
          return aUsage - bUsage;
        });
        candidate = eligible[0];
      }

      if (candidate) {
        computedAssignments.push({
          caseId: c.id,
          caseName: c.caseId,
          auditorId: candidate.id,
          auditorName: candidate.fullName
        });
        candidate.remainingCapacity--;
        candidate.newAssignedCount++;
      }
    });

    if (computedAssignments.length === 0) {
      addToast("warning", "Capacity Maximum Met", "All available auditors are already at or beyond their configured daily capacities.");
      return;
    }

    setProposedAssignments(computedAssignments);
    setShowAutoAssignPreview(true);
  };

  // --- Confirm Auto Assignments ---
  const handleConfirmAutoAssign = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/assignment/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: proposedAssignments.map(p => ({ caseId: p.caseId, auditorId: p.auditorId, reason: "Auto-distribution engine" })),
          userId: currentUser?.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process auto assignments.");

      addToast("success", "Auto-Assignment Succeeded", `Distributed ${proposedAssignments.length} cases dynamically across active auditors.`);
      setShowAutoAssignPreview(false);
      setRowSelection({});
      loadData();
    } catch (err: any) {
      addToast("error", "Failed Auto-Assign", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Alternate Algorithmic Allocation Options ---
  const handleExecuteAlgorithmAssignment = async (method: "round_robin" | "random" | "capacity") => {
    if (selectedCaseIds.length === 0) {
      addToast("warning", "No Cases Selected", "Please select cases from the table first.");
      return;
    }

    const activeAuditors = auditors.filter(a => a.isActive && a.dailyCapacity > 0);
    if (activeAuditors.length === 0) {
      addToast("error", "No Available Auditors", "No active auditors with configured capacity found.");
      return;
    }

    const assignments: { caseId: string; auditorId: string }[] = [];

    if (method === "round_robin") {
      selectedCaseIds.forEach((caseId, index) => {
        const auditor = activeAuditors[index % activeAuditors.length];
        assignments.push({ caseId, auditorId: auditor.id });
      });
    } else if (method === "random") {
      selectedCaseIds.forEach(caseId => {
        const randIdx = Math.floor(Math.random() * activeAuditors.length);
        assignments.push({ caseId, auditorId: activeAuditors[randIdx].id });
      });
    } else if (method === "capacity") {
      const auditorsPool = activeAuditors.map(a => ({
        ...a,
        remaining: Math.max(0, a.dailyCapacity - a.todayAssigned)
      })).sort((a, b) => b.remaining - a.remaining);

      selectedCaseIds.forEach(caseId => {
        const candidate = auditorsPool.find(a => a.remaining > 0);
        if (candidate) {
          assignments.push({ caseId, auditorId: candidate.id });
          candidate.remaining--;
        }
      });

      if (assignments.length === 0) {
        addToast("error", "Capacity Met", "All active auditors are at their capacity thresholds.");
        return;
      }
    }

    const previewList = assignments.map(a => {
      const caseRec = cases.find(c => c.id === a.caseId);
      const audRec = auditors.find(aud => aud.id === a.auditorId);
      return {
        caseId: a.caseId,
        caseName: caseRec?.caseId || "Unknown Case",
        auditorId: a.auditorId,
        auditorName: audRec?.fullName || "Unknown Auditor"
      };
    });

    setProposedAssignments(previewList);
    setShowAutoAssignPreview(true);
  };

  // Drag and Drop Handler for dropped cases on Auditor Cards
  const handleDropCasesOnAuditor = async (auditorId: string, parsedCaseIds: string[]) => {
    const targetAuditor = auditors.find(a => a.id === auditorId);
    if (!targetAuditor) return;

    if (targetAuditor.todayAssigned + parsedCaseIds.length > targetAuditor.dailyCapacity) {
      addToast("error", "Overload Blocked", `${targetAuditor.fullName} daily limit is set to ${targetAuditor.dailyCapacity} cases. Dropping ${parsedCaseIds.length} cases would breach capacity rules.`);
      return;
    }

    // Capture original state for reassignments
    const reassignmentsExist = cases.some(c => parsedCaseIds.includes(c.id) && c.auditorId && c.auditorId !== auditorId);
    if (reassignmentsExist) {
      setPendingReassignmentData({ caseIds: parsedCaseIds, auditorId });
      setCustomReassignmentReason("Drag & Drop Workload Balanced");
      setShowReassignmentModal(true);
      return;
    }

    const assignments = parsedCaseIds.map(caseId => ({
      caseId,
      auditorId,
      reason: "Interactive Drag & Drop Allocation"
    }));

    try {
      setIsSaving(true);
      const res = await fetch("/api/assignment/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments, userId: currentUser?.id })
      });
      if (!res.ok) throw new Error("Server rejected dropped allocation");
      
      addToast("success", "Cases Reallocated", `Successfully drag-assigned ${parsedCaseIds.length} interaction file(s) directly to ${targetAuditor.fullName}.`);
      setRowSelection({});
      loadData();
    } catch (err: any) {
      addToast("error", "Transfer Failed", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Stats Grid Formatting
  const renderStatsGrid = () => {
    const activeAuditorsCount = auditors.filter(a => a.isActive).length;
    const averageLoad = activeAuditorsCount > 0 ? (summary.assignedCases / activeAuditorsCount).toFixed(1) : "0.0";

    return (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Imported Cases</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">{summary.totalCases.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Assigned</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono tracking-tight text-indigo-600 dark:text-indigo-400">{summary.assignedCases.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-mono">({summary.totalCases > 0 ? Math.round((summary.assignedCases / summary.totalCases) * 100) : 0}%)</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Pending Assignment</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono tracking-tight text-amber-500">{summary.unassignedCases.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-mono">({summary.totalCases > 0 ? Math.round((summary.unassignedCases / summary.totalCases) * 100) : 0}%)</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Completed</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono tracking-tight text-green-600 dark:text-green-400">{summary.completedAudits.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Active Auditors</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono tracking-tight text-indigo-500">
              {activeAuditorsCount} / {auditors.length}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Average Load</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono tracking-tight text-slate-800 dark:text-slate-200">
              {averageLoad} <span className="text-[10px] text-slate-400">cases/aud</span>
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" id="smart-assignment-engine-root">
      
      {/* Top Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Clock className="text-indigo-600 dark:text-indigo-400" />
            Enterprise Assignment Engine
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Dynamically distribute quality evaluations across available auditors. Apply capacity thresholds, drag-and-drop matchings, and review full compliance audit logs.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={loadData}
            className="p-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-500"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin text-indigo-500" : ""} />
          </button>

          <button
            onClick={handleGenerateAutoAssign}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <Sparkles size={14} /> Auto Assign Unallocated
          </button>
        </div>
      </div>

      {/* Metrics Summary Card Grid */}
      {renderStatsGrid()}

      {/* Tab Navigation for workspace vs audit trail */}
      <div className="flex border-b border-slate-200 dark:border-white/10 gap-6 text-xs font-bold font-mono uppercase tracking-wider">
        <button
          onClick={() => setActiveWorkspaceTab("workspace")}
          className={`pb-3 border-b-2 transition-all ${
            activeWorkspaceTab === "workspace"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          Active Allocation Panel
        </button>
        <button
          onClick={() => setActiveWorkspaceTab("history")}
          className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeWorkspaceTab === "history"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          Assignment Trail &amp; Reassignment History ({historyLogs.length})
        </button>
      </div>

      {activeWorkspaceTab === "workspace" ? (
        /* Primary Layout: Split Screen Grid */
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          
          {/* Main Left Console: Tables & Filters */}
          <div className="xl:col-span-3 space-y-6">
            
            {/* Filters Bar */}
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2.5">
                <div className="flex items-center gap-2 font-bold text-xs font-mono uppercase tracking-wider">
                  <ListFilter size={15} className="text-indigo-500" />
                  <span>Segmentation Filters</span>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <SlidersHorizontal size={12} /> {showFilters ? "Collapse Panel" : "Expand Filters"}
                </button>
              </div>

              {showFilters && (
                <div className="space-y-4">
                  {/* First row: Clients, LOBs, Teams, Statuses */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Client Select */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block font-mono">Clients</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                        {filterOptions.clients.map(cl => (
                          <button
                            key={cl}
                            onClick={() => toggleFilter(selectedClients, setSelectedClients, cl)}
                            className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors ${
                              selectedClients.includes(cl)
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                          >
                            {cl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* LOB Select */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block font-mono">LOBs</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                        {filterOptions.lobs.map(lob => (
                          <button
                            key={lob}
                            onClick={() => toggleFilter(selectedLobs, setSelectedLobs, lob)}
                            className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors ${
                              selectedLobs.includes(lob)
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                          >
                            {lob}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Team Select */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block font-mono">Teams</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                        {filterOptions.teams.map(t => (
                          <button
                            key={t}
                            onClick={() => toggleFilter(selectedTeams, setSelectedTeams, t)}
                            className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors ${
                              selectedTeams.includes(t)
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block font-mono">Statuses</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                        {filterOptions.statuses.map(st => (
                          <button
                            key={st}
                            onClick={() => toggleFilter(selectedStatuses, setSelectedStatuses, st)}
                            className={`text-[10px] px-2 py-0.5 rounded border font-bold transition-colors uppercase ${
                              selectedStatuses.includes(st)
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Second row: Languages, Priorities, Batches, Audit Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 dark:border-white/5 pt-4">
                    {/* Languages */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block font-mono">Languages</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                        {filterOptions.languages.map(lang => (
                          <button
                            key={lang}
                            onClick={() => toggleFilter(selectedLanguages, setSelectedLanguages, lang)}
                            className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors ${
                              selectedLanguages.includes(lang)
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                            }`}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Priorities */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block font-mono">Priorities</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                        {filterOptions.priorities.map(prio => (
                          <button
                            key={prio}
                            onClick={() => toggleFilter(selectedPriorities, setSelectedPriorities, prio)}
                            className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors ${
                              selectedPriorities.includes(prio)
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                            }`}
                          >
                            {prio}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Batches */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block font-mono">Import Batches</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                        {filterOptions.batches.map(batch => (
                          <button
                            key={batch}
                            onClick={() => toggleFilter(selectedBatches, setSelectedBatches, batch)}
                            className={`text-[10px] px-2 py-0.5 rounded border font-semibold transition-colors ${
                              selectedBatches.includes(batch)
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                            }`}
                          >
                            {batch}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Audit Date Picker */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block font-mono">Audit Date Filter</span>
                      <input 
                        type="date"
                        value={selectedDate}
                        onChange={e => {
                          setSelectedDate(e.target.value);
                          setRowSelection({});
                        }}
                        className="w-full text-xs p-1.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-semibold"
                      />
                      {selectedDate && (
                        <button 
                          onClick={() => setSelectedDate("")}
                          className="text-[9px] text-rose-500 hover:underline block font-mono"
                        >
                          Clear Date Filter
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cases List Table Area */}
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
              
              {/* Toolbar & Selected Actions */}
              <div className="p-4 bg-slate-50/40 dark:bg-white/5 border-b border-slate-150 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                
                {/* Search Bar */}
                <div className="relative w-full sm:max-w-xs">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <ListFilter size={14} className="text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={globalFilter}
                    onChange={e => setGlobalFilter(e.target.value)}
                    placeholder="Search visible queue..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-100/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none placeholder:text-slate-400"
                  />
                </div>

                {/* Bulk Actions Console */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  {selectedCaseIds.length > 0 && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-right duration-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono hidden md:inline">
                        Selected: <strong className="text-indigo-600">{selectedCaseIds.length}</strong>
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <select
                          value={assignmentMethod}
                          onChange={e => setAssignmentMethod(e.target.value as any)}
                          className="text-xs border border-slate-200 dark:border-white/10 p-1.5 rounded-lg bg-white dark:bg-[#111111] focus:outline-none"
                        >
                          <option value="manual">Assign to Auditor Card</option>
                          <option value="round_robin">Round Robin Distribution</option>
                          <option value="random">Random Distribution</option>
                          <option value="capacity">Capacity-Based Balanced</option>
                        </select>

                        {assignmentMethod === "manual" ? (
                          <select
                            value={""}
                            onChange={e => {
                              if (e.target.value) {
                                handleExecuteAssignment(e.target.value);
                              }
                            }}
                            className="text-xs bg-indigo-600 text-white font-semibold p-1.5 rounded-lg border border-indigo-600 focus:outline-none hover:bg-indigo-700 cursor-pointer"
                          >
                            <option value="" disabled>Select QA Auditor...</option>
                            {auditors.filter(a => a.isActive).map(aud => (
                              <option key={aud.id} value={aud.id}>{aud.fullName}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => handleExecuteAlgorithmAssignment(assignmentMethod as any)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                          >
                            Distribute
                          </button>
                        )}

                        <button
                          onClick={() => handleExecuteAssignment(null)}
                          className="px-2.5 py-1.5 border border-slate-200 dark:border-white/10 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-xs font-semibold text-slate-500 transition-all"
                          title="Return back to pool"
                        >
                          De-allocate
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 font-mono font-medium hidden sm:block">
                    {filteredCases.length} cases showing
                  </div>
                </div>
              </div>

              {/* Table rendering */}
              <div className="overflow-x-auto">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                    <RefreshCw size={24} className="animate-spin text-indigo-500" />
                    <span className="text-xs font-mono">Synchronizing database entries...</span>
                  </div>
                ) : filteredCases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <AlertTriangle size={28} className="text-amber-500 mb-2 animate-bounce" />
                    <span className="text-xs font-bold font-mono uppercase tracking-wider">No cases found</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing the search query or status filter parameters.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      {table.getHeaderGroups().map(headerGroup => (
                        <tr 
                          key={headerGroup.id} 
                          className="bg-slate-50/75 dark:bg-white/5 border-b border-slate-150 dark:border-white/5 text-slate-400 uppercase tracking-wider font-semibold font-mono text-[10px]"
                        >
                          {headerGroup.headers.map(header => (
                            <th key={header.id} className="px-4 py-3 font-semibold whitespace-nowrap">
                              {header.isPlaceholder ? null : (
                                <div 
                                  className={`flex items-center gap-1.5 ${header.column.getCanSort() ? 'cursor-pointer select-none' : ''}`}
                                  onClick={header.column.getToggleSortingHandler()}
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                  {header.column.getCanSort() && <ArrowUpDown size={12} className="text-slate-400 opacity-50" />}
                                </div>
                              )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {table.getRowModel().rows.map(row => {
                        const originalCase = row.original as CaseRecord;
                        return (
                          <tr 
                            key={row.id} 
                            draggable={originalCase.status === "unassigned" || originalCase.status === "assigned"}
                            onDragStart={(e) => {
                              const draggingIds = selectedCaseIds.length > 0 && selectedCaseIds.includes(originalCase.id)
                                ? selectedCaseIds
                                : [originalCase.id];
                              e.dataTransfer.setData("text/plain", JSON.stringify({ caseIds: draggingIds }));
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className={`hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors cursor-grab active:cursor-grabbing ${
                              row.getIsSelected() ? "bg-indigo-50/30 dark:bg-indigo-950/10" : ""
                            }`}
                          >
                            {row.getVisibleCells().map(cell => (
                              <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination controls */}
              {!isLoading && filteredCases.length > 0 && (
                <div className="p-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/5 text-xs font-mono font-semibold text-slate-500">
                  <div>
                    Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredCases.length)} of {filteredCases.length} entries
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      className="p-1 rounded border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span>
                      Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                    </span>
                    <button
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      className="p-1 rounded border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Available QA Auditors Panel */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-4 space-y-4">
              
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-indigo-500" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider font-mono">QA Auditor Pool</h3>
                </div>
                <button
                  onClick={() => setShowCapacityEditModal(true)}
                  className="p-1 rounded-md border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-indigo-600 dark:text-indigo-400 transition-colors"
                  title="Configure daily capacities"
                >
                  <Edit2 size={14} />
                </button>
              </div>

              {/* Instructions banner */}
              <div className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-150 dark:border-white/5 flex gap-2 text-[10px] text-slate-500 leading-normal">
                <Info size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                <span><strong>Interactive Drag-and-Drop</strong>: Drag any case row from the table on the left and drop it onto an auditor card below to assign.</span>
              </div>

              <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="py-12 text-center text-slate-400 font-mono text-[10px]">Loading auditor details...</div>
                ) : auditors.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-mono text-[10px]">No QA Auditors declared in system.</div>
                ) : (
                  auditors.map(aud => {
                    const percent = aud.capacityPercent;
                    let progressBarColor = "bg-indigo-600";
                    if (percent >= 100) progressBarColor = "bg-rose-500";
                    else if (percent >= 80) progressBarColor = "bg-amber-500";

                    const isDragOver = dragOverAuditorId === aud.id;

                    return (
                      <div 
                        key={aud.id} 
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (aud.isActive) {
                            setDragOverAuditorId(aud.id);
                          }
                        }}
                        onDragLeave={() => setDragOverAuditorId(null)}
                        onDrop={async (e) => {
                          e.preventDefault();
                          setDragOverAuditorId(null);
                          try {
                            const dataStr = e.dataTransfer.getData("text/plain");
                            if (!dataStr) return;
                            const parsed = JSON.parse(dataStr);
                            if (parsed && Array.isArray(parsed.caseIds)) {
                              handleDropCasesOnAuditor(aud.id, parsed.caseIds);
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`p-3.5 rounded-xl border transition-all text-left relative ${
                          isDragOver 
                            ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/20 scale-102"
                            : aud.isActive 
                            ? "bg-slate-50/50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300" 
                            : "bg-slate-50/20 dark:bg-white/5 border-slate-100 dark:border-white/5 opacity-60"
                        }`}
                      >
                        {/* Name & Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                              {(aud.fullName || "?").charAt(0)}
                            </div>
                            <div>
                              <span className="text-xs font-extrabold block text-slate-900 dark:text-white leading-tight">{aud.fullName || "Unnamed Auditor"}</span>
                              <span className="text-[9px] text-slate-400 font-mono font-semibold block uppercase tracking-wider">{aud.teamName || "QA Team Alpha"}</span>
                            </div>
                          </div>

                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded leading-normal font-mono ${
                            aud.availabilityStatus === "Available" 
                              ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 animate-pulse" 
                              : aud.availabilityStatus === "At Capacity"
                              ? "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400"
                              : "bg-slate-100 dark:bg-white/10 text-slate-500"
                          }`}>
                            {aud.availabilityStatus}
                          </span>
                        </div>

                        {/* Stats Panel */}
                        <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-white/5 text-center text-[10px] font-mono">
                          <div>
                            <span className="text-slate-400 block uppercase text-[8px] font-bold tracking-wider mb-0.5">Allocated</span>
                            <span className="font-extrabold text-slate-800 dark:text-slate-200">{aud.todayAssigned}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block uppercase text-[8px] font-bold tracking-wider mb-0.5">Pending</span>
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{aud.pendingAudits}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block uppercase text-[8px] font-bold tracking-wider mb-0.5">Limit</span>
                            <span className="font-extrabold text-slate-500">{aud.dailyCapacity}</span>
                          </div>
                        </div>

                        {/* Capacity Progress bar */}
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                            <span>Capacity Usage</span>
                            <span className={percent >= 100 ? "text-rose-500 font-extrabold" : "text-slate-600 dark:text-slate-300 font-bold"}>
                              {percent}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden flex">
                            <div className={`h-full ${progressBarColor} transition-all`} style={{ width: `${Math.min(100, percent)}%` }}></div>
                          </div>
                        </div>

                        {/* Drag hover indicator overlay */}
                        {isDragOver && (
                          <div className="absolute inset-0 bg-indigo-600/10 dark:bg-indigo-400/5 rounded-xl border-2 border-indigo-500 border-dashed flex items-center justify-center backdrop-blur-[0.5px]">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono bg-white dark:bg-slate-950 px-2 py-1 rounded-lg border border-indigo-200">Drop to allocate</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Historical Log Grid Layout */
        <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <CheckSquare size={16} className="text-indigo-500" />
                Workload Audit Trail Registry
              </h3>
              <p className="text-[11px] text-slate-400">Verifiable, immutable chronological records of assignments, re-assignments, and capacity updates.</p>
            </div>
            
            <button 
              onClick={loadHistoryLogs}
              disabled={historyLoading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              title="Refresh log"
            >
              <RefreshCw size={14} className={historyLoading ? "animate-spin text-indigo-500" : ""} />
            </button>
          </div>

          <div className="overflow-x-auto">
            {historyLoading ? (
              <div className="p-12 text-center text-slate-400 space-y-3 font-mono text-xs">
                <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto" />
                <span>Querying historical transaction log...</span>
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="p-16 text-center text-slate-500 space-y-2">
                <Info size={32} className="mx-auto text-slate-400" />
                <p className="text-xs font-bold font-mono">Registry Empty</p>
                <p className="text-[11px] text-slate-400">No detailed allocation history has been stored yet.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-white/5 border-b border-slate-150 dark:border-white/5 text-slate-400 uppercase tracking-wider font-semibold font-mono text-[10px]">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Case Name</th>
                    <th className="py-2.5 px-4">Assigned By</th>
                    <th className="py-2.5 px-4">Assigned To</th>
                    <th className="py-2.5 px-4">Allocation Type</th>
                    <th className="py-2.5 px-4">Justification/Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {historyLogs.map(log => {
                    const isRe = log.payload?.isReassignment;
                    
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/30 dark:hover:bg-white/5 transition-colors font-medium">
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[9px] font-extrabold uppercase font-mono px-1.5 py-0.5 rounded ${
                            isRe 
                              ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400" 
                              : "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400"
                          }`}>
                            {isRe ? "Reassignment" : "Allocation"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {log.payload?.caseName || "N/A"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <span className="font-semibold block">{log.payload?.assignedByName || log.userName || "System Manager"}</span>
                            <span className="text-[9px] text-slate-400 font-mono block">{log.userEmail}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <strong className="text-slate-800 dark:text-slate-200">
                            {log.payload?.assignedToName || "Unassigned"}
                          </strong>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {isRe ? "WORKLOAD TUNING" : "INITIAL_DISPATCH"}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {log.payload?.reason || log.description}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 1: Capacity Limit Configurator --- */}
      {showCapacityEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <h3 className="font-extrabold text-sm uppercase tracking-wider font-mono flex items-center gap-2">
                <Edit2 size={16} className="text-indigo-500" />
                Configure Daily Limits
              </h3>
              <button 
                onClick={() => setShowCapacityEditModal(false)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Adjust maximum allowed daily assignments for each auditor. Managers will be blocked from assigning cases above these thresholds.
            </p>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {auditors.map(aud => (
                <div key={aud.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center">
                      {(aud.fullName || "?").charAt(0)}
                    </div>
                    <span className="text-xs font-semibold">{aud.fullName || "Unnamed Auditor"}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={editingCapacities[aud.id] ?? 40}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setEditingCapacities({ ...editingCapacities, [aud.id]: val });
                      }}
                      className="w-16 text-center text-xs py-1 border border-slate-200 dark:border-white/10 rounded bg-white dark:bg-[#111111] focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-semibold font-mono">cases/day</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                onClick={() => setShowCapacityEditModal(false)}
                className="px-3 py-1.5 border border-slate-200 dark:border-white/10 text-xs font-medium rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCapacities}
                disabled={isSaving}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isSaving && <RefreshCw size={12} className="animate-spin" />}
                Apply Capacity Limits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Matching Preview Panel --- */}
      {showAutoAssignPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in zoom-in-95">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider font-mono flex items-center gap-2">
                  <UserCheck size={18} className="text-indigo-500" />
                  Auto-Assignment Preview Panel
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Review proposed workload routing before writing changes to the database.</p>
              </div>
              <button 
                onClick={() => setShowAutoAssignPreview(false)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Simulated Workload Bar Charts */}
            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-150 dark:border-white/10 space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Proposed Workload Summary</h4>
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                {auditors.filter(a => a.isActive).map(aud => {
                  const propsCount = proposedAssignments.filter(p => p.auditorId === aud.id).length;
                  const futureAssigned = aud.todayAssigned + propsCount;
                  const futurePercent = aud.dailyCapacity > 0 ? Math.round((futureAssigned / aud.dailyCapacity) * 100) : 0;
                  
                  return (
                    <div key={aud.id} className="text-xs space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{aud.fullName}</span>
                        <span className="text-slate-500 font-mono">
                          {aud.todayAssigned} active + <strong className="text-indigo-600 dark:text-indigo-400">{propsCount} new</strong> = {futureAssigned}/{aud.dailyCapacity} ({futurePercent}%)
                        </span>
                      </div>
                      
                      {/* Workload Stacked Progress Bar */}
                      <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden flex">
                        <div className="bg-indigo-400 h-full" style={{ width: `${(aud.todayAssigned / aud.dailyCapacity) * 100}%` }} title="Already Assigned"></div>
                        <div className="bg-indigo-600 h-full border-l border-indigo-500" style={{ width: `${(propsCount / aud.dailyCapacity) * 100}%` }} title="Proposed New"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Assignments List Grid */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Adjust Proposed Matchings</h4>
              
              <div className="border border-slate-200 dark:border-white/10 rounded-xl divide-y divide-slate-100 dark:divide-white/5 max-h-[200px] overflow-y-auto">
                {proposedAssignments.map((p, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <div className="space-y-0.5">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 block">{p.caseName}</span>
                      <span className="text-[10px] text-slate-400">
                        ({cases.find(c => c.id === p.caseId)?.client} • {cases.find(c => c.id === p.caseId)?.lob})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={p.auditorId}
                        onChange={e => {
                          const updated = [...proposedAssignments];
                          const a = auditors.find(aud => aud.id === e.target.value);
                          if (a) {
                            updated[idx].auditorId = e.target.value;
                            updated[idx].auditorName = a.fullName;
                            setProposedAssignments(updated);
                          }
                        }}
                        className="text-[11px] bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-white/10 p-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {auditors.filter(a => a.isActive).map(a => (
                          <option key={a.id} value={a.id}>{a.fullName}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => setProposedAssignments(proposedAssignments.filter((_, i) => i !== idx))}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                        title="Remove matching"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
              <div className="text-xs text-slate-500 font-semibold font-mono">
                Proposed matching: <strong className="text-indigo-600">{proposedAssignments.length}</strong>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowAutoAssignPreview(false)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-white/10 text-xs font-medium rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAutoAssign}
                  disabled={isSaving || proposedAssignments.length === 0}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {isSaving && <RefreshCw size={12} className="animate-spin" />}
                  Confirm &amp; Notify Auditors
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 3: Reassignment Justification --- */}
      {showReassignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <h3 className="font-extrabold text-sm uppercase tracking-wider font-mono flex items-center gap-2 text-rose-500">
                <ShieldAlert size={16} />
                Reassignment Reason Required
              </h3>
              <button 
                onClick={() => {
                  setShowReassignmentModal(false);
                  setPendingReassignmentData(null);
                }}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              One or more of the selected cases are already allocated to another auditor. To log this reassignment correctly in the audit trail, please provide a justification.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Justification / Reason</label>
              <input
                type="text"
                required
                placeholder="e.g. Workload balancing, auditor skill affinity tuning..."
                value={customReassignmentReason}
                onChange={e => setCustomReassignmentReason(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                onClick={() => {
                  setShowReassignmentModal(false);
                  setPendingReassignmentData(null);
                }}
                className="px-3 py-1.5 border border-slate-200 dark:border-white/10 text-xs font-medium rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReassignment}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Confirm Re-Allocation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
