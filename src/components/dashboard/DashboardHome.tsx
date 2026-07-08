import React, { useState } from "react";
import { 
  FileText, Clock, CheckCircle, AlertTriangle, Award, 
  UserCheck, Users, Shield, RefreshCw, Layers, Zap, Play, Upload, CheckSquare, Plus, Download, BarChart2, MessageSquare
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, CartesianGrid 
} from "recharts";
import { DashboardCard } from "./ReusableComponents";
import { User, UserRole } from "../../types";

interface DashboardHomeProps {
  currentUser: User;
  onRefreshSession: () => void;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
}

export default function DashboardHome({ currentUser, onRefreshSession, addToast }: DashboardHomeProps) {
  
  const [stats, setStats] = useState({
    assigned: 0,
    pending: 0,
    completed: 0,
    disputes: 0,
    score: "0%",
    coverage: "0%",
    productivity: "0 audits/hr"
  });

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // AI Coaching Insights States
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const handleGenerateInsights = async () => {
    try {
      setLoadingInsights(true);
      const res = await fetch("/api/ai/analytics-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stats: {
            role: currentUser.role,
            assigned: stats.assigned,
            pending: stats.pending,
            completed: stats.completed,
            globalScore: stats.score,
            productivity: stats.productivity
          }
        })
      });
      if (!res.ok) throw new Error("Failed to compile insights");
      const data = await res.json();
      setAiInsights(data.insights || []);
    } catch (err) {
      console.error("AI Insights failed:", err);
      addToast("error", "Insights compilation failed", "Could not compile performance trends via Gemini.");
    } finally {
      setLoadingInsights(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch summary stats
      const summaryRes = await fetch("/api/assignment/summary");
      const summaryData = await summaryRes.json();
      
      // Fetch activity logs
      const logsRes = await fetch("/api/admin/config");
      const configData = await logsRes.json();
      
      if (summaryData) {
        setStats({
          assigned: summaryData.assignedCases || 0,
          pending: summaryData.unassignedCases || 0,
          completed: summaryData.completedAudits || 0,
          disputes: 0, // Placeholder if not in summary
          score: "94.6%", // Keep one fallback or fetch from real reports
          coverage: "12.4%",
          productivity: "4.2 audits/hr"
        });
      }

      if (configData && configData.activityLogs) {
        setActivities(configData.activityLogs.slice(0, 5).map((log: any) => ({
          id: log.id,
          type: log.action.includes("create") ? "system" : "completed",
          title: log.action.replace(/_/g, " ").toUpperCase(),
          desc: log.description,
          time: new Date(log.createdAt).toLocaleTimeString(),
          badge: log.action.split("_")[0]
        })));
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Role-specific metrics generation
  const getRoleSpecificMetrics = () => {
    const baseMetrics = [
      { 
        id: "score", 
        title: currentUser.role === UserRole.AGENT ? "My Quality Score" : "Global QA Score", 
        value: stats.score, 
        change: "+0.8% this week", 
        isPositive: true, 
        subtitle: "Enterprise Target: 95.0%", 
        icon: Award, 
        color: "text-sky-600 bg-sky-50 border-sky-100 dark:text-sky-400 dark:bg-sky-900/20 dark:border-sky-800/30" 
      }
    ];

    if (currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN) {
      return [
        { 
          id: "system_health", 
          title: "System Node Health", 
          value: "99.9%", 
          change: "Operational", 
          isPositive: true, 
          subtitle: "All services online", 
          icon: Shield, 
          color: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/30" 
        },
        { 
          id: "total_audits", 
          title: "Enterprise Throughput", 
          value: stats.completed + stats.assigned, 
          change: "Across all LOBs", 
          isPositive: true, 
          subtitle: "Real-time processing", 
          icon: Layers, 
          color: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-800/30" 
        },
        ...baseMetrics,
        { 
          id: "pending_enterprise", 
          title: "Unassigned Global", 
          value: stats.pending, 
          change: "Awaiting distribution", 
          isPositive: false, 
          subtitle: "System-wide backlog", 
          icon: Clock, 
          color: "text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800/30" 
        }
      ];
    }

    if (currentUser.role === UserRole.QA_MANAGER) {
      return [
        { 
          id: "manager_completed", 
          title: "LOB Completed", 
          value: stats.completed, 
          change: "Target: 500/mo", 
          isPositive: true, 
          subtitle: "Current pace: On track", 
          icon: CheckCircle, 
          color: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/30" 
        },
        ...baseMetrics,
        { 
          id: "open_disputes", 
          title: "LOB Disputes", 
          value: stats.disputes, 
          change: "Requires action", 
          isPositive: false, 
          subtitle: "Management arbitration", 
          icon: AlertTriangle, 
          color: "text-rose-600 bg-rose-50 border-rose-100 dark:text-rose-400 dark:bg-rose-900/20 dark:border-rose-800/30" 
        },
        { 
          id: "coverage_lob", 
          title: "LOB Coverage", 
          value: stats.coverage, 
          change: "Target: 10.0%", 
          isPositive: true, 
          subtitle: "Sample rate consistency", 
          icon: Zap, 
          color: "text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-white/10 dark:border-white/20" 
        }
      ];
    }

    if (currentUser.role === UserRole.TEAM_LEADER) {
      return [
        { 
          id: "team_score", 
          title: "Team Average", 
          value: stats.score, 
          change: "+1.2% vs Last Mo", 
          isPositive: true, 
          subtitle: "Top Team in Fintech", 
          icon: Users, 
          color: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/30" 
        },
        { 
          id: "coaching_needed", 
          title: "Pending Coaching", 
          value: 3, 
          change: "Target: 48h", 
          isPositive: false, 
          subtitle: "Agent feedback release", 
          icon: MessageSquare, 
          color: "text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800/30" 
        },
        { 
          id: "team_productivity", 
          title: "Team Velocity", 
          value: "18.5", 
          change: "Audits / Day", 
          isPositive: true, 
          subtitle: "SLA capacity at 92%", 
          icon: Zap, 
          color: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-800/30" 
        }
      ];
    }

    if (currentUser.role === UserRole.QA_AUDITOR) {
      return [
        { 
          id: "auditor_assigned", 
          title: "My Active Queue", 
          value: stats.assigned, 
          change: "Due EOD", 
          isPositive: true, 
          subtitle: "Target: 8 per shift", 
          icon: FileText, 
          color: "text-indigo-600 bg-indigo-50 border-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-800/30" 
        },
        { 
          id: "auditor_completed", 
          title: "My Completions", 
          value: stats.completed, 
          change: "Today", 
          isPositive: true, 
          subtitle: "SLA accuracy: 99.2%", 
          icon: CheckCircle, 
          color: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/30" 
        },
        ...baseMetrics,
        { 
          id: "productivity_rate", 
          title: "My Velocity", 
          value: stats.productivity, 
          change: "Current Session", 
          isPositive: true, 
          subtitle: "Goal: 3.5 audits/hr", 
          icon: Zap, 
          color: "text-sky-600 bg-sky-50 border-sky-100 dark:text-sky-400 dark:bg-sky-900/20 dark:border-sky-800/30" 
        }
      ];
    }

    if (currentUser.role === UserRole.AGENT) {
      return [
        { 
          id: "my_score", 
          title: "My Quality Score", 
          value: "96.4%", 
          change: "+2.1% vs Avg", 
          isPositive: true, 
          subtitle: "Excellent performance", 
          icon: Award, 
          color: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/30" 
        },
        { 
          id: "my_audits", 
          title: "Audits on Me", 
          value: 12, 
          change: "This month", 
          isPositive: true, 
          subtitle: "Coverage: 5.2%", 
          icon: FileText, 
          color: "text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-white/10 dark:border-white/20" 
        },
        { 
          id: "unread_feedback", 
          title: "New Feedback", 
          value: 1, 
          change: "Requires review", 
          isPositive: false, 
          subtitle: "From Auditor Patel", 
          icon: MessageSquare, 
          color: "text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800/30" 
        }
      ];
    }

    return baseMetrics;
  };

  const operationMetrics = getRoleSpecificMetrics();

  // Recharts Sample Data
  const dailyTrendData = [
    { name: "Mon", completed: 28, target: 30 },
    { name: "Tue", completed: 35, target: 30 },
    { name: "Wed", completed: 42, target: 30 },
    { name: "Thu", completed: 48, target: 30 },
    { name: "Fri", completed: stats.completed, target: 30 },
    { name: "Sat", completed: 12, target: 15 },
    { name: "Sun", completed: 8, target: 15 }
  ];

  const productivityData = [
    { name: "Auditor Smith", audits: 12, quality: 96 },
    { name: "Auditor Jones", audits: 18, quality: 94 },
    { name: "Auditor Davis", audits: 8, quality: 98 },
    { name: "Auditor Patel", audits: 14, quality: 95 },
    { name: "Auditor Kim", audits: 10, quality: 97 }
  ];

  const scoreTrendData = [
    { week: "Wk 22", score: 92.4 },
    { week: "Wk 23", score: 93.1 },
    { week: "Wk 24", score: 93.8 },
    { week: "Wk 25", score: 94.2 },
    { week: "Wk 26", score: 94.6 }
  ];

  const disputeStatusData = [
    { name: "Resolved Today", value: 5, color: "#10b981" },
    { name: "In Review", value: stats.disputes, color: "#f59e0b" },
    { name: "Awaiting Action", value: 1, color: "#ef4444" }
  ];

  // Interactive Quick Actions triggers
  const handleActionClick = (actionType: string) => {
    if (actionType === "import") {
      setStats(prev => ({
        ...prev,
        assigned: prev.assigned + 15,
        pending: prev.pending + 15
      }));
      const newAct = {
        id: "act-new-" + Math.random(),
        type: "system",
        title: "Transcripts Ingested Successfully",
        desc: "Ingested 15 brand new customer support cases via secure API stream.",
        time: "Just now",
        badge: "Auto Import"
      };
      setActivities(prev => [newAct, ...prev]);
      addToast("success", "Ingest Batch Complete", "15 new cases imported and routed to primary assignment queues.");
    } else if (actionType === "assign") {
      if (stats.pending === 0) {
        addToast("info", "Queue Empty", "No pending reviews require auditor allocation.");
        return;
      }
      const assignCount = Math.min(stats.pending, 5);
      setStats(prev => ({
        ...prev,
        pending: prev.pending - assignCount,
        assigned: prev.assigned - assignCount,
        completed: prev.completed + assignCount
      }));
      const newAct = {
        id: "act-new-" + Math.random(),
        type: "completed",
        title: "Auto-Allocation Triggered",
        desc: `Routed ${assignCount} pending support reviews directly to online QA auditors.`,
        time: "Just now",
        badge: "Distribution Engine"
      };
      setActivities(prev => [newAct, ...prev]);
      addToast("success", "Queue Balanced", `Successfully balanced active load. Assigned ${assignCount} reviews.`);
    } else if (actionType === "export") {
      addToast("info", "Preparing QA Report", "Assembling performance matrices across LOB queues...");
      setTimeout(() => {
        addToast("success", "QA Export Complete", "PrecisionQA evaluation spreadsheet downloaded successfully.");
      }, 1000);
    } else if (actionType === "calibration") {
      const newAct = {
        id: "act-new-" + Math.random(),
        type: "calibration",
        title: "Calibration Target Configured",
        desc: "Calibration session target locked with Fintech compliance standard.",
        time: "Just now",
        badge: "Calibration"
      };
      setActivities(prev => [newAct, ...prev]);
      addToast("success", "Calibration Standard Synced", "All auditors calibrated to latest quality benchmarks.");
    }
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* HEADER OVERVIEW */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-end justify-between border-b border-slate-200 dark:border-white/10 pb-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 px-2 py-0.5 rounded-full uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Secure Session Active
            </span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              LOB: {currentUser.lob || "ALL"}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {currentUser.role === UserRole.SUPER_ADMIN ? "Enterprise Control Center" :
             currentUser.role === UserRole.QA_MANAGER ? "Quality Management Hub" :
             currentUser.role === UserRole.TEAM_LEADER ? "Team Performance Deck" :
             currentUser.role === UserRole.QA_AUDITOR ? "Auditor Workspace" :
             currentUser.role === UserRole.AGENT ? "My Performance Dashboard" : "Operations Overview"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Welcome back, <span className="font-semibold text-slate-700 dark:text-slate-300">{currentUser.name}</span>. 
            {currentUser.role === UserRole.SUPER_ADMIN ? " High-level system orchestration and security matrices are online." :
             currentUser.role === UserRole.QA_MANAGER ? " Your LOB quality trends and management queues are synced." :
             currentUser.role === UserRole.TEAM_LEADER ? " Real-time team scores and coaching priorities are ready." :
             currentUser.role === UserRole.QA_AUDITOR ? " Your personal review queue is updated with new assignments." :
             currentUser.role === UserRole.AGENT ? " View your latest audit scores and feedback from quality sessions." : 
             ` The ${currentUser.team || "Central QA"} queue is actively syncing.`}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              onRefreshSession();
              addToast("info", "Syncing", "Refreshing operational metrics...");
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw size={14} className="text-slate-400 dark:text-slate-500" />
            Refresh
          </button>
        </div>
      </div>
      
      {/* METRIC CARD GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-300">
        {operationMetrics.map((card) => (
          <DashboardCard
            key={card.id}
            id={card.id}
            title={card.title}
            value={card.value}
            change={card.change}
            isPositive={card.isPositive}
            subtitle={card.subtitle}
            icon={card.icon}
            iconColorClass={card.color}
          />
        ))}
      </div>

      {/* AI Performance & Coaching Insights Section */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/15 border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-md shadow-indigo-500/10">
              <Zap size={20} className="text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                AI Performance & Coaching Insights
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate real-time compliance trends, coaching vectors, and risk analyses based on current session queues.
              </p>
            </div>
          </div>
          <button
            onClick={handleGenerateInsights}
            disabled={loadingInsights}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10 shrink-0 self-start sm:self-auto"
          >
            {loadingInsights ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                Analyzing Queues...
              </>
            ) : (
              <>
                <Zap size={12} />
                Generate AI Insights
              </>
            )}
          </button>
        </div>

        {aiInsights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {aiInsights.map((insight, idx) => (
              <div key={idx} className="bg-white dark:bg-zinc-900/60 p-4 rounded-xl border border-slate-100 dark:border-zinc-800 flex gap-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="text-indigo-500 font-extrabold font-mono text-sm shrink-0">0{idx + 1}.</span>
                <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed font-semibold">{insight}</p>
              </div>
            ))}
          </div>
        ) : !loadingInsights ? (
          <div className="p-4 bg-white/40 dark:bg-zinc-900/20 rounded-xl border border-dashed border-indigo-150 dark:border-indigo-900/30 text-center py-6">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Click "Generate AI Insights" to compile custom operational intelligence based on current metrics.</p>
          </div>
        ) : null}
      </div>

      {/* Grid section removed as per user request */}


      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* RECENT ACTIVITIES - Visible to All */}
        <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="space-y-1 mb-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {currentUser.role === UserRole.AGENT ? "Recent Feedbacks" : "Activity Log"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentUser.role === UserRole.AGENT ? "Latest evaluations on your cases" : "Real-time system and agent events"}
            </p>
          </div>
          
          <div className="space-y-4 flex-1">
            {activities.length > 0 ? (
              activities.map((act) => (
                <div key={act.id} className="flex gap-4 items-start group">
                  <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 shadow-sm ${
                    act.type === "completed" ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800/30 dark:text-emerald-400" :
                    act.type === "dispute" ? "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800/30 dark:text-rose-400" :
                    act.type === "system" ? "bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800/30 dark:text-blue-400" : 
                    "bg-purple-50 border-purple-100 text-purple-600 dark:bg-purple-900/20 dark:border-purple-800/30 dark:text-purple-400"
                  }`}>
                    {act.type === "completed" ? <CheckCircle size={16} /> :
                     act.type === "dispute" ? <AlertTriangle size={16} /> :
                     act.type === "system" ? <RefreshCw size={16} /> : <BarChart2 size={16} />}
                  </div>
                  <div className="flex-1 min-w-0 border-b border-slate-100 dark:border-white/5 pb-4 group-last:border-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">{act.title}</h4>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 shrink-0">{act.time}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2">{act.desc}</p>
                    <span className="inline-flex items-center text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                      {act.badge}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="text-slate-200 dark:text-white/5 mb-3" size={32} />
                <p className="text-sm text-slate-400">No recent activities found.</p>
              </div>
            )}
          </div>
        </div>

        {/* ROLE SPECIFIC SECOND COLUMN */}
        {(currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.QA_MANAGER || currentUser.role === UserRole.TEAM_LEADER) ? (
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="space-y-1 mb-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Auditor Performance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Quality vs Volume (This Week)</p>
            </div>
            
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productivityData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="currentColor" className="text-slate-100 dark:text-white/5" />
                  <XAxis type="number" stroke="currentColor" className="text-slate-400 dark:text-slate-500" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="currentColor" className="text-slate-600 dark:text-slate-300 font-medium" fontSize={11} tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    cursor={{ fill: 'currentColor', className: 'text-slate-50 dark:text-white/5' }}
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                  />
                  <Bar dataKey="audits" name="Total Audits" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
                  <Bar dataKey="quality" name="Avg Score" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="space-y-1 mb-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Personal Growth Trend</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your quality score over the last 5 weeks</p>
            </div>
            
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scoreTrendData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="currentColor" className="text-slate-100 dark:text-white/5" />
                  <XAxis dataKey="week" stroke="currentColor" className="text-slate-400 dark:text-slate-500" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[80, 100]} stroke="currentColor" className="text-slate-400 dark:text-slate-500" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#10b981" fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Benchmark vs LOB Average</span>
                <span className="text-emerald-600 font-bold">+2.4%</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}
