"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { API_URL } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";

function WalletInner() {
  const { token, user, loading } = useAuth();
  const params = useSearchParams();
  const [data, setData] = useState<{
    user: { email: string; tier: string };
    wallet: { balanceRtc: number; archive5Remaining: number; rtcPerArchive5: number };
  } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const q = !token ? "?email=producer@reelstorm.academy" : "";
    const res = await fetch(`${API_URL}/api/billing/wallet${q}`, { headers });
    if (res.ok) setData(await res.json());
  }, [token]);

  useEffect(() => {
    if (!loading) load().catch(() => setData(null));
  }, [loading, load]);

  useEffect(() => {
    if (params.get("upgraded")) setMsg("Upgrade successful — tier syncing from Stripe.");
    if (params.get("cancelled")) setMsg("Checkout cancelled.");
    const upgrade = params.get("upgrade");
    if (upgrade === "storm" || upgrade === "storm_pro") {
      // auto-prompt after login redirect
    }
  }, [params]);

  async function checkout(tier: "storm" | "storm_pro") {
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/wallet?upgrade=${tier}`)}`;
      return;
    }
    setBusy(true);
    setMsg("Opening Stripe Checkout…");
    try {
      const res = await fetch(`${API_URL}/api/billing/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tier }),
      });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error || "Checkout failed");
      window.location.href = j.url;
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  useEffect(() => {
    const upgrade = params.get("upgrade");
    if (!loading && token && (upgrade === "storm" || upgrade === "storm_pro")) {
      void checkout(upgrade);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, token]);

  return (
    <div className="max-w-[720px] space-y-6 forge-in">
      <div>
        <div className="mono text-[11px] text-cyan mb-2">RTC WALLET</div>
        <h1 className="display text-4xl">Reelstorm Currency</h1>
        <p className="mt-2 text-white/55 text-sm">
          100 RTC = one 5-min ARCHIVE5 block. Stripe tiers sync from VisaVideos Journey (£39) /
          Journey Pro (£89).
        </p>
      </div>

      {msg && <div className="text-[13px] text-orange">{msg}</div>}

      {data && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-rs border border-white/[0.08] bg-panel p-4">
            <div className="mono text-[9px] text-white/40">BALANCE</div>
            <div className="display text-3xl mt-2 text-cyan">{data.wallet.balanceRtc}</div>
            <div className="text-xs text-white/40 mt-1">RTC</div>
          </div>
          <div className="rounded-rs border border-white/[0.08] bg-panel p-4">
            <div className="mono text-[9px] text-white/40">ARCHIVE5 LEFT</div>
            <div className="display text-3xl mt-2 text-orange">{data.wallet.archive5Remaining}</div>
            <div className="text-xs text-white/40 mt-1">× 5-min blocks</div>
          </div>
          <div className="rounded-rs border border-white/[0.08] bg-panel p-4">
            <div className="mono text-[9px] text-white/40">TIER</div>
            <div className="display text-2xl mt-2">{data.user.tier}</div>
            <div className="text-xs text-white/40 mt-1">{user?.email || data.user.email}</div>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => checkout("storm")}
          className="h-12 rounded-rs bg-violet text-white font-bold text-sm disabled:opacity-50"
        >
          Upgrade Storm · £39/mo
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => checkout("storm_pro")}
          className="h-12 rounded-rs bg-orange text-black font-bold text-sm disabled:opacity-50"
        >
          Upgrade Storm Pro · £89/mo
        </button>
      </div>

      <div className="flex gap-2">
        <Link
          href="/pricing"
          className="h-11 px-5 inline-flex items-center rounded-rs border border-white/15 text-sm"
        >
          Compare tiers
        </Link>
        <Link
          href="/onboarding"
          className="h-11 px-5 inline-flex items-center rounded-rs border border-white/15 text-sm"
        >
          Replay onboarding
        </Link>
      </div>
    </div>
  );
}

export default function WalletPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="mono text-cyan text-sm">Loading wallet…</div>}>
        <WalletInner />
      </Suspense>
    </AuthProvider>
  );
}
