"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getApiBase } from "@/lib/api";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isAdminEmail } from "@reelstorm/domain";

function AccountInner() {
  const { user, token, loading, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  useEffect(() => {
    if (!token) return;
    fetch(`${getApiBase()}/api/billing/wallet`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) return;
        const j = await r.json();
        setBalance(j.rtcBalance ?? j.wallet?.balanceRtc ?? null);
      })
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/account");
  }, [loading, user, router]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`${getApiBase()}/api/auth/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      await refreshProfile();
      setMsg("Profile saved.");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (pw.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabaseBrowser();
      if (!sb) throw new Error("Auth not configured");
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw("");
      setPw2("");
      setMsg("Password updated.");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await signOut();
    router.push("/login");
  }

  if (loading || !user) {
    return <div className="mono text-sm text-white/40 p-8">Loading account…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto forge-in space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">ACCOUNT</div>
          <h1 className="display text-4xl">Settings</h1>
          <p className="mt-2 text-white/50 text-sm">Profile, billing, password, and sign out.</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="h-10 px-4 rounded-rs border border-orange/40 text-orange text-sm font-semibold hover:bg-orange/10"
        >
          Log out
        </button>
      </div>

      <section className="rounded-rs-xl border border-white/[0.08] bg-panel/80 p-5 space-y-3">
        <div className="mono text-[10px] text-orange">PROFILE</div>
        <form onSubmit={(e) => void saveProfile(e)} className="space-y-3">
          <div>
            <label className="mono text-[9px] text-white/40">EMAIL</label>
            <div className="mt-1 h-11 flex items-center rounded-rs bg-void border border-white/10 px-4 text-sm text-white/70">
              {user.email}
            </div>
          </div>
          <div>
            <label className="mono text-[9px] text-white/40">DISPLAY NAME</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full h-11 rounded-rs bg-void border border-white/10 px-4 text-sm focus:outline-none focus:border-cyan/40"
              placeholder="Your name"
            />
          </div>
          <div className="flex flex-wrap gap-3 text-[12px] text-white/50">
            <span className="mono text-cyan uppercase">{user.tier}</span>
            {balance != null && <span>{balance} RTC</span>}
            {isAdminEmail(user.email) && (
              <Link href="/admin" className="text-orange hover:underline">
                Captain Admin →
              </Link>
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="h-10 px-5 rounded-rs bg-cyan text-black font-bold text-sm disabled:opacity-40"
          >
            Save profile
          </button>
        </form>
      </section>

      <section className="rounded-rs-xl border border-white/[0.08] bg-deep p-5 space-y-3">
        <div className="mono text-[10px] text-orange">BILLING & WALLET</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Link
            href="/billing"
            className="rounded-rs border border-white/10 p-4 hover:border-cyan/40 transition-colors"
          >
            <div className="font-semibold text-sm">Billing</div>
            <div className="text-[11px] text-white/45 mt-1">Plans, System Bank, free demo</div>
          </Link>
          <Link
            href="/wallet"
            className="rounded-rs border border-white/10 p-4 hover:border-cyan/40 transition-colors"
          >
            <div className="font-semibold text-sm">RTC Wallet</div>
            <div className="text-[11px] text-white/45 mt-1">
              Balance{balance != null ? `: ${balance} RTC` : ""} · top-up · vouchers
            </div>
          </Link>
          <Link
            href="/pricing"
            className="rounded-rs border border-white/10 p-4 hover:border-cyan/40 transition-colors sm:col-span-2"
          >
            <div className="font-semibold text-sm">Upgrade plan</div>
            <div className="text-[11px] text-white/45 mt-1">Storm · Storm Pro · Premium</div>
          </Link>
        </div>
      </section>

      <section
        id="password"
        className="rounded-rs-xl border border-white/[0.08] bg-panel/80 p-5 space-y-3 scroll-mt-24"
      >
        <div className="mono text-[10px] text-orange">CHANGE PASSWORD</div>
        <p className="text-[12px] text-white/45">
          For email/password accounts. Google sign-in users manage security in their Google account.
        </p>
        <form onSubmit={(e) => void changePassword(e)} className="space-y-3">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            placeholder="New password (min 8)"
            className="w-full h-11 rounded-rs bg-void border border-white/10 px-4 text-sm focus:outline-none focus:border-cyan/40"
          />
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
            placeholder="Confirm new password"
            className="w-full h-11 rounded-rs bg-void border border-white/10 px-4 text-sm focus:outline-none focus:border-cyan/40"
          />
          <button
            type="submit"
            disabled={busy || !pw}
            className="h-10 px-5 rounded-rs bg-violet text-white font-bold text-sm disabled:opacity-40"
          >
            Update password
          </button>
        </form>
      </section>

      {(msg || err) && (
        <div className={err ? "text-sm text-orange" : "text-sm text-cyan"}>{err || msg}</div>
      )}
    </div>
  );
}

export default function AccountPage() {
  return (
    <AuthProvider>
      <AccountInner />
    </AuthProvider>
  );
}
