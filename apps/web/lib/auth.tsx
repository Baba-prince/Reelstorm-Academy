"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User as SbUser } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { getApiBase } from "@/lib/api";

export type RsUser = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  tier: string;
  onboardingCompleted?: boolean;
};

type AuthCtx = {
  session: Session | null;
  sbUser: SbUser | null;
  user: RsUser | null;
  loading: boolean;
  token: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  resendConfirmation: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);
const TOKEN_KEY = "rs_access_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<RsUser | null>(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = useCallback(async (accessToken: string | null) => {
    if (!accessToken) {
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    localStorage.setItem(TOKEN_KEY, accessToken);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = (await res.json()) as { user: RsUser };
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      syncProfile(data.session?.access_token || null).finally(() => setLoading(false));
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void syncProfile(next?.access_token || null);
    });
    return () => sub.subscription.unsubscribe();
  }, [syncProfile]);

  const signInWithGoogle = useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) throw new Error("Supabase not configured");
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { access_type: "offline", prompt: "consent" } },
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const sb = getSupabaseBrowser();
    if (!sb) return { error: "Supabase not configured" };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        return {
          error:
            "Email not confirmed yet. Open the link we sent, or resend confirmation from Sign up.",
        };
      }
      return { error: error.message };
    }
    return {};
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, name?: string) => {
    const sb = getSupabaseBrowser();
    if (!sb) return { error: "Supabase not configured" };
    const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name || email.split("@")[0] },
        emailRedirectTo: redirectTo,
      },
    });
    if (error) return { error: error.message };
    // Supabase returns a user with empty identities when email already registered (anti-enumeration)
    const identities = data.user?.identities;
    if (data.user && Array.isArray(identities) && identities.length === 0) {
      return {
        error: "This email may already be registered. Sign in, or use Resend confirmation.",
      };
    }
    // No session ⇒ confirmation email required
    if (!data.session) {
      return { needsConfirmation: true };
    }
    return {};
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const sb = getSupabaseBrowser();
    if (!sb) return { error: "Supabase not configured" };
    const { error } = await sb.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    return { error: error?.message };
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabaseBrowser();
    await sb?.auth.signOut();
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      sbUser: session?.user || null,
      user,
      loading,
      token:
        session?.access_token ||
        (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null),
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resendConfirmation,
      signOut,
      refreshProfile: () => syncProfile(session?.access_token || localStorage.getItem(TOKEN_KEY)),
    }),
    [
      session,
      user,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      resendConfirmation,
      signOut,
      syncProfile,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
