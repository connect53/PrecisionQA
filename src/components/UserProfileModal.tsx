import React, { useState } from "react";
import { X, User as UserIcon, Lock, KeyRound, Save, Badge, Shield, RefreshCw } from "lucide-react";
import { User, UserRole } from "../types";
import { authService } from "../lib/authService";

interface UserProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdate: (updatedUser: User) => void;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
}

export default function UserProfileModal({ user, onClose, onUpdate, addToast }: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
  
  // Profile inputs
  const [name, setName] = useState(user.name);
  const [employeeId, setEmployeeId] = useState(user.employeeId || "");
  const [team, setTeam] = useState(user.team || "");
  const [lob, setLob] = useState(user.lob || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [updating, setUpdating] = useState(false);

  // Password change inputs
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleUpdateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast("error", "Validation Error", "Full Name cannot be empty.");
      return;
    }
    setUpdating(true);
    try {
      const updated = await authService.updateProfile(user.id, {
        name,
        employeeId,
        team,
        lob,
        avatarUrl
      });
      addToast("success", "Profile Updated", "Your secure workspace profile has been successfully updated.");
      onUpdate(updated);
    } catch (err: any) {
      addToast("error", "Update Error", err.message || "An error occurred updating your profile.");
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      addToast("error", "Validation Error", "Please provide your current account password.");
      return;
    }
    if (newPassword.length < 6) {
      addToast("error", "Weak Password", "New password must be at least 6 characters in length.");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("error", "Discrepancy Error", "The new passwords do not match. Please verify.");
      return;
    }

    setChangingPassword(true);
    try {
      await authService.changePassword(user.id, currentPassword, newPassword);
      addToast("success", "Password Updated", "Your authentication password has been changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      addToast("error", "Security Discrepancy", err.message || "Password modification rejected.");
    } finally {
      setChangingPassword(false);
    }
  };

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: "Super Admin",
      [UserRole.ADMIN]: "Administrator",
      [UserRole.QA_MANAGER]: "QA Manager",
      [UserRole.QA_AUDITOR]: "QA Auditor",
      [UserRole.TEAM_LEADER]: "Team Leader",
      [UserRole.AGENT]: "Support Agent",
      [UserRole.CLIENT]: "Client Partner (Read Only)"
    };
    return labels[role] || "Workspace Member";
  };

  const getInitials = (n: string) => {
    return n.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200 dark:border-white/10/80 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-[#111111]/5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
              <UserIcon size={16} className="text-blue-600" />
              Workspace Account Settings
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1 uppercase tracking-widest">
              ID: {user.id.slice(0, 8)}... — Tenant Group Account
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-100 dark:border-white/5 px-4.5 bg-slate-50 dark:bg-[#111111]/5/50">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "profile"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-400"
            }`}
          >
            <UserIcon size={13} />
            My Profile Card
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "security"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-400"
            }`}
          >
            <KeyRound size={13} />
            Security & Credentials
          </button>
        </div>

        {/* TAB 1: PROFILE FORM */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "profile" ? (
            <form onSubmit={handleUpdateProfileSubmit} className="space-y-4">
              
              {/* PHOTO / INITIALS DISPLAY */}
              <div className="flex items-center gap-4 bg-blue-50/25 border border-blue-100/50 p-4 rounded-xl">
                <div className="w-14 h-14 rounded-full bg-blue-600 border border-blue-300 text-white flex items-center justify-center font-extrabold text-lg shadow-sm overflow-hidden flex-shrink-0">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt={name} 
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    getInitials(name)
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{getRoleLabel(user.role)} Access</div>
                  <div className="text-[10px] text-slate-400 leading-none">Registered Email: {user.email}</div>
                  <div className="text-[9px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block font-bold uppercase mt-1">
                    ● ACTIVE SEAT
                  </div>
                </div>
              </div>

              {/* INPUT FIELDS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Full Employee Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-slate-50 dark:bg-[#111111]/5 focus:bg-white dark:bg-[#111111] focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Employee ID Code</label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="EMP-405"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-slate-50 dark:bg-[#111111]/5 focus:bg-white dark:bg-[#111111] focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Primary LOB Group</label>
                  <input
                    type="text"
                    value={lob}
                    onChange={(e) => setLob(e.target.value)}
                    placeholder="Fintech / Telecom"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-slate-50 dark:bg-[#111111]/5 focus:bg-white dark:bg-[#111111] focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Team Division Name</label>
                  <input
                    type="text"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="Support Group Alpha"
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-slate-50 dark:bg-[#111111]/5 focus:bg-white dark:bg-[#111111] focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                  />
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Profile Image URL (Optional)</label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-slate-50 dark:bg-[#111111]/5 focus:bg-white dark:bg-[#111111] focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-white/5 pt-5 mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 dark:bg-[#111111]/5 transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-sm shadow-blue-500/10"
                >
                  {updating ? <RefreshCw className="animate-spin" size={13} /> : <Save size={13} />}
                  Save Profile Info
                </button>
              </div>

            </form>
          ) : (
            /* TAB 2: SECURITY PASSWORD FORM */
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div className="flex gap-3 bg-amber-50/40 border border-amber-200/60 p-4 rounded-xl text-amber-900 mb-2">
                <Shield size={20} className="text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="text-xs font-bold">Credential Hardening Rules</h4>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    Updating your login credentials initiates immediate token reissue. Ensure the new pass conforms to corporate complexity: minimum 6 letters/numbers.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Current Account Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-slate-50 dark:bg-[#111111]/5 focus:bg-white dark:bg-[#111111] focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">New Secure Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-slate-50 dark:bg-[#111111]/5 focus:bg-white dark:bg-[#111111] focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-slate-50 dark:bg-[#111111]/5 focus:bg-white dark:bg-[#111111] focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-white/5 pt-5 mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 dark:bg-[#111111]/5 transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-sm shadow-blue-500/10"
                >
                  {changingPassword ? <RefreshCw className="animate-spin" size={13} /> : <KeyRound size={13} />}
                  Change Credentials
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
}
