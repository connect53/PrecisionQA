import { supabase } from "./authService"; // Import supabase client from authService
import { User } from "../types";

// Cache for access token
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem("google_oauth_access_token") : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Listen for Supabase auth state changes
  return supabase?.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
      const user: User = {
        id: session.user.id,
        email: session.user.email || "",
        name: session.user.user_metadata.full_name || "",
        role: "agent" as any, // Default, will be updated
        status: "active",
        createdAt: session.user.created_at,
        avatarUrl: session.user.user_metadata.avatar_url
      };
      const token = session.access_token;
      cachedAccessToken = token;
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!supabase) throw new Error("Supabase is not configured.");
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: 'https://precisionqa.netlify.app'
    }
  });
  
  if (error) throw error;
  
  // Note: This function will likely not return because of the redirect.
  return null;
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && supabase) {
    const { data } = await supabase.auth.getSession();
    cachedAccessToken = data.session?.access_token || null;
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await supabase?.auth.signOut();
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem("google_oauth_access_token");
  }
};

