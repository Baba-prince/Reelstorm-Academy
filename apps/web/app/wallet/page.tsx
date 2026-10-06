"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getApiBase } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";

type PaidTier = "storm" | "storm_pro" | "premium_pro";

const TIER_CTA: Record<PaidTier, { label: string; className: string }> = {
  storm: {
    label: "Basic · $49/mo · 3 sets · 720p",
    className: "bg-violet text-white",
  },
  storm_pro: {
    label: "Premium · $99/mo · 5 sets · 1080p",
    className: "bg-orange text-black",
  },
  premium_pro: {
    label: "Premium Pro · $199/mo · 10 sets",
    className: "bg-white text-black",
  },
};

function WalletInner() {
  const { token, user, loading } = useAuth();
  const params = useSearchParams();
  const [data, setData] = useState<{
    user: { email: string; tier: string };
    wallet: {
      balanceRtc: number;
      archive5Remaining: number;
      rtcPerArchive5: number;
    };
  } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");

  const load = useCallback(async () => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const q = !token ? "?email=producer@reelstorm.academy" : "";
    const res = await fetch(`${getApiBase()}/api/billing/wallet${q}`, { headers });
    if (res.ok) setData(await res.json());
  }, [token]);

  useEffect(() => {
    if (!loading) load().catch(() => setData(null));
  }, [loading, load]);

  useEffect(() => {
    if (params.get("upgraded")) setMsg("Upgrade successful — tier syncing from Stripe.");
    if (params.get("cancelled")) setMsg("Checkout cancelled.");
    if (params.get("pack")) setMsg(`Pack ${params.get("pack")} — top-ups ship next; use a plan for now.`);
  }, [params]);

  async function checkout(tier: PaidTier) {
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/wallet?upgrade=${tier}`)}`;
      return;
    }
    setBusy(true);
    setMsg("Opening Stripe Checkout…");
    try {
      const res = await fetch(`${getApiBase()}/api/billing/checkout`, {
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
    if (
      !loading &&
      token &&
      (upgrade === "storm" || upgrade === "storm_pro" || upgrade === "premium_pro")
    ) {
      void checkout(upgrade);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, token]);

  const balance = data?.wallet.balanceRtc ?? 0;
  const setsLeft = data?.wallet.archive5Remaining ?? 0;
  const nextSqueeze = data?.wallet.rtcPerArchive5 ?? 5;

  return (
    <div className="max-w-[760px] space-y-6 forge-in">
      <div>
        <div className="mono text-[11px] text-cyan mb-2">RTC WALLET · LIVE ENGINE</div>
        <h1 className="display text-4xl">Reelstorm Currency</h1>
        <p className="mt-2 text-white/55 text-sm max-w-xl">
          1 RTC = 1 minute of finished master. One 5-min set = {nextSqueeze} RTC. Balance depletes on
          each squeeze — arcade psychology, real margin.
        </p>
      </div>

      {msg && <div className="text-[13px] text-orange">{msg}</div>}

      {data && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-rs border border-cyan/30 bg-cyan/10 p-4">
            <div className="mono text-[9px] text-cyan">BALANCE</div>
            <div className="display text-3xl mt-2 text-cyan">{balance}</div>
            <div className="text-xs text-white/45 mt-1">RTC · {balance} min left</div>
          </div>
          <div className="rounded-rs border border-orange/30 bg-orange/10 p-4">
            <div className="mono text-[9px] text-orange">SETS LEFT</div>
            <div className="display text-3xl mt-2 text-orange">{setsLeft}</div>
            <div className="text-xs text-white/45 mt-1">× 5-min ARCHIVE5</div>
          </div>
          <div className="rounded-rs border border-white/[0.08] bg-panel p-4">
            <div className="mono text-[9px] text-white/40">TIER</div>
            <div className="display text-2xl mt-2 capitalize">{data.user.tier.replace("_", " ")}</div>
            <div className="text-xs text-white/40 mt-1">{user?.email || data.user.email}</div>
          </div>
        </div>
      )}

      <div className="rounded-rs-xl border border-white/[0.08] bg-panel px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="mono text-[9px] text-white/40">NEXT SQUEEZE</div>
          <div className="text-sm text-white/70 mt-1">
            One finished set debits{" "}
            <span className="text-orange font-bold">−{nextSqueeze} RTC</span> in LIVE ENGINE.
          </div>
        </div>
        <div className="mono text-[18px] text-orange font-bold">−{nextSqueeze} RTC</div>
      </div>

      <form
        className="rounded-rs border border-white/[0.08] bg-panel p-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!token) {
            window.location.href = `/login?next=${encodeURIComponent("/wallet")}`;
            return;
          }
          const code = voucherCode.trim().toUpperCase();
          if (!code) return;
          setBusy(true);
          setMsg("Redeeming voucher…");
          try {
            const res = await fetch(`${getApiBase()}/api/billing/redeem-voucher`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ code }),
            });
            const j = (await res.json()) as { error?: string; grantedRtc?: number; balanceRtc?: number };
            if (!res.ok) throw new Error(j.error || "Redeem failed");
            setMsg(`Voucher redeemed — +${j.grantedRtc} RTC (balance ${j.balanceRtc})`);
            setVoucherCode("");
            await load();
          } catch (ex) {
            setMsg((ex as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="mono text-[9px] text-white/40">GIFT VOUCHER</div>
        <div className="flex gap-2">
          <input
            className="flex-1 h-10 px-3 rounded-rs bg-void border border-white/10 text-sm mono"
            placeholder="RS-XXXX-XXXX"
            value={voucherCode}
            onChange={(e) => setVoucherCode(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !voucherCode.trim()}
            className="h-10 px-4 rounded-rs bg-cyan text-black text-sm font-bold disabled:opacity-50"
          >
            Redeem
          </button>
        </div>
      </form>

      <div className="space-y-2">
        <div className="mono text-[9px] text-white/40">UPGRADE · SELL SETS</div>
        <div className="grid gap-2">
          {(Object.keys(TIER_CTA) as PaidTier[]).map((tier) => (
            <button
              key={tier}
              type="button"
              disabled={busy}
              onClick={() => checkout(tier)}
              className={`h-12 rounded-rs font-bold text-sm disabled:opacity-50 ${TIER_CTA[tier].className}`}
            >
              {TIER_CTA[tier].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/pricing"
          className="h-11 px-5 inline-flex items-center rounded-rs border border-white/15 text-sm"
        >
          Compare tiers + packs
        </Link>
        <Link
          href="/wizard"
          className="h-11 px-5 inline-flex items-center rounded-rs border border-white/15 text-sm"
        >
          Cost preview in Wizard
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
