"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getApiBase } from "@/lib/api";

type SystemBank = {
  total: number;
  remaining: number;
  used: number;
  sets: number;
  rtcPerSet: number;
  costBasis: number;
  costSunkUsd: number;
  revenueAt799: number;
  revenueAt1299: number;
  funnelHint: string;
};

function BillingInner() {
  const { token, loading } = useAuth();
  const [bank, setBank] = useState<SystemBank | null>(null);
  const [wallet, setWallet] = useState<{
    rtcBalance: number;
    freeDemo?: { granted: boolean; used: boolean };
  } | null>(null);

  const load = useCallback(async () => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const [bRes, wRes] = await Promise.all([
      fetch(`${getApiBase()}/api/billing/system-bank`),
      fetch(`${getApiBase()}/api/billing/wallet`, { headers }),
    ]);
    if (bRes.ok) {
      const j = await bRes.json();
      setBank(j.systemBank);
    }
    if (wRes.ok) {
      const j = await wRes.json();
      setWallet({
        rtcBalance: j.rtcBalance ?? j.wallet?.balanceRtc ?? 0,
        freeDemo: j.freeDemo,
      });
    }
  }, [token]);

  useEffect(() => {
    if (!loading) void load();
  }, [loading, load]);

  return (
    <div className="max-w-3xl space-y-6 forge-in">
      <div>
        <div className="mono text-[11px] text-cyan mb-2">BILLING · SYSTEM BANK</div>
        <h1 className="display text-4xl">Free demo funnel</h1>
        <p className="mt-2 text-white/55 text-sm">
          Every user gets 1 RTC (1 min) by default from the System Bank — the hook into Premium.
        </p>
      </div>

      {wallet && (
        <div className="rounded-rs border border-cyan/30 bg-cyan/10 p-4">
          <div className="mono text-[9px] text-cyan">YOUR WALLET</div>
          <div className="display text-3xl mt-1">{wallet.rtcBalance} RTC</div>
          <div className="text-xs text-white/50 mt-1">
            Free demo: {wallet.freeDemo?.granted ? (wallet.freeDemo.used ? "used" : "ready") : "pending grant"}
          </div>
        </div>
      )}

      {bank && (
        <section className="rounded-rs-xl border border-white/[0.08] bg-panel p-5 space-y-4">
          <div className="mono text-[11px] text-orange">SYSTEM BANK</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="mono text-[9px] text-white/40">TOTAL</div>
              <div className="display text-2xl">{bank.total} RTC</div>
            </div>
            <div>
              <div className="mono text-[9px] text-white/40">REMAINING</div>
              <div className="display text-2xl text-cyan">{bank.remaining} RTC</div>
            </div>
            <div>
              <div className="mono text-[9px] text-white/40">USED</div>
              <div className="display text-2xl text-orange">{bank.used} RTC</div>
            </div>
            <div>
              <div className="mono text-[9px] text-white/40">SETS</div>
              <div className="display text-2xl">
                {bank.sets} × {bank.rtcPerSet} RTC
              </div>
            </div>
          </div>
          <div className="text-sm text-white/60 space-y-1 border-t border-white/[0.06] pt-4">
            <p>
              Cost basis: ${bank.costBasis}/RTC ={" "}
              <span className="text-white">${bank.costSunkUsd.toLocaleString()}</span> total sunk
            </p>
            <p>
              Revenue potential: ${bank.revenueAt799.toLocaleString()} at $7.99/RTC · $
              {bank.revenueAt1299.toLocaleString()} at $12.99/RTC
            </p>
            <p className="text-cyan/80">{bank.funnelHint}</p>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/wallet" className="h-11 px-5 inline-flex items-center rounded-rs bg-violet text-white text-sm font-bold">
          Open RTC Wallet
        </Link>
        <Link href="/pricing" className="h-11 px-5 inline-flex items-center rounded-rs border border-white/15 text-sm">
          Compare tiers
        </Link>
        <Link href="/wizard" className="h-11 px-5 inline-flex items-center rounded-rs border border-white/15 text-sm">
          Use free demo in Wizard
        </Link>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <AuthProvider>
      <BillingInner />
    </AuthProvider>
  );
}
