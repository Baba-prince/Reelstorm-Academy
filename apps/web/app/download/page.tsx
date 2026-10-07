"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { getApiBase } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";

type Plan = {
  id: string;
  name: string;
  priceUsd: number;
  monthlyLimit: number;
  devicesAllowed: number;
  blurb: string;
};

function DownloadInner() {
  const { token } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${getApiBase()}/api/studio/plans`)
      .then((r) => r.json())
      .then((j) => setPlans(j.plans || []))
      .catch(() => undefined);
  }, []);

  async function checkout(plan: string) {
    setErr(null);
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent("/download")}`;
      return;
    }
    setBusy(plan);
    try {
      const res = await fetch(`${getApiBase()}/api/studio/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      if (j.url) window.location.href = j.url;
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function issueFree() {
    setErr(null);
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent("/download")}`;
      return;
    }
    setBusy("free");
    try {
      const res = await fetch(`${getApiBase()}/api/license/issue-free`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      sessionStorage.setItem("studio_plaintext_key", j.plaintextKey || "");
      window.location.href = "/settings/studio?issued=1";
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />
      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-20">
        <div className="mx-auto max-w-[960px]">
          <div className="mono text-[11px] text-cyan mb-3">REELSTORM STUDIO · 120MB THIN · SAVER ENGINE</div>
          <h1 className="display text-[clamp(2.4rem,7vw,4.5rem)] leading-[0.92]">
            120MB app.
            <br />
            <span className="text-white/40">4.2GB stays on saver.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[16px] max-w-[540px] leading-relaxed">
            Thin desktop (or 0MB web) talks to VPS license control; SkyReels runs on RunPod RTX 4090.
            Hardware-locked seats, hourly heartbeat, Stripe cancel → block. No video API key.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="https://github.com/Beeplus7/Reelstorm-Academy/releases"
              className="h-12 px-6 inline-flex items-center rounded-rs bg-orange text-black font-bold"
            >
              Download Studio (~120MB)
            </a>
            <Link
              href="/generate"
              className="h-12 px-6 inline-flex items-center rounded-rs border border-cyan/40 text-cyan font-medium"
            >
              Generate in browser (0MB)
            </Link>
            <Link
              href="/settings/studio"
              className="h-12 px-6 inline-flex items-center rounded-rs border border-white/20 font-medium"
            >
              License & devices
            </Link>
          </div>

          {err && <p className="mt-4 text-orange text-sm">{err}</p>}

          <div className="mt-16 grid md:grid-cols-2 gap-4">
            {plans
              .filter((p) => p.id !== "free")
              .map((p) => (
                <div key={p.id} className="border border-white/10 rounded-rs-xl p-5 bg-white/[0.02]">
                  <div className="display text-[24px]">{p.name}</div>
                  <div className="text-orange font-bold mt-1">${p.priceUsd}/mo</div>
                  <p className="text-white/50 text-sm mt-2">{p.blurb}</p>
                  <p className="mono text-[11px] text-white/35 mt-3">
                    {p.monthlyLimit} mins · {p.devicesAllowed} device(s) · $0 GPU COGS
                  </p>
                  <button
                    type="button"
                    disabled={busy === p.id}
                    onClick={() => void checkout(p.id)}
                    className="mt-4 h-11 px-4 rounded-rs bg-violet text-white text-sm font-bold disabled:opacity-50"
                  >
                    {busy === p.id ? "Redirecting…" : "Subscribe"}
                  </button>
                </div>
              ))}
          </div>

          <button
            type="button"
            onClick={() => void issueFree()}
            className="mt-8 text-sm text-cyan hover:underline"
          >
            {busy === "free" ? "Issuing…" : "Get free 5-min Studio license (test)"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <AuthProvider>
      <DownloadInner />
    </AuthProvider>
  );
}
