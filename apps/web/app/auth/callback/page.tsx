"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState("Confirming your email…");

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setMsg("Supabase not configured");
      return;
    }
    (async () => {
      const nextParam = params.get("next") || "/onboarding";
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type"); // signup | email | recovery | ...
      const errorDesc = params.get("error_description") || params.get("error");

      if (errorDesc) {
        setMsg(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
        setTimeout(() => router.replace("/login"), 2500);
        return;
      }

      if (tokenHash && type) {
        setMsg("Verifying confirmation link…");
        const { error } = await sb.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change",
        });
        if (error) {
          setMsg(error.message);
          setTimeout(() => router.replace("/signup"), 2500);
          return;
        }
      } else if (code) {
        setMsg("Sealing your session…");
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg(error.message);
          setTimeout(() => router.replace("/login"), 2500);
          return;
        }
      } else {
        // Hash-based links / already confirmed session
        const { data } = await sb.auth.getSession();
        if (!data.session) {
          // Give detectSessionInUrl a beat for hash fragments
          await new Promise((r) => setTimeout(r, 400));
          const again = await sb.auth.getSession();
          if (!again.data.session) {
            setMsg("No session — open the confirmation link from your email again.");
            setTimeout(() => router.replace("/login"), 2200);
            return;
          }
        }
      }

      setMsg("Email confirmed — entering the storm…");
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      let next = nextParam;
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
          /* keep next */
        }
      }
      router.replace(next.startsWith("/") ? next : "/onboarding");
    })();
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="text-center max-w-md">
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
