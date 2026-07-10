import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Toast from './components/Toast';
import { authService } from './lib/authService';
import { User, ToastMessage } from './types';
import UserProfileModal from './components/UserProfileModal';
import PrecisionLoader from './components/PrecisionLoader';
import { ErrorBoundary, RouteErrorBoundary } from './components/ErrorBoundary';

const LoginPage = lazy(() => import('./components/LoginPage'));
const WorkspaceDashboards = lazy(() => import('./components/WorkspaceDashboards'));

// A sleek skeleton/loader for route transition
const RouteLoader = () => (
  <div className="flex-1 min-h-screen bg-slate-50 dark:bg-[#000000] flex flex-col items-center justify-center p-6">
    <div className="space-y-4 w-full max-w-sm text-center">
      <div className="inline-block relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-950 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 animate-pulse">Initializing module assets...</p>
    </div>
  </div>
);

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof window !== 'undefined' ? !navigator.onLine : false);

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

    // Online/Offline tracking
    const handleOnline = () => {
      setIsOffline(false);
      addToast("success", "Connection Restored", "PrecisionQA is back online. Cloud services synchronized.");
    };
    const handleOffline = () => {
      setIsOffline(true);
      addToast("error", "Network Failure", "You are currently operating in offline mode. PrecisionQA will cache actions locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

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
      if (navigator.onLine) {
        const currentSession = authService.getSession();
        if (currentSession && currentSession.user) {
          authService.syncProfile(currentSession.user).then(updatedUser => {
            if (updatedUser.role !== currentSession.user!.role || updatedUser.name !== currentSession.user!.name) {
              setCurrentUser(updatedUser);
              addToast("info", "Access Updated", `Your account permissions have been updated to ${updatedUser.role}.`);
            }
          });
        }
      }
    }, 60000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
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
          {isOffline && (
            <div className="bg-rose-600 dark:bg-rose-950/90 text-white dark:text-rose-100 text-xs font-bold px-4 py-2.5 flex items-center justify-between shadow-md z-50 sticky top-0 animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                <span>PrecisionQA detected a connection loss. Working with local cached state. Action queues will synchronize once online.</span>
              </div>
              <button 
                onClick={() => {
                  setIsOffline(!navigator.onLine);
                  if (navigator.onLine) {
                    addToast("success", "Synchronized", "Successfully synchronized status with enterprise servers.");
                  } else {
                    addToast("warning", "Offline", "Still unable to establish a secure connection.");
                  }
                }}
                className="bg-white/15 hover:bg-white/25 text-white border border-white/20 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all"
              >
                Force Re-Sync
              </button>
            </div>
          )}

          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route 
                path="/login" 
                element={
                  <RouteErrorBoundary>
                    {!currentUser ? (
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
                    )}
                  </RouteErrorBoundary>
                } 
              />
              
              <Route 
                path="/dashboard/*" 
                element={
                  <RouteErrorBoundary>
                    {currentUser ? (
                      <WorkspaceDashboards 
                        currentUser={currentUser} 
                        onOpenProfile={() => setIsProfileOpen(true)}
                        addToast={addToast}
                      />
                    ) : (
                      <Navigate to="/login" replace />
                    )}
                  </RouteErrorBoundary>
                } 
              />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>

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
