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
  monthlySets?: number;
  archive5Blocks: number;
  maxResolution?: string;
  features: string[];
  alias?: string;
  featured?: boolean;
};

type RtcPack = { id: string; rtc: number; priceUsd: number; label: string };

const FALLBACK_TIERS: TierRow[] = [
  {
    id: "free",
    name: "Free Test",
    price: "$0",
    monthlyRtc: 1,
    monthlySets: 0,
    archive5Blocks: 0,
    maxResolution: "480p",
    alias: "Hook",
    features: [
      "1 RTC demo · SystemBank",
      "YT-OS skills · Clone analyze",
      "Pixabay intros $0 · watermark · 24h",
    ],
  },
  {
    id: "storm",
    name: "Basic",
    price: "$49/mo",
    monthlyRtc: 15,
    monthlySets: 3,
    archive5Blocks: 3,
    maxResolution: "720p",
    alias: "Ad shops",
    features: ["3 sets × 5-min", "720p only", "3 templates · Archive 30d"],
  },
  {
    id: "storm_pro",
    name: "Premium",
    price: "$99/mo",
    monthlyRtc: 25,
    monthlySets: 5,
    archive5Blocks: 5,
    maxResolution: "1080p",
    alias: "YouTubers",
    featured: true,
    features: ["5 sets × 5-min", "1080p unlocked", "Voice clone · Merge · 1 seat"],
  },
  {
    id: "premium_pro",
    name: "Premium Pro",
    price: "$199/mo",
    monthlyRtc: 50,
    monthlySets: 10,
    archive5Blocks: 10,
    maxResolution: "1080p",
    alias: "Artists · Ads",
    features: ["10 sets × 5-min", "Video Upload DNA", "3 seats · RTC rollover"],
  },
  {
    id: "network",
    name: "Network",
    price: "Custom",
    monthlyRtc: 200,
    monthlySets: 40,
    archive5Blocks: 40,
    maxResolution: "1080p",
    alias: "Academies",
    features: ["Multi-tenant white-label", "RTC resale", "SLA farm"],
  },
];

const FALLBACK_PACKS: RtcPack[] = [
  { id: "pack_10", rtc: 10, priceUsd: 69, label: "10 RTC · 2 sets" },
  { id: "pack_25", rtc: 25, priceUsd: 149, label: "25 RTC · 5 sets" },
  { id: "pack_50", rtc: 50, priceUsd: 269, label: "50 RTC · 10 sets" },
];

export default function PricingPage() {
  const [tiers, setTiers] = useState<TierRow[]>(FALLBACK_TIERS);
  const [packs, setPacks] = useState<RtcPack[]>(FALLBACK_PACKS);
  const [unit, setUnit] = useState("1 RTC = 1 minute of final master (720p) · 1 set = 5 RTC");

  useEffect(() => {
    fetch(`${API_URL}/api/billing/tiers`)
      .then((r) => r.json())
      .then(
        (d: {
          tiers: TierRow[];
          packs?: RtcPack[];
          unit?: string;
          rtcPerArchive5?: number;
        }) => {
          if (d.tiers?.length) setTiers(d.tiers);
          if (d.packs?.length) setPacks(d.packs);
          if (d.unit) setUnit(d.unit);
        },
      )
      .catch(() => {
        /* keep fallbacks */
      });
  }, []);

  const accent: Record<string, string> = {
    free: "#00D9FF",
    storm: "#7C3AED",
    storm_pro: "#FF7A00",
    premium_pro: "#F472B6",
    network: "#C4B5FD",
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />

      <section className="relative px-5 md:px-8 pt-16 md:pt-24 pb-12 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.35), transparent), radial-gradient(ellipse 60% 40% at 90% 20%, rgba(255,122,0,0.18), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-[820px] text-center">
          <div className="mono text-[11px] text-orange mb-3">RTC · SELL SETS · METER MINUTES</div>
          <h1 className="display text-[clamp(2.6rem,8vw,5rem)] leading-[0.9]">
            REELSTORM
            <br />
            <span className="text-white/35">tiers that print.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[15px] max-w-[540px] mx-auto leading-relaxed">
            YouTubers buy finished sets — not confusing credits.{" "}
            <span className="text-white/85">{unit}</span>
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 pb-12">
        <div className="mx-auto max-w-[1100px] grid sm:grid-cols-3 gap-px bg-white/[0.06] rounded-rs-xl overflow-hidden border border-white/[0.06]">
          {[
            { k: "1 RTC", v: "1 MIN MASTER" },
            { k: "1 SET", v: "5 RTC · 5 MIN" },
            { k: "NEXT SQUEEZE", v: "−5 RTC" },
          ].map((m) => (
            <div key={m.k} className="bg-[#0A0A0A] px-5 py-5 text-center">
              <div className="mono text-[9px] text-white/35">{m.k}</div>
              <div className="display text-[20px] md:text-[22px] mt-2">{m.v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 md:px-8 py-4 md:py-8">
        <div className="mx-auto max-w-[1280px] grid md:grid-cols-2 xl:grid-cols-5 gap-4">
          {tiers.map((t) => {
            const featured = Boolean(t.featured) || t.id === "storm_pro";
            const c = accent[t.id] || "#7C3AED";
            const sets = t.monthlySets ?? t.archive5Blocks;
            return (
              <div
                key={t.id}
                className="rounded-rs-xl border p-5 md:p-6 flex flex-col"
                style={{
                  borderColor: featured ? c : "rgba(255,255,255,0.08)",
                  background: featured ? `${c}14` : "#0A0A0A",
                }}
              >
                {featured && (
                  <div className="mono text-[9px] text-orange mb-1 tracking-[0.14em]">HERO · YOUTUBERS</div>
                )}
                <div className="mono text-[9px] text-white/40">{t.alias || "—"}</div>
                <div className="mono text-[10px] mt-1" style={{ color: c }}>
                  {t.name.toUpperCase()}
                </div>
                <div className="display text-[32px] md:text-[36px] mt-2 leading-none">{t.price}</div>
                <div className="mt-3 text-[12px] text-white/60 leading-snug">
                  {t.id === "free" ? (
                    <>
                      <span className="text-white font-semibold">{t.monthlyRtc} RTC</span>
                      {" · "}
                      {t.maxResolution || "480p"} test
                    </>
                  ) : (
                    <>
                      <span className="text-white font-semibold">{sets} sets</span>
                      {" · "}
                      {t.monthlyRtc} RTC
                      {t.maxResolution ? ` · ${t.maxResolution}` : ""}
                    </>
                  )}
                </div>
                <ul className="mt-5 space-y-2 flex-1">
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
                  className="mt-7 h-11 inline-flex items-center justify-center rounded-rs font-bold text-[13px]"
                  style={{
                    background: featured ? c : "transparent",
                    color: featured ? "#000" : "#fff",
                    border: featured ? "none" : "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {t.id === "network"
                    ? "Talk Network"
                    : t.id === "free"
                      ? "Start free test"
                      : `Choose ${t.name}`}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="px-5 md:px-8 py-14 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1100px]">
          <div className="mono text-[11px] text-cyan mb-2">OVERAGE · VIRAL MONTHS</div>
          <h2 className="display text-[clamp(1.8rem,4vw,2.8rem)] leading-none">
            RTC packs when 5 sets aren’t enough.
          </h2>
          <p className="mt-3 text-white/50 text-[14px] max-w-[520px]">
            YouTuber goes viral mid-month — buy minutes, not a whole new plan. Packs beat $7.99/RTC singles.
          </p>
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            {packs.map((p) => (
              <div
                key={p.id}
                className="rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] p-5 flex flex-col"
              >
                <div className="mono text-[9px] text-white/40">{p.id.toUpperCase()}</div>
                <div className="display text-[28px] mt-2">{p.label.split("·")[0]?.trim()}</div>
                <div className="text-[13px] text-white/50 mt-1">{p.label}</div>
                <div className="display text-[24px] text-orange mt-4">${p.priceUsd}</div>
                <Link
                  href={`/login?next=${encodeURIComponent("/wallet?pack=" + p.id)}`}
                  className="mt-5 h-10 inline-flex items-center justify-center rounded-rs border border-white/15 text-[12px] font-semibold"
                >
                  Buy pack
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8 py-14 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[900px] grid md:grid-cols-2 gap-8 items-start">
          <div>
            <div className="mono text-[11px] text-violet-soft mb-2">COST CONTROL</div>
            <h2 className="display text-[28px] md:text-[34px] leading-none">
              Clip length is the lever.
            </h2>
            <p className="mt-4 text-white/55 text-[14px] leading-relaxed">
              BOT Director Step 4 — Cost Saver (5s clips) vs Cinematic (10s). Halve clips, halve Seedance
              spend. Preview before the factory starts:{" "}
              <span className="text-white/80">28 clips × $0.30 ≈ $8.40 ≈ 4 RTC</span>.
            </p>
          </div>
          <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-5 space-y-3">
            <div className="flex justify-between text-[13px]">
              <span className="text-white/45">Basic locked</span>
              <span className="font-semibold text-cyan">720p only</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-white/45">Premium unlocks</span>
              <span className="font-semibold text-orange">1080p</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-white/45">Free FOMO</span>
              <span className="font-semibold">No download</span>
            </div>
            <div className="h-px bg-white/[0.06] my-2" />
            <p className="mono text-[10px] text-white/35 leading-relaxed">
              Factory cost ~$2.20/RTC @ 720p. Sell RTC inside plans — when Seedance drops 30%, keep
              prices, margin jumps.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8 py-12 border-t border-white/[0.06] text-center">
        <Link
          href="/wallet"
          className="inline-flex h-12 px-8 items-center rounded-rs bg-orange text-black font-bold text-[14px]"
        >
          Open RTC Wallet
        </Link>
        <p className="mt-4 mono text-[9px] text-white/30">
          LIVE ENGINE shows −5 RTC on each squeeze. Earn 2 RTC when you share a template to Templates
          Room.
        </p>
      </section>
    </div>
  );
}
