"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";

function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resendConfirmation, loading } =
    useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/onboarding";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [resent, setResent] = useState(false);

  async function onGoogle() {
    setBusy(true);
    setErr("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setResent(false);
    if (mode === "login") {
      const res = await signInWithEmail(email, password);
      if (res.error) {
        setErr(res.error);
        setBusy(false);
        return;
      }
      router.replace(next);
      return;
    }

    const res = await signUpWithEmail(email, password, name);
    if (res.error) {
      setErr(res.error);
      setBusy(false);
      return;
    }
    if (res.needsConfirmation) {
      setAwaitingConfirm(true);
      setBusy(false);
      return;
    }
    router.replace(next);
  }

  async function onResend() {
    if (!email.trim()) {
      setErr("Enter your email above first.");
      return;
    }
    setBusy(true);
    setErr("");
    const res = await resendConfirmation(email.trim());
    setBusy(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    setResent(true);
    setAwaitingConfirm(true);
  }

  if (awaitingConfirm && mode === "signup") {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(0,217,255,0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 90%, rgba(255,122,0,0.16), transparent 50%)",
          }}
        />
        <div className="relative w-full max-w-[440px] text-center">
          <div className="mono text-[10px] text-cyan tracking-[0.2em] mb-3">CHECK YOUR INBOX</div>
          <h1 className="display text-4xl leading-none mb-3">
            Confirm
            <br />
            <span className="text-orange">your email.</span>
          </h1>
          <p className="text-white/60 text-[15px] leading-relaxed mb-2">
            We sent a confirmation link to
          </p>
          <p className="text-white font-semibold text-[15px] mb-6 break-all">{email}</p>
          <p className="text-white/45 text-[13px] leading-relaxed mb-8">
            Open the email → tap <span className="text-cyan">Confirm email</span> → you’ll land back
            in the factory. Check spam if it’s missing.
          </p>
          {resent && (
            <div className="mb-4 text-[13px] text-cyan">Confirmation email resent.</div>
          )}
          {err && <div className="mb-4 text-[12px] text-orange">{err}</div>}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              disabled={busy}
              onClick={onResend}
              className="h-12 px-6 rounded-rs border border-white/15 text-sm font-semibold disabled:opacity-50"
            >
              Resend confirmation
            </button>
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="h-12 px-6 inline-flex items-center justify-center rounded-rs bg-orange text-black font-bold text-sm"
            >
              I confirmed — sign in
            </Link>
          </div>
          <button
            type="button"
            onClick={() => {
              setAwaitingConfirm(false);
              setBusy(false);
            }}
            className="mt-8 text-[12px] text-white/35 hover:text-white/60"
          >
            ← Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(124,58,237,0.35), transparent 60%), radial-gradient(ellipse 50% 40% at 100% 80%, rgba(255,122,0,0.18), transparent 50%), radial-gradient(ellipse 40% 30% at 0% 70%, rgba(0,217,255,0.12), transparent 50%)",
        }}
      />
      <div className="relative w-full max-w-[420px]">
        <div className="mono text-[10px] text-cyan tracking-[0.2em] mb-3">
          APP.REELSTORM.UK · {mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
        </div>
        <h1 className="display text-4xl leading-none mb-2">
          {mode === "login" ? "Enter the" : "Join the"}
          <br />
          <span className="text-orange">storm.</span>
        </h1>
        <p className="text-white/55 text-[14px] mb-8">
          {mode === "signup"
            ? "Create with Gmail or email — we’ll send a confirmation link before you enter."
            : "Gmail one-tap or email — then a 60-second onboarding into the factory."}
        </p>

        <button
          type="button"
          disabled={busy || loading}
          onClick={onGoogle}
          className="w-full h-12 rounded-rs bg-white text-black font-bold text-[14px] flex items-center justify-center gap-3 hover:bg-white/90 transition disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.3C9.7 39.7 16.3 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.2 5.2C40.2 36.3 44 31.5 44 24c0-1.3-.1-2.5-.4-3.5z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-white/30 text-[11px] mono">
          <div className="h-px flex-1 bg-white/10" />
          OR EMAIL
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          />
          {err && <div className="text-[12px] text-orange">{err}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-12 rounded-rs bg-orange text-black font-bold text-[14px] disabled:opacity-50"
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            disabled={busy}
            onClick={onResend}
            className="mt-4 w-full text-[12px] text-white/40 hover:text-cyan"
          >
            Resend confirmation email
          </button>
        )}

        <p className="mt-6 text-[13px] text-white/45 text-center">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link
                href={`/signup?next=${encodeURIComponent(next)}`}
                className="text-cyan hover:underline"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="text-cyan hover:underline"
              >
                Sign in
              </Link>
            </>
          )}
        </p>
        <p className="mt-4 text-center text-[11px] text-white/30">
          <a href="https://reelstorm.uk" className="hover:text-white/50">
            ← Marketing site
          </a>
        </p>
      </div>
    </div>
  );
}

function Gate({ mode }: { mode: "login" | "signup" }) {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="min-h-screen" />}>
        <AuthForm mode={mode} />
      </Suspense>
    </AuthProvider>
  );
}

export function LoginPageClient() {
  return <Gate mode="login" />;
}

export function SignupPageClient() {
  return <Gate mode="signup" />;
}
