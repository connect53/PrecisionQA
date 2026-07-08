import { createClient } from "@supabase/supabase-js";
import { User, UserRole, AuthSession } from "../types";
import { 
  googleSignIn as firebaseGoogleSignIn,
  firebaseSignIn,
  firebaseSignUp,
  firebaseResetPassword
} from "./googleAuth";

// Check if credentials exist
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || "";
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || "";

const isRealSupabaseConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== "YOUR_SUPABASE_URL" && 
  supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY" &&
  supabaseUrl.trim() !== "" &&
  supabaseAnonKey.trim() !== "" &&
  (supabaseUrl.startsWith("http://") || supabaseUrl.startsWith("https://"));

let supabaseInstance = null;
if (isRealSupabaseConfigured) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error("Failed to initialize Supabase client due to invalid configuration:", err);
  }
}

export const supabase = supabaseInstance;

export interface SimulatedUser {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  employeeId: string;
  team: string;
  lob: string;
  status: "active" | "inactive";
  lastLogin?: string;
  createdAt?: string;
  avatarUrl: string;
}

// Initial pre-seeded accounts for the Simulated Supabase Engine
const DEMO_ACCOUNTS: SimulatedUser[] = [
  {
    id: "demo-superadmin-uuid",
    email: "superadmin@precisionqa.com",
    password: "admin123",
    name: "Alex Rivera",
    role: UserRole.SUPER_ADMIN,
    employeeId: "EMP-001",
    team: "Executive Command",
    lob: "Global Platform",
    status: "active" as const,
    lastLogin: new Date().toISOString(),
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80"
  }
];

// Helper to manage simulated users database in localStorage
const getSimulatedUsers = (): SimulatedUser[] => {
  const stored = localStorage.getItem("precisionqa_simulated_users");
  if (!stored) {
    localStorage.setItem("precisionqa_simulated_users", JSON.stringify(DEMO_ACCOUNTS));
    return DEMO_ACCOUNTS;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    return DEMO_ACCOUNTS;
  }
};

const saveSimulatedUser = (newUser: SimulatedUser) => {
  const users = getSimulatedUsers();
  users.push(newUser);
  localStorage.setItem("precisionqa_simulated_users", JSON.stringify(users));
};

export const authService = {
  isSimulated: !isRealSupabaseConfigured,
  supabaseUrl,

  // Get active session
  getSession(): AuthSession {
    const sessionStr = localStorage.getItem("precisionqa_auth_session");
    if (!sessionStr) {
      return { user: null, token: null, expiresAt: null, rememberMe: false };
    }
    try {
      const parsed = JSON.parse(sessionStr);
      // If remember me is false, we can check if it's expired or handle standard session rules
      return parsed;
    } catch (e) {
      return { user: null, token: null, expiresAt: null, rememberMe: false };
    }
  },

  // Save active session
  saveSession(session: AuthSession) {
    localStorage.setItem("precisionqa_auth_session", JSON.stringify(session));
    // Dispatch event for UI synchronization across tabs or components
    window.dispatchEvent(new CustomEvent("auth-session-updated", { detail: session }));
  },

  // Clear active session
  clearSession() {
    localStorage.removeItem("precisionqa_auth_session");
  },

  // Helper to execute simulated login
  async executeSimulatedLogin(normalizedEmail: string, password: string, rememberMe: boolean = false): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const users = getSimulatedUsers();
    const matched = users.find(u => u.email.toLowerCase() === normalizedEmail);

    if (!matched) {
      throw new Error("Invalid credentials. The specified email address is not registered.");
    }

    if (matched.password !== password) {
      throw new Error("Incorrect password. Please verify your credentials and try again.");
    }

    const user: User = {
      id: matched.id,
      email: matched.email,
      name: matched.name,
      role: matched.role,
      employeeId: matched.employeeId,
      team: matched.team,
      lob: matched.lob,
      status: matched.status || "active",
      lastLogin: matched.lastLogin || new Date().toISOString(),
      createdAt: matched.createdAt || new Date().toISOString(),
      avatarUrl: matched.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(matched.name)}`
    };

    const expiresAt = rememberMe 
      ? Date.now() + 30 * 24 * 60 * 60 * 1000 
      : Date.now() + 12 * 60 * 60 * 1000;

    this.saveSession({
      user,
      token: "simulated-jwt-token-" + Math.random().toString(36).substring(2),
      expiresAt,
      rememberMe
    });

    return user;
  },

  // Helper to execute simulated signup
  async executeSimulatedSignUp(normalizedEmail: string, name: string, role: UserRole, rememberMe: boolean = false, password?: string): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 500));

    const users = getSimulatedUsers();
    const exists = users.some(u => u.email.toLowerCase() === normalizedEmail);

    if (exists) {
      throw new Error("An account with this email address already exists.");
    }

    const newSimUser = {
      id: "sim-user-" + Math.random().toString(36).substring(2),
      email: normalizedEmail,
      password: password || "user123", // Pre-seeded password for demo accounts
      name,
      role,
      employeeId: "EMP-" + Math.floor(100 + Math.random() * 900),
      team: "Unassigned Team",
      lob: "General Operations",
      status: "active" as const,
      lastLogin: new Date().toISOString(),
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
    };

    saveSimulatedUser(newSimUser);

    const user: User = {
      id: newSimUser.id,
      email: newSimUser.email,
      name: newSimUser.name,
      role: newSimUser.role,
      employeeId: newSimUser.employeeId,
      team: newSimUser.team,
      lob: newSimUser.lob,
      status: newSimUser.status,
      lastLogin: newSimUser.lastLogin,
      createdAt: new Date().toISOString(),
      avatarUrl: newSimUser.avatarUrl
    };

    const expiresAt = rememberMe 
      ? Date.now() + 30 * 24 * 60 * 60 * 1000 
      : Date.now() + 12 * 60 * 60 * 1000;

    this.saveSession({
      user,
      token: "simulated-jwt-token-" + Math.random().toString(36).substring(2),
      expiresAt,
      rememberMe
    });

    return user;
  },

  // Log in
  async login(email: string, password: string, rememberMe: boolean = false): Promise<User> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if it's a pre-seeded demo account first!
    const isDemoEmail = DEMO_ACCOUNTS.some(u => u.email.toLowerCase() === normalizedEmail);
    if (isDemoEmail) {
      return this.executeSimulatedLogin(normalizedEmail, password, rememberMe);
    }

    if (isRealSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: password
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data.user) {
          throw new Error("Login failed: User record empty.");
        }

        // Map Supabase user metadata to our app User structure
        const metadata = data.user.user_metadata || {};
        const user: User = {
          id: data.user.id,
          email: data.user.email || normalizedEmail,
          name: metadata.name || metadata.full_name || normalizedEmail.split("@")[0],
          role: (metadata.role as UserRole) || UserRole.QA_AUDITOR,
          status: (metadata.status as "active" | "inactive") || "active",
          createdAt: data.user.created_at || new Date().toISOString(),
          avatarUrl: metadata.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(metadata.name || normalizedEmail)}`
        };

        const expiresAt = rememberMe 
          ? Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
          : Date.now() + 12 * 60 * 60 * 1000; // 12 hours

        this.saveSession({
          user,
          token: data.session?.access_token || "supabase-jwt-token",
          expiresAt,
          rememberMe
        });

        // Sync to database to get latest role/profile from public.users
        try {
          return await this.syncProfile(user);
        } catch (syncErr) {
          console.warn("Database profile sync failed after login:", syncErr);
        }

        return user;
      } catch (err: any) {
        console.warn("Supabase Auth login failed. Falling back to local authentication simulation...", err);
        const simUser = await this.executeSimulatedLogin(normalizedEmail, password, rememberMe);
        try {
          return await this.syncProfile(simUser);
        } catch (syncErr) {
          console.warn("Database profile sync failed after simulated login:", syncErr);
        }
        return simUser;
      }
    } else {
      // Real Firebase Auth Integration for client-side deployments (Netlify, etc.)
      try {
        console.log("Attempting real authentication via Firebase Auth...");
        const fbUser = await firebaseSignIn(normalizedEmail, password);
        
        // Check if there is a simulated user profile details in localStorage to retain roles/details
        const users = getSimulatedUsers();
        const matched = users.find(u => u.email.toLowerCase() === normalizedEmail);

        const user: User = {
          id: matched?.id || fbUser.uid,
          email: normalizedEmail,
          name: matched?.name || fbUser.displayName || normalizedEmail.split("@")[0],
          role: (matched?.role as UserRole) || UserRole.QA_AUDITOR,
          employeeId: matched?.employeeId || "EMP-" + fbUser.uid.substring(0, 5).toUpperCase(),
          team: matched?.team || "Tier 1 Support Team A",
          lob: matched?.lob || "Customer Experience",
          status: matched?.status || "active",
          lastLogin: new Date().toISOString(),
          createdAt: matched?.createdAt || new Date().toISOString(),
          avatarUrl: fbUser.photoURL || matched?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fbUser.displayName || normalizedEmail)}`
        };

        const expiresAt = rememberMe 
          ? Date.now() + 30 * 24 * 60 * 60 * 1000 
          : Date.now() + 12 * 60 * 60 * 1000;

        this.saveSession({
          user,
          token: "firebase-jwt-token-" + fbUser.uid.substring(0, 8),
          expiresAt,
          rememberMe
        });

        try {
          await this.syncProfile(user);
        } catch (syncErr) {
          console.warn("Database profile sync failed after Firebase login:", syncErr);
        }

        return user;
      } catch (fbErr: any) {
        console.warn("Firebase Auth login failed. Checking simulated local storage fallback...", fbErr);
        
        // If they already exist in simulation, fallback to simulated login (helpful for offline/dev)
        const users = getSimulatedUsers();
        const existsInSimulation = users.some(u => u.email.toLowerCase() === normalizedEmail);
        if (existsInSimulation) {
          const simUser = await this.executeSimulatedLogin(normalizedEmail, password, rememberMe);
          try {
            return await this.syncProfile(simUser);
          } catch (syncErr) {
            console.warn("Database profile sync failed after simulated login:", syncErr);
          }
          return simUser;
        }
        
        // Otherwise, throw the real Firebase error so the user gets accurate feedback
        throw new Error(fbErr.message || fbErr || "Incorrect credentials. Verification failed.");
      }
    }
  },

  // Sign up
  async signUp(email: string, name: string, role: UserRole, rememberMe: boolean = false, customPassword?: string): Promise<User> {
    const normalizedEmail = email.toLowerCase().trim();
    const password = customPassword || "user123"; 

    let user: User;

    if (isRealSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: password,
          options: {
            data: {
              name,
              role,
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
            }
          }
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data.user) {
          throw new Error("Registration failed.");
        }

        if (!data.session) {
          console.log("[Email Authentication Flow Diagnostics] Supabase signUp succeeded but no active session was returned. Email confirmation flow is active.");
          throw new Error("CONFIRMATION_REQUIRED: Account created successfully! A confirmation email containing an activation link has been sent to your inbox. Please verify your email address to log in.");
        }

        user = {
          id: data.user.id,
          email: normalizedEmail,
          name,
          role,
          status: "active",
          createdAt: data.user.created_at,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
        };

        const expiresAt = rememberMe 
          ? Date.now() + 30 * 24 * 60 * 60 * 1000 
          : Date.now() + 12 * 60 * 60 * 1000;

        this.saveSession({
          user,
          token: data.session.access_token,
          expiresAt,
          rememberMe
        });
      } catch (err: any) {
        if (err.message && err.message.includes("CONFIRMATION_REQUIRED")) {
          console.log("[Email Authentication Flow Diagnostics] SignUp succeeded, confirmation email dispatched. Session not yet available.");
          throw err;
        }
        console.error("[Email Authentication Flow Diagnostics] Supabase Auth signup failed:", err);
        throw err;
      }
    } else {
      // Real Firebase Auth Integration for client-side deployments (Netlify, etc.)
      try {
        console.log("Attempting real registration via Firebase Auth...");
        const fbUser = await firebaseSignUp(normalizedEmail, password, name);
        
        // Also seed into local simulated users array so they show up in operational dashboards
        const newSimUser = {
          id: fbUser.uid,
          email: normalizedEmail,
          password: password,
          name,
          role,
          employeeId: "EMP-" + Math.floor(10000 + Math.random() * 90000).toString(),
          team: "Tier 1 Support Team A",
          lob: "Customer Experience",
          status: "active" as const,
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
        };
        
        const users = getSimulatedUsers();
        if (!users.some(u => u.email.toLowerCase() === normalizedEmail)) {
          users.push(newSimUser);
          localStorage.setItem("precisionqa_simulated_users", JSON.stringify(users));
        }

        user = {
          id: fbUser.uid,
          email: normalizedEmail,
          name,
          role,
          status: "active",
          createdAt: new Date().toISOString(),
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
        };

        const expiresAt = rememberMe 
          ? Date.now() + 30 * 24 * 60 * 60 * 1000 
          : Date.now() + 12 * 60 * 60 * 1000;

        this.saveSession({
          user,
          token: "firebase-jwt-token-" + fbUser.uid.substring(0, 8),
          expiresAt,
          rememberMe
        });
      } catch (fbErr: any) {
        console.warn("Firebase Auth signup failed. Falling back to local simulation in development only...", fbErr);
        
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1') || window.location.hostname.includes('run.app');
        if (isLocal) {
          user = await this.executeSimulatedSignUp(normalizedEmail, name, role, rememberMe, password);
        } else {
          // If we're on a deployed netlify url, we should throw the real signup error!
          throw new Error(fbErr.message || fbErr || "Registration failed. Please make sure your password is at least 6 characters long.");
        }
      }
    }

    // Sync to database
    try {
      await this.syncProfile(user);
    } catch (syncErr) {
      console.warn("Database profile sync failed after signup:", syncErr);
    }

    return user;
  },

  // Sync profile to database
  async syncProfile(user: User): Promise<User> {
    try {
      // 1. Send sync signal to backend
      const response = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          fullName: user.name,
          role: user.role
        })
      });

      if (!response.ok) {
        console.warn("Failed to sync profile with server.");
      }

      // 2. Fetch latest profile from database to get latest role (could be changed by admin)
      const profileRes = await fetch(`/api/auth/me/${user.id}`);
      if (profileRes.ok) {
        const latestProfile = await profileRes.json();
        
        // Update local session with latest profile data
        const session = this.getSession();
        if (session.user && session.user.id === user.id) {
          const updatedUser = { 
            ...session.user, 
            name: latestProfile.name || session.user.name,
            role: latestProfile.role as UserRole || session.user.role,
            avatarUrl: latestProfile.avatarUrl || session.user.avatarUrl
          };
          this.saveSession({ ...session, user: updatedUser });
          return updatedUser;
        }
      }
    } catch (err) {
      console.error("syncProfile failed:", err);
    }
    return user;
  },

  // Google SSO login
  async signInWithGoogle(rememberMe: boolean = false): Promise<User> {
    // Try Firebase Google Sign-In first as it is pre-configured with client-applet credentials
    try {
      console.log("Attempting Google Sign-In via Firebase Auth...");
      const fbResult = await firebaseGoogleSignIn();
      if (fbResult && fbResult.user) {
        const { user: fbUser } = fbResult;
        const email = fbUser.email || "sso-employee@precisionqa.com";
        const name = fbUser.displayName || email.split("@")[0];
        
        // Match with pre-seeded demo users if possible for full database access compatibility
        const users = getSimulatedUsers();
        const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        const user: User = {
          id: matched?.id || fbUser.uid,
          email: email,
          name: name,
          role: matched?.role || UserRole.AGENT,
          employeeId: matched?.employeeId || "EMP-" + fbUser.uid.substring(0, 5).toUpperCase(),
          team: matched?.team || "Tier 1 Support Team A",
          lob: matched?.lob || "Customer Experience",
          status: matched?.status || "active",
          lastLogin: new Date().toISOString(),
          createdAt: matched?.createdAt || fbUser.metadata.creationTime || new Date().toISOString(),
          avatarUrl: fbUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
        };

        const expiresAt = rememberMe 
          ? Date.now() + 30 * 24 * 60 * 60 * 1000 
          : Date.now() + 12 * 60 * 60 * 1000;

        this.saveSession({
          user,
          token: fbResult.accessToken || "firebase-sso-token",
          expiresAt,
          rememberMe
        });

        console.log("Firebase Google Auth success. Logged in as:", user.name);
        return user;
      }
    } catch (fbErr: any) {
      console.warn("Firebase Google Auth failed or canceled:", fbErr);
      
      const errorCode = fbErr.code || "";
      let helperMessage = "";
      
      if (errorCode === "auth/unauthorized-domain") {
        helperMessage = " This domain is not authorized in Firebase. Please add your Netlify domain (e.g. 'xxx.netlify.app') to the 'Authorized Domains' list under 'Authentication > Settings' in the Firebase Auth Console.";
      } else if (errorCode === "auth/popup-closed-by-user") {
        helperMessage = " The login popup was closed before completing the sign-in. Please try again.";
      } else if (errorCode === "auth/cancelled-popup-request") {
        helperMessage = " Multiple popup login operations were triggered simultaneously.";
      }

      throw new Error(`Google Sign-In failed: ${fbErr.message || fbErr}.${helperMessage}`);
    }

    // Try Supabase OAuth as secondary if configured
    if (isRealSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin
          }
        });
        if (error) {
          throw new Error(error.message);
        }
        return {
          id: "google-sso-placeholder",
          email: "sso-employee@precisionqa.com",
          name: "Google Authenticated User",
          role: UserRole.AGENT,
          status: "active",
          createdAt: new Date().toISOString()
        };
      } catch (err: any) {
        throw new Error(`Supabase OAuth Sign-In failed: ${err.message || err}`);
      }
    } else {
      // In development or local environments, we can fallback to simulated SSO if they are not using Firebase
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1') || window.location.hostname.includes('run.app');
      if (isLocal) {
        console.warn("Falling back to local simulated SSO as Firebase/Supabase was not successfully initialized.");
        return this.executeSimulatedGoogleSignIn(rememberMe);
      } else {
        throw new Error("Google Sign-In is not configured. Please complete your Firebase or Supabase OAuth setup.");
      }
    }
  },

  // Helper method to execute simulated Google SSO with default accounts
  async executeSimulatedGoogleSignIn(rememberMe: boolean): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 600));
    const users = getSimulatedUsers();
    // Defaults to Alex Rivera (Super Admin) for seamless demonstration access
    const matched = users.find(u => u.email === "superadmin@precisionqa.com") || users[0];
    const user: User = {
      id: matched.id,
      email: matched.email,
      name: matched.name,
      role: matched.role,
      employeeId: matched.employeeId,
      team: matched.team,
      lob: matched.lob,
      status: matched.status || "active",
      lastLogin: new Date().toISOString(),
      createdAt: matched.createdAt || new Date().toISOString(),
      avatarUrl: matched.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(matched.name)}`
    };

    const expiresAt = rememberMe 
      ? Date.now() + 30 * 24 * 60 * 60 * 1000 
      : Date.now() + 12 * 60 * 60 * 1000;

    this.saveSession({
      user,
      token: "google-sso-sim-token-" + Math.random().toString(36).substring(2),
      expiresAt,
      rememberMe
    });

    return user;
  },

  // Update user profile details
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    if (isRealSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          name: updates.name,
          employeeId: updates.employeeId,
          team: updates.team,
          lob: updates.lob,
          avatarUrl: updates.avatarUrl
        }
      });
      if (error) {
        throw new Error(error.message);
      }
      const session = this.getSession();
      const activeUser = session.user;
      if (activeUser && activeUser.id === userId) {
        const updatedUser = { ...activeUser, ...updates };
        this.saveSession({ ...session, user: updatedUser });
        return updatedUser;
      }
      return {
        id: userId,
        email: updates.email || "",
        name: updates.name || "",
        role: updates.role || UserRole.AGENT,
        status: updates.status || "active",
        createdAt: new Date().toISOString(),
        ...updates
      };
    } else {
      await new Promise(resolve => setTimeout(resolve, 500));
      const users = getSimulatedUsers();
      const idx = users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates } as any;
        localStorage.setItem("precisionqa_simulated_users", JSON.stringify(users));
      }
      const session = this.getSession();
      const activeUser = session.user;
      if (activeUser && activeUser.id === userId) {
        const updatedUser = { ...activeUser, ...updates };
        this.saveSession({ ...session, user: updatedUser });
        return updatedUser;
      }
      return {
        id: userId,
        email: updates.email || users[idx]?.email || "",
        name: updates.name || users[idx]?.name || "",
        role: updates.role || (users[idx]?.role as UserRole) || UserRole.AGENT,
        status: updates.status || users[idx]?.status || "active",
        createdAt: users[idx]?.createdAt || new Date().toISOString(),
        ...updates
      };
    }
  },

  // Securely change password from profile
  async changePassword(userId: string, currentPass: string, newPass: string): Promise<boolean> {
    if (isRealSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({
        password: newPass
      });
      if (error) {
        throw new Error(error.message);
      }
      return true;
    } else {
      await new Promise(resolve => setTimeout(resolve, 600));
      const users = getSimulatedUsers();
      const idx = users.findIndex(u => u.id === userId);
      if (idx === -1) {
        throw new Error("User record not found in local environment.");
      }
      if (users[idx].password !== currentPass) {
        throw new Error("The current password you provided is incorrect.");
      }
      users[idx].password = newPass;
      localStorage.setItem("precisionqa_simulated_users", JSON.stringify(users));
      return true;
    }
  },

  // List all users for administrator management
  async getAllUsers(): Promise<User[]> {
    if (isRealSupabaseConfigured && supabase) {
      // In live Supabase, admins query profile tables or auth API
      // We will read from simulated as a fallback or mock db syncing
      const users = getSimulatedUsers();
      return users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        employeeId: u.employeeId,
        team: u.team,
        lob: u.lob,
        status: u.status,
        lastLogin: u.lastLogin,
        createdAt: new Date().toISOString(),
        avatarUrl: u.avatarUrl
      }));
    } else {
      await new Promise(resolve => setTimeout(resolve, 400));
      const users = getSimulatedUsers();
      return users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        employeeId: u.employeeId,
        team: u.team,
        lob: u.lob,
        status: u.status,
        lastLogin: u.lastLogin,
        createdAt: new Date().toISOString(),
        avatarUrl: u.avatarUrl
      }));
    }
  },

  // Admin: Create user record
  async adminCreateUser(userData: Omit<User, "id" | "createdAt"> & { password?: string }): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 600));
    const users = getSimulatedUsers();
    if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
      throw new Error("This email is already registered in the platform registry.");
    }
    const newSimUser = {
      id: "sim-user-" + Math.random().toString(36).substring(2),
      email: userData.email,
      password: userData.password || "user123",
      name: userData.name,
      role: userData.role,
      employeeId: userData.employeeId || "EMP-" + Math.floor(100 + Math.random() * 900),
      team: userData.team || "Unassigned",
      lob: userData.lob || "General Operations",
      status: userData.status || "active",
      lastLogin: new Date().toISOString(),
      avatarUrl: userData.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.name)}`
    };
    users.push(newSimUser);
    localStorage.setItem("precisionqa_simulated_users", JSON.stringify(users));
    return {
      id: newSimUser.id,
      email: newSimUser.email,
      name: newSimUser.name,
      role: newSimUser.role,
      employeeId: newSimUser.employeeId,
      team: newSimUser.team,
      lob: newSimUser.lob,
      status: newSimUser.status,
      lastLogin: newSimUser.lastLogin,
      createdAt: new Date().toISOString(),
      avatarUrl: newSimUser.avatarUrl
    };
  },

  // Admin: Update user record
  async adminUpdateUser(userId: string, updates: Partial<User>): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getSimulatedUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) {
      throw new Error("User record not found.");
    }
    users[idx] = { ...users[idx], ...updates } as any;
    localStorage.setItem("precisionqa_simulated_users", JSON.stringify(users));

    // If the updated user is the currently logged in user, sync their session immediately
    const session = this.getSession();
    if (session.user && session.user.id === userId) {
      const updatedUser = { ...session.user, ...updates };
      this.saveSession({ ...session, user: updatedUser });
    }

    return {
      id: userId,
      email: users[idx].email,
      name: users[idx].name,
      role: users[idx].role as UserRole,
      employeeId: users[idx].employeeId,
      team: users[idx].team,
      lob: users[idx].lob,
      status: users[idx].status,
      lastLogin: users[idx].lastLogin,
      createdAt: new Date().toISOString(),
      avatarUrl: users[idx].avatarUrl
    };
  },

  // Admin: Delete user record
  async adminDeleteUser(userId: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getSimulatedUsers();
    const filtered = users.filter(u => u.id !== userId);
    if (filtered.length === users.length) {
      throw new Error("User record not found.");
    }
    localStorage.setItem("precisionqa_simulated_users", JSON.stringify(filtered));
    return true;
  },

  // Forgot password flow
  async forgotPassword(email: string): Promise<string> {
    const normalizedEmail = email.toLowerCase().trim();

    if (isRealSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: window.location.origin
      });

      if (error) {
        console.error("[Email Authentication Flow Diagnostics] Supabase resetPasswordForEmail failed:", {
          message: error.message,
          status: error.status,
          email: normalizedEmail,
          hint: "This usually points to SMTP server connection failures, unverified senders, or Supabase default email limits (3 emails per hour) being exceeded. Verify settings at 'Auth -> SMTP' in your Supabase Dashboard."
        });
        throw new Error(`Supabase reset password request failed: ${error.message}. Please check your SMTP configuration in the Supabase Dashboard.`);
      }

      return "A live password reset email has been dispatched by Supabase Auth service. Check your inbox to proceed.";
    } else {
      await new Promise(resolve => setTimeout(resolve, 800));

      const users = getSimulatedUsers();
      const matched = users.some(u => u.email.toLowerCase() === normalizedEmail);

      if (!matched) {
        throw new Error("No account associated with the specified email address was found.");
      }

      return "Simulated password reset email sent. Click the verification badge below to define your new password immediately.";
    }
  },

  // Reset/update password
  async resetPassword(email: string, newPass: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    if (isRealSupabaseConfigured && supabase) {
      // In live Supabase, updating password is done when logged in via reset token
      const { error } = await supabase.auth.updateUser({
        password: newPass
      });

      if (error) {
        console.error("[Email Authentication Flow Diagnostics] Supabase updateUser password reset failed:", {
          message: error.message,
          status: error.status,
          hint: "Ensure the user has clicked on the recovery link, which authenticates them with a temporary session enabling password changes."
        });
        throw new Error(`Supabase password change failed: ${error.message}. Ensure your recovery session is active.`);
      }

      return true;
    } else {
      await new Promise(resolve => setTimeout(resolve, 800));

      const users = getSimulatedUsers();
      const uIdx = users.findIndex(u => u.email.toLowerCase() === normalizedEmail);

      if (uIdx === -1) {
        throw new Error("Account resolution error.");
      }

      users[uIdx].password = newPass;
      localStorage.setItem("precisionqa_simulated_users", JSON.stringify(users));
      return true;
    }
  },

  // Log out
  async logout(): Promise<void> {
    if (isRealSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    this.clearSession();
  }
};

export function getFriendlyErrorMessage(err: any, fallback: string): string {
  if (!err) return fallback;
  
  let msg = "";
  if (typeof err === "string") {
    msg = err;
  } else if (err.message) {
    msg = err.message;
  } else {
    try {
      msg = JSON.stringify(err);
    } catch (e) {
      msg = String(err);
    }
  }

  // If the error message is literally "{}" or empty, return the fallback
  if (!msg || msg === "{}" || msg.trim() === "") {
    return fallback;
  }

  // If it's a JSON string, try to parse and extract a message
  if (msg.startsWith("{") && msg.endsWith("}")) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.message) return parsed.message;
      if (parsed.error_description) return parsed.error_description;
      if (parsed.error) {
        if (typeof parsed.error === "string") return parsed.error;
        if (parsed.error.message) return parsed.error.message;
      }
    } catch (e) {
      // Ignore parse failure, keep original msg
    }
  }

  return msg;
}
