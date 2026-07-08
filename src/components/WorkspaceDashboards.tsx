import React from "react";
import { User } from "../types";
import DashboardShell from "./dashboard/DashboardShell";
import { authService } from "../lib/authService";

interface WorkspaceDashboardsProps {
  currentUser: User;
  onOpenProfile: () => void;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
}

export default function WorkspaceDashboards({ currentUser, onOpenProfile, addToast }: WorkspaceDashboardsProps) {
  
  const handleLogout = async () => {
    try {
      await authService.logout();
      window.location.reload(); // Hard reload to clear session safely
    } catch (err: any) {
      addToast("error", "Logout Failure", err.message || "Could not end security session.");
    }
  };

  return (
    <div className="w-full">
      <DashboardShell 
        currentUser={currentUser}
        onOpenProfile={onOpenProfile}
        addToast={addToast}
        onLogout={handleLogout}
      />
    </div>
  );
}
