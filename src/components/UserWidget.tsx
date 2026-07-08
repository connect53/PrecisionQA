import React, { useState, useRef, useEffect } from "react";
import { LogOut, User as UserIcon, Shield, Sparkles, Building, Settings, Check } from "lucide-react";
import { User, UserRole } from "../types";
import { authService } from "../lib/authService";

interface UserWidgetProps {
  user: User;
  onLogout: () => void;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
  onProfileClick: () => void;
}

export default function UserWidget({ user, onLogout, addToast, onProfileClick }: UserWidgetProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogoutClick = async () => {
    try {
      await authService.logout();
      addToast("success", "Successfully Logged Out", "Session ended. Proceeding back to security checkpoint.");
      onLogout();
    } catch (err: any) {
      addToast("error", "Sign Out Failure", err.message || "An error occurred ending your session.");
    }
  };

  // Assign color classes to active role badges
  const roleConfig = {
    [UserRole.SUPER_ADMIN]: {
      label: "Super Admin",
      color: "bg-purple-50 text-purple-700 border-purple-150 shadow-xs shadow-purple-500/5",
      dot: "bg-purple-500"
    },
    [UserRole.ADMIN]: {
      label: "Administrator",
      color: "bg-red-50 text-red-700 border-red-150 shadow-xs shadow-red-500/5",
      dot: "bg-red-500"
    },
    [UserRole.QA_MANAGER]: {
      label: "QA Manager",
      color: "bg-amber-50 text-amber-700 border-amber-150 shadow-xs shadow-amber-500/5",
      dot: "bg-amber-500"
    },
    [UserRole.QA_AUDITOR]: {
      label: "QA Auditor",
      color: "bg-blue-50 text-blue-700 border-blue-150 shadow-xs shadow-blue-500/5",
      dot: "bg-blue-500"
    },
    [UserRole.TEAM_LEADER]: {
      label: "Team Leader",
      color: "bg-indigo-50 text-indigo-700 border-indigo-150 shadow-xs shadow-indigo-500/5",
      dot: "bg-indigo-500"
    },
    [UserRole.AGENT]: {
      label: "Support Agent",
      color: "bg-emerald-50 text-emerald-700 border-emerald-150 shadow-xs shadow-emerald-500/5",
      dot: "bg-emerald-500"
    },
    [UserRole.CLIENT]: {
      label: "Client Partner (Read Only)",
      color: "bg-slate-50 dark:bg-[#111111]/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 shadow-xs shadow-slate-500/5",
      dot: "bg-slate-50 dark:bg-[#111111]/50"
    }
  }[user.role] || {
    label: "Guest",
    color: "bg-slate-50 dark:bg-[#111111]/5 text-slate-700 dark:text-slate-300 border-slate-150 dark:border-white/5 shadow-xs shadow-slate-500/5",
    dot: "bg-slate-50 dark:bg-[#111111]/50"
  };

  return (
    <div className="relative" ref={dropdownRef}>
      
      {/* TRIGGER AVATAR PILL */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111111]/5 hover:bg-slate-100 hover:border-slate-300 transition-all duration-150 text-left outline-none cursor-pointer focus:ring-4 focus:ring-slate-100"
      >
        <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden border border-slate-300/60 flex-shrink-0">
          <img 
            src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="hidden sm:block">
          <div className="text-[11px] font-bold text-slate-900 dark:text-white leading-none">{user.name}</div>
          <div className="text-[8px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
            <span className={`w-1 h-1 rounded-full ${roleConfig.dot}`}></span>
            {roleConfig.label}
          </div>
        </div>
      </button>

      {/* DROPDOWN MENU */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/10/95 shadow-xl py-3 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          
          {/* USER INFO PANEL */}
          <div className="px-4 pb-3 mb-2 border-b border-slate-100 dark:border-white/5 flex gap-3 items-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200 dark:border-white/10 flex-shrink-0">
              <img 
                src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</h4>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
              <div className="mt-1.5">
                <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${roleConfig.color}`}>
                  <span className={`w-1 h-1 rounded-full ${roleConfig.dot}`}></span>
                  {roleConfig.label}
                </span>
              </div>
            </div>
          </div>

          {/* ACTIVE LICENSE AND SEAT POLICIES */}
          <div className="px-4 py-1.5">
            <div className="text-[9px] uppercase font-extrabold tracking-widest text-slate-400">License Capabilities</div>
            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1 text-slate-500 font-medium"><Check size={10} className="text-blue-500 shrink-0" /> Multi-Tenant Workspace</span>
                <span className="font-semibold bg-slate-100 border border-slate-200 dark:border-white/10 px-1 py-0.5 rounded">Active</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1 text-slate-500 font-medium"><Check size={10} className="text-blue-500 shrink-0" /> Audit Log Compliance</span>
                <span className="font-semibold bg-slate-100 border border-slate-200 dark:border-white/10 px-1 py-0.5 rounded">Enabled</span>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="border-t border-slate-100 dark:border-white/5 mt-3 pt-2 px-2">
            <button
              onClick={() => {
                setDropdownOpen(false);
                onProfileClick();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-[#111111]/5 rounded-xl transition-colors cursor-pointer text-left mb-1"
            >
              <UserIcon size={13} className="stroke-[2.5] text-slate-400" />
              My Workspace Profile
            </button>
            <button
              onClick={handleLogoutClick}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer text-left"
            >
              <LogOut size={13} className="stroke-[2.5]" />
              Sign Out Securely
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
