"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { API_URL } from "@/lib/api";

type TierRow = {
  id: string;
  name: string;
  price: string;
  monthlyRtc: number;
  archive5Blocks: number;
  features: string[];
  visaAlias: string;
};

export default function PricingPage() {
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [rtcPer, setRtcPer] = useState(100);

  useEffect(() => {
    fetch(`${API_URL}/api/billing/tiers`)
      .then((r) => r.json())
      .then((d: { tiers: TierRow[]; rtcPerArchive5: number }) => {
        setTiers(d.tiers || []);
        setRtcPer(d.rtcPerArchive5 || 100);
      })
      .catch(() => {
        // fallback static (VisaVideos-aligned)
        setTiers([
          {
            id: "free",
            name: "Studio",
            price: "Free",
            monthlyRtc: 300,
            archive5Blocks: 3,
            visaAlias: "Free",
            features: ["3 × ARCHIVE5 / mo", "URL extract", "Ollama local"],
          },
          {
            id: "storm",
            name: "Storm",
            price: "£39/mo",
            monthlyRtc: 1500,
            archive5Blocks: 15,
            visaAlias: "Journey",
            features: ["15 × 5-min blocks", "Veo/Kling/Seedance", "Voice Forge"],
          },
          {
            id: "storm_pro",
            name: "Storm Pro",
            price: "£89/mo",
            monthlyRtc: 4000,
            archive5Blocks: 40,
            visaAlias: "Journey Pro",
            features: ["40 × 5-min blocks", "White-label starter", "10 seats"],
          },
          {
            id: "network",
            name: "Network",
            price: "Custom",
            monthlyRtc: 20000,
            archive5Blocks: 200,
            visaAlias: "Enterprise",
            features: ["Multi-tenant Academy", "RTC resale", "SLA farm"],
          },
        ]);
      });
  }, []);

  const accent: Record<string, string> = {
    free: "#00D9FF",
    storm: "#7C3AED",
    storm_pro: "#FF7A00",
    network: "#C4B5FD",
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />

      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-10">
        <div className="mx-auto max-w-[800px] text-center">
          <div className="mono text-[11px] text-violet-soft mb-3">RTC · REELSTORM CURRENCY</div>
          <h1 className="display text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.9]">
            Buy time in
            <br />
            <span className="bg-empire bg-clip-text text-transparent">5-minute blocks.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[15px] max-w-[520px] mx-auto leading-relaxed">
            Tier system adopted from VisaVideos (
            <span className="text-white/80">Free · Journey £39 · Journey Pro £89</span>
            ). Every ARCHIVE5 section costs <span className="text-cyan font-semibold">{rtcPer} RTC</span>.
          </p>
        </div>
      </section>

      {/* RTC unit explainer */}
      <section className="px-5 md:px-8 pb-12">
        <div className="mx-auto max-w-[1100px] grid sm:grid-cols-3 gap-px bg-white/[0.06] rounded-rs-xl overflow-hidden border border-white/[0.06]">
          {[
            { k: "1 ARCHIVE5", v: `${rtcPer} RTC` },
            { k: "DURATION", v: "5 MIN" },
            { k: "INVESTMENT", v: "RTC → BLOCKS" },
          ].map((m) => (
            <div key={m.k} className="bg-[#0A0A0A] px-5 py-5 text-center">
              <div className="mono text-[9px] text-white/35">{m.k}</div>
              <div className="display text-[22px] mt-2">{m.v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 md:px-8 py-8 md:py-12">
        <div className="mx-auto max-w-[1200px] grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((t) => {
            const featured = t.id === "storm_pro";
            const c = accent[t.id] || "#7C3AED";
            return (
              <div
                key={t.id}
                className="rounded-rs-xl border p-6 flex flex-col"
                style={{
                  borderColor: featured ? c : "rgba(255,255,255,0.08)",
                  background: featured ? `${c}14` : "#0A0A0A",
                }}
              >
                <div className="mono text-[9px] text-white/40">≈ {t.visaAlias}</div>
                <div className="mono text-[10px] mt-1" style={{ color: c }}>
                  {t.name.toUpperCase()}
                </div>
                <div className="display text-[36px] mt-2">{t.price}</div>
                <div className="mt-2 text-[13px] text-white/60">
                  <span className="text-white font-semibold">{t.monthlyRtc.toLocaleString()} RTC</span>
                  {" · "}
                  {t.archive5Blocks} × 5-min
                </div>
                <ul className="mt-6 space-y-2 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="text-[12px] text-white/65 flex gap-2">
                      <span style={{ color: c }}>●</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={
                    t.id === "network"
                      ? "/white-label"
                      : t.id === "free"
                        ? "/signup"
                        : `/login?next=${encodeURIComponent(`/wallet?upgrade=${t.id}`)}`
                  }
                  className="mt-8 h-11 inline-flex items-center justify-center rounded-rs font-bold text-[13px]"
                  style={{
                    background: featured ? c : "transparent",
                    color: featured ? "#000" : "#fff",
                    border: featured ? "none" : "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {t.id === "network" ? "Talk Network" : t.id === "free" ? "Start free" : "Choose plan"}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mx-auto max-w-[1200px] mt-6 mono text-[9px] text-white/30">
          Pricing structure mirrors VisaVideos Journey / Journey Pro. Provider usage (DashScope, Veo, Kling)
          is billed via your API keys; RTC meters factory ARCHIVE5 output.
        </p>
      </section>
    </div>
  );
}
