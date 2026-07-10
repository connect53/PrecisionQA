import React, { useState, useEffect } from "react";
import { 
  Building, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  CheckCircle2, 
  HelpCircle,
  Briefcase,
  Users,
  ShieldAlert,
  Sparkles,
  ChevronLeft,
  Layers,
  BarChart3,
  Globe,
  Fingerprint,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserRole } from "../types";
import { authService, getFriendlyErrorMessage } from "../lib/authService";

interface LoginPageProps {
  onSuccess: () => void;
  addToast: (type: "success" | "error" | "info" | "warning", title: string, description?: string) => void;
}

export default function LoginPage({ onSuccess, addToast }: LoginPageProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // Form input state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.AGENT);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Sign up credentials (visual validation)
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Loading & Error States
  const [loading, setLoading] = useState(false);

  // Forgot password flow states
  const [resetEmail, setResetEmail] = useState("");
  const [resetStep, setResetStep] = useState<"input" | "sent" | "change" | "success">("input");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Demo accounts data as requested
  const demoAccounts = [
    {
      email: "superadmin@precisionqa.com",
      password: "admin123",
      name: "Alex Rivera",
      role: UserRole.SUPER_ADMIN,
      badge: "Super Admin",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80",
      color: "border-purple-500/20 text-purple-400 bg-purple-500/10"
    },
    {
      email: "manager@precisionqa.com",
      password: "manager123",
      name: "Marcus Chen",
      role: UserRole.QA_MANAGER,
      badge: "QA Manager",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80",
      color: "border-amber-500/20 text-amber-400 bg-amber-500/10"
    },
    {
      email: "auditor@precisionqa.com",
      password: "auditor123",
      name: "Elena Rostova",
      role: UserRole.QA_AUDITOR,
      badge: "QA Auditor",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&h=120&q=80",
      color: "border-blue-500/20 text-blue-400 bg-blue-500/10"
    },
    {
      email: "leader@precisionqa.com",
      password: "leader123",
      name: "Sophia Martinez",
      role: UserRole.TEAM_LEADER,
      badge: "Supervisor",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80",
      color: "border-indigo-500/20 text-indigo-400 bg-indigo-500/10"
    },
    {
      email: "agent@precisionqa.com",
      password: "agent123",
      name: "Daniel Kim",
      role: UserRole.AGENT,
      badge: "Support Agent",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80",
      color: "border-emerald-500/20 text-emerald-400 bg-emerald-500/10"
    },
    {
      email: "client@precisionqa.com",
      password: "client123",
      name: "John Vanguard",
      role: UserRole.CLIENT,
      badge: "Client Portal",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&h=120&q=80",
      color: "border-zinc-500/20 text-zinc-400 bg-zinc-500/10"
    }
  ];

  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    
    // 1. Password Recovery Redirect Detection
    if (
      hash.includes("type=recovery") || 
      search.includes("type=recovery") || 
      hash.includes("recovery_token") || 
      search.includes("recovery_token")
    ) {
      addToast(
        "info",
        "Security Token Verified",
        "Your password reset link has been validated. Please enter your new password below to update your account details."
      );
      setShowForgotPassword(true);
      setResetStep("change");

      // Auto-extract user email if recovery session pre-authenticates them
      if (!authService.isSimulated && authService.supabaseUrl) {
        import("../lib/authService").then(({ supabase }) => {
          if (supabase) {
            supabase.auth.getUser().then(({ data }) => {
              if (data?.user?.email) {
                setResetEmail(data.user.email);
              }
            });
          }
        });
      }
    }

    // 2. Email Confirmation Redirect Detection
    if (hash.includes("type=signup") || search.includes("type=signup")) {
      addToast(
        "success",
        "Email Confirmed",
        "Your email address has been successfully verified. You are ready to log in with your credentials."
      );
      setActiveTab("signin");
      setShowForgotPassword(false);
    }
  }, [addToast]);

  // Quick select/One-click demo login
  const handleQuickDemoSelect = async (demo: typeof demoAccounts[0]) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setSelectedRole(demo.role);
    setActiveTab("signin");
    setShowForgotPassword(false);
    
    addToast("info", "Quick Authenticating", `One-click logging in as ${demo.name} (${demo.badge})...`);
    
    setLoading(true);
    try {
      const user = await authService.login(demo.email, demo.password, rememberMe);
      addToast(
        "success", 
        "Welcome Back!", 
        `Authenticated successfully as ${user.name} (${user.role.toUpperCase()}). Redirecting...`
      );
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: any) {
      console.error(err);
      addToast("error", "Authentication Failed", getFriendlyErrorMessage(err, "Invalid credentials."));
    } finally {
      setLoading(false);
    }
  };

  // Google Sign In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await authService.signInWithGoogle(rememberMe);
      if (user) {
        addToast(
          "success", 
          "Welcome Back!", 
          `Authenticated via Google SSO as ${user.name} (${user.role.toUpperCase()}). Redirecting...`
        );
        setTimeout(() => {
          onSuccess();
        }, 500);
      } else {
        addToast("info", "Redirecting", "Redirecting to Google Secure Sign-In portal...");
      }
    } catch (err: any) {
      console.error(err);
      addToast("error", "Google Sign-In Failed", getFriendlyErrorMessage(err, "Google OAuth validation failed."));
    } finally {
      setLoading(false);
    }
  };

  // Submit Sign In
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast("error", "Validation Error", "Email and Password fields are required.");
      return;
    }

    setLoading(true);
    try {
      const user = await authService.login(email, password, rememberMe);
      addToast(
        "success", 
        "Welcome Back!", 
        `Authenticated successfully as ${user.name} (${user.role.toUpperCase()}). Redirecting...`
      );
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: any) {
      console.error(err);
      addToast("error", "Authentication Failed", getFriendlyErrorMessage(err, "Invalid credentials. Please verify your details."));
    } finally {
      setLoading(false);
    }
  };

  // Submit Sign Up
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) {
      addToast("error", "Validation Error", "Please provide both email and full name to create an account.");
      return;
    }
    if (!termsAccepted) {
      addToast("error", "Terms Required", "You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    if (signUpPassword !== signUpConfirmPassword) {
      addToast("error", "Password Mismatch", "Passwords entered do not match.");
      return;
    }

    setLoading(true);
    try {
      const user = await authService.signUp(email, name, selectedRole, rememberMe, signUpPassword);
      addToast(
        "success", 
        "Account Provisioned", 
        `Welcome to PrecisionQA, ${user.name}! Credentials saved. Redirecting to Dashboard.`
      );
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: any) {
      console.error(err);
      const errMsg = getFriendlyErrorMessage(err, "Failed to create account. Please verify your details.");
      if (errMsg.includes("CONFIRMATION_REQUIRED:")) {
        const userFriendlyMsg = errMsg.replace("CONFIRMATION_REQUIRED: ", "");
        addToast("info", "Verification Required", userFriendlyMsg);
        setActiveTab("signin");
      } else {
        addToast("error", "Registration Error", errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Submit Forgot Password Step 1
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      addToast("error", "Required Field", "Please specify an email address to dispatch reset instructions.");
      return;
    }

    setLoading(true);
    try {
      const dispatchMessage = await authService.forgotPassword(resetEmail);
      addToast("success", "Instructions Dispatched", dispatchMessage);
      setResetStep("sent");
    } catch (err: any) {
      console.error(err);
      addToast("error", "Reset Dispatch Failed", getFriendlyErrorMessage(err, "Failed to send reset email. Verify your Supabase SMTP/Email provider configuration."));
    } finally {
      setLoading(false);
    }
  };

  // Submit Reset Password Step 2
  const handlePasswordResetChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      addToast("error", "Password Requirements", "Your password must contain at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("error", "Password Mismatch", "Passwords do not match. Please verify your typing.");
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(resetEmail, newPassword);
      addToast("success", "Password Reset Complete", "Your new password has been verified. You may now sign in.");
      setResetStep("success");
    } catch (err: any) {
      console.error(err);
      addToast("error", "Reset Error", getFriendlyErrorMessage(err, "Failed to update your password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans flex flex-col md:grid md:grid-cols-2 lg:grid-cols-12 w-full select-none overflow-x-hidden text-zinc-900 dark:text-zinc-100">
      
      {/* Dynamic Embedded Animations Stylesheet */}
      <style>{`
        @keyframes gradient-xy {
          0%, 100% { background-position: 0% 50% }
          50% { background-position: 100% 50% }
        }
        .animate-gradient-slow {
          background-size: 400% 400%;
          animation: gradient-xy 18s ease infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.1); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 10s ease-in-out infinite;
        }
      `}</style>

      {/* RIGHT PANEL (AUTHENTICATION CARD) - RENDERS FIRST ON MOBILE */}
      <div className="md:order-2 lg:col-span-7 flex flex-col justify-start md:justify-center p-6 sm:p-12 lg:p-16 xl:p-20 bg-slate-50/50 dark:bg-zinc-950/50 relative overflow-y-auto">
        

        <div className="w-full max-w-lg mx-auto space-y-8 py-8 md:py-0">
          
          {/* Main login box with glassmorphism */}
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl rounded-2xl p-6 sm:p-8 relative">
            
            <AnimatePresence mode="wait">
              {showForgotPassword ? (
                /* FORGOT PASSWORD FLOW */
                <motion.div
                  key="forgot"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <button 
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetStep("input");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors font-medium group cursor-pointer mb-4"
                    >
                      <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                      Back to Sign In
                    </button>
                    <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Recover Password</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Provide your workspace corporate email address to retrieve or simulate a security reset token.</p>
                  </div>

                  {resetStep === "input" && (
                    <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Enterprise Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 text-zinc-400" size={15} />
                          <input 
                            type="email"
                            required
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            placeholder="e.g., manager@precisionqa.com"
                            className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:outline-none transition-all font-medium"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-500/10 transition-all hover:scale-[1.01] active:scale-[0.99]"
                      >
                        {loading ? <RefreshCw className="animate-spin" size={14} /> : null}
                        Initialize Recovery Token
                        <ArrowRight size={14} />
                      </button>
                    </form>
                  )}

                  {resetStep === "sent" && (
                    <div className="space-y-6 bg-zinc-50/50 dark:bg-zinc-950/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <div className="flex gap-3 items-start">
                        <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Recovery Instructions Dispatched</h4>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                            An email containing security token update instructions has been dispatched to <code className="bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-zinc-800 dark:text-zinc-200">{resetEmail}</code>.
                          </p>
                        </div>
                      </div>

                      {authService.isSimulated && (
                        <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-4 space-y-3">
                          <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium leading-relaxed">
                            <strong>Self-Service Recovery:</strong> You can proceed to configure the new password directly below.
                          </p>
                          <button
                            type="button"
                            onClick={() => setResetStep("change")}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-3 py-2 rounded-lg transition-all shadow-xs cursor-pointer"
                          >
                            Proceed to Password Reset
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {resetStep === "change" && (
                    <form onSubmit={handlePasswordResetChange} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">New Secure Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 text-zinc-400" size={15} />
                          <input 
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:outline-none transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Confirm New Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 text-zinc-400" size={15} />
                          <input 
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:outline-none transition-all font-medium"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-500/10 transition-all hover:scale-[1.01]"
                      >
                        {loading ? <RefreshCw className="animate-spin" size={14} /> : null}
                        Update Credentials
                      </button>
                    </form>
                  )}

                  {resetStep === "success" && (
                    <div className="space-y-5 text-center py-6">
                      <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mb-2">
                        <CheckCircle2 className="text-emerald-500" size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Credentials Updated Successfully</h4>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          Your new password has been verified. You may now return to the login panel and log in.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowForgotPassword(false);
                          setResetStep("input");
                        }}
                        className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer shadow-xs transition-colors mt-2"
                      >
                        Go to Sign In
                      </button>
                    </div>
                  )}

                </motion.div>
              ) : (
                /* AUTHENTICATION FLOW (SIGN IN / SIGN UP TABS) */
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  
                  {/* WELCOME HEADER */}
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      {activeTab === "signin" ? "Welcome back" : "Create corporate account"}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {activeTab === "signin" 
                        ? "Enter your credentials or continue with workspace SSO." 
                        : "Claim your dedicated platform seat and secure evaluation roles."}
                    </p>
                  </div>

                  {/* ANCHOR TABS SELECTOR */}
                  <div className="flex bg-zinc-100/80 dark:bg-zinc-950/60 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/40 relative">
                    <button
                      onClick={() => {
                        setActiveTab("signin");
                        setPassword("");
                      }}
                      className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all relative cursor-pointer ${
                        activeTab === "signin" 
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold" 
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      Employee Sign In
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("signup");
                        setPassword("");
                      }}
                      className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all relative cursor-pointer ${
                        activeTab === "signup" 
                          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-bold" 
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  {/* SIGN IN FORM VIEW */}
                  {activeTab === "signin" ? (
                    <div className="space-y-5">
                      
                      {/* Google Workspace Auth Button */}
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        Continue with Google Workspace
                      </button>

                      {/* Custom Divider */}
                      <div className="flex items-center gap-3 py-1">
                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1"></div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">or continue with email</span>
                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1"></div>
                      </div>

                      {/* Email Sign In Form */}
                      <form onSubmit={handleSignInSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Email</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3.5 text-zinc-400" size={15} />
                            <input 
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="e.g., manager@precisionqa.com"
                              className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:outline-none transition-all font-medium"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Password</label>
                            <button
                              type="button"
                              onClick={() => setShowForgotPassword(true)}
                              className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-semibold cursor-pointer"
                            >
                              Forgot Password?
                            </button>
                          </div>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3.5 text-zinc-400" size={15} />
                            <input 
                              type={showPassword ? "text" : "password"}
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full pl-10 pr-10 py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:outline-none transition-all font-medium"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                            >
                              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                        </div>

                        {/* Keep Signed In checkbox */}
                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-2 select-none cursor-pointer group">
                            <input 
                              type="checkbox"
                              checked={rememberMe}
                              onChange={(e) => setRememberMe(e.target.checked)}
                              className="rounded border-zinc-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500 w-4 h-4 transition-colors cursor-pointer"
                            />
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">Remember Me</span>
                          </label>
                        </div>

                        {/* Action Submit */}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-500/10 hover:scale-[1.01] active:scale-[0.99] transition-all"
                        >
                          {loading ? <RefreshCw className="animate-spin" size={14} /> : null}
                          Sign In
                          <ArrowRight size={14} />
                        </button>

                      </form>
                    </div>
                  ) : (
                    /* CREATE ACCOUNT VIEW (SIGN UP) */
                    <form onSubmit={handleSignUpSubmit} className="space-y-4">
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Full Name</label>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-3 text-zinc-400" size={15} />
                          <input 
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Sarah Jenkins"
                            className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:outline-none transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Work Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 text-zinc-400" size={15} />
                          <input 
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="sarah.jenkins@precisionqa.com"
                            className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:outline-none transition-all font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 text-zinc-400" size={15} />
                            <input 
                              type="password"
                              required
                              value={signUpPassword}
                              onChange={(e) => setSignUpPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:outline-none transition-all font-medium"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Confirm Password</label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 text-zinc-400" size={15} />
                            <input 
                              type="password"
                              required
                              value={signUpConfirmPassword}
                              onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs bg-zinc-50/50 dark:bg-zinc-950/50 focus:bg-white dark:focus:bg-zinc-900 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:outline-none transition-all font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Role selector - rendered Read Only as requested */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Role (Read Only)</label>
                        <div className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 text-xs">
                          <div className="flex items-center gap-2">
                            <Briefcase size={14} className="text-blue-500" />
                            <span className="font-bold text-zinc-900 dark:text-white">Agent seat</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-medium">Standard License Tier</span>
                        </div>
                      </div>

                      {/* Terms checkbox */}
                      <div className="flex items-center gap-2 pt-1 select-none">
                        <input 
                          id="terms-check"
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="rounded border-zinc-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500 w-4 h-4 transition-colors cursor-pointer"
                        />
                        <label htmlFor="terms-check" className="text-[11px] text-zinc-500 dark:text-zinc-400 cursor-pointer">
                          I agree to the <span className="text-purple-600 dark:text-purple-400 hover:underline">Terms of Service</span> and <span className="text-purple-600 dark:text-purple-400 hover:underline">Privacy Policy</span>.
                        </label>
                      </div>

                      {/* Action Create */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-500/10 hover:scale-[1.01] active:scale-[0.99] transition-all"
                      >
                        {loading ? <RefreshCw className="animate-spin" size={14} /> : null}
                        Create Account
                      </button>

                      <div className="text-center pt-2">
                        <span className="text-xs text-zinc-500">
                          Already have an account?{" "}
                          <button
                            type="button"
                            onClick={() => setActiveTab("signin")}
                            className="text-purple-600 dark:text-purple-400 font-bold hover:underline"
                          >
                            Sign In
                          </button>
                        </span>
                      </div>

                    </form>
                  )}

                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </div>

      </div>

      {/* LEFT PANEL (BRANDING & PRODUCT) */}
      <div className="md:order-1 lg:col-span-5 flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-zinc-950 text-zinc-300 relative overflow-hidden min-h-[400px] md:min-h-screen border-t md:border-t-0 md:border-r border-zinc-900">
        
        {/* Animated fluid mesh background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c051f] via-[#04010a] to-[#12072e] animate-gradient-slow -z-20"></div>
        
        {/* Colorful glowing ambient blobs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-600/15 rounded-full blur-3xl animate-pulse-slow -z-10"></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl animate-pulse-slow -z-10" style={{ animationDelay: '3s' }}></div>

        {/* LOGO & ENTERPRISE BADGE */}
        <div className="flex items-center justify-between w-full relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
              <Building size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight mt-0.5">PrecisionQA</h1>
            </div>
          </div>
        </div>

        {/* VALUE PROPOSITION HEADINGS & COPY */}
        <div className="my-auto py-12 md:py-0 relative z-10 space-y-4">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Smarter Quality.<br />
            Better Performance.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-sm">
            Automating transactional audits, feedback loops, and unified quality assurance metrics on one secure enterprise platform.
          </p>
        </div>

        {/* BOTTOM METRICS & TRUST BADGES */}
        <div className="pt-6 flex items-center justify-between text-zinc-600 text-[10px] font-mono relative z-10">
          <span className="flex items-center gap-1">
            <ShieldCheck size={11} className="text-purple-500/80" /> SOC2 Compliant & RLS Protected
          </span>
          <span>v2.2.0</span>
        </div>

      </div>

    </div>
  );
}
