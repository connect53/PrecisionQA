import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import Toast from './components/Toast';
import { authService } from './lib/authService';
import { User, ToastMessage } from './types';
import WorkspaceDashboards from './components/WorkspaceDashboards';
import UserProfileModal from './components/UserProfileModal';
import PrecisionLoader from './components/PrecisionLoader';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Initialize Session
  useEffect(() => {
    const session = authService.getSession();
    if (session && session.user) {
      // Check expiration
      if (session.expiresAt && session.expiresAt < Date.now()) {
        authService.clearSession();
        addToast("warning", "Session Expired", "Your secure session has expired. Please sign in again.");
      } else if (session.user) {
        setCurrentUser(session.user);
        
        // Initial sync to ensure we have the latest role/profile from database
        authService.syncProfile(session.user).then(updatedUser => {
          if (updatedUser.role !== session.user!.role || updatedUser.name !== session.user!.name) {
            setCurrentUser(updatedUser);
            console.log("[Auth Sync] Local profile updated with latest server state.");
          }
        });
      }
    }
    setAuthInitialized(true);

    // Listen for session updates from other parts of the app (or other tabs)
    const handleSessionUpdate = (event: any) => {
      const newSession = event.detail;
      if (newSession && newSession.user) {
        setCurrentUser(newSession.user);
        console.log("[Auth Sync] User state synchronized from event.");
      } else {
        setCurrentUser(null);
      }
    };

    window.addEventListener("auth-session-updated", handleSessionUpdate);
    
    // Periodic sync (every 60 seconds) to catch remote role changes/promotions
    const syncInterval = setInterval(() => {
      const currentSession = authService.getSession();
      if (currentSession && currentSession.user) {
        authService.syncProfile(currentSession.user).then(updatedUser => {
          if (updatedUser.role !== currentSession.user!.role || updatedUser.name !== currentSession.user!.name) {
            setCurrentUser(updatedUser);
            addToast("info", "Access Updated", `Your account permissions have been updated to ${updatedUser.role}.`);
          }
        });
      }
    }, 60000);

    return () => {
      window.removeEventListener("auth-session-updated", handleSessionUpdate);
      clearInterval(syncInterval);
    };
  }, []);

  const addToast = (type: "success" | "error" | "info" | "warning", title: string, description?: string) => {
    const id = "toast-" + Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, type, title, description }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (showLoader || !authInitialized) {
    return <PrecisionLoader onComplete={() => setShowLoader(false)} />;
  }

  return (
    <Router>
      <ErrorBoundary>
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#000000] font-sans text-slate-800 dark:text-slate-200 flex flex-col selection:bg-blue-600 selection:text-white">
          <Routes>
            <Route 
              path="/login" 
              element={
                !currentUser ? (
                  <LoginPage 
                    onSuccess={() => {
                      const session = authService.getSession();
                      if (session?.user) {
                        setCurrentUser(session.user);
                      }
                    }} 
                    addToast={addToast} 
                  />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              } 
            />
            
            <Route 
              path="/dashboard/*" 
              element={
                currentUser ? (
                  <WorkspaceDashboards 
                    currentUser={currentUser} 
                    onOpenProfile={() => setIsProfileOpen(true)}
                    addToast={addToast}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>

          {isProfileOpen && currentUser && (
            <UserProfileModal 
              user={currentUser} 
              onClose={() => setIsProfileOpen(false)} 
              onUpdate={(updatedUser) => {
                setCurrentUser(updatedUser);
              }}
              addToast={addToast}
            />
          )}

          <Toast toasts={toasts} onRemove={removeToast} />
        </div>
      </ErrorBoundary>
    </Router>
  );
}
