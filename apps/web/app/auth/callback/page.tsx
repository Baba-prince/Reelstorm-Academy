"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState("Sealing your session…");

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setMsg("Supabase not configured");
      return;
    }
    (async () => {
      const code = params.get("code");
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg(error.message);
          return;
        }
      } else {
        const { data } = await sb.auth.getSession();
        if (!data.session) {
          setMsg("No session — try signing in again.");
          setTimeout(() => router.replace("/login"), 1500);
          return;
        }
      }
      // Ask API whether onboarding is done
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      let next = "/onboarding";
      if (token) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/auth/me`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (res.ok) {
            const j = (await res.json()) as { user?: { onboardingCompleted?: boolean } };
            if (j.user?.onboardingCompleted) next = "/dashboard";
          }
        } catch {
          /* onboarding */
        }
      }
      router.replace(next);
    })();
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="display text-3xl mb-3">REELSTORM</div>
        <div className="mono text-[12px] text-cyan animate-pulse">{msg}</div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CallbackInner />
    </Suspense>
  );
}
