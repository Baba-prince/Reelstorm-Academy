"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { API_URL, getApiBase } from "@/lib/api";
import { STUDIO_PLANS } from "@reelstorm/domain";

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
      "1 RTC cloud demo · SystemBank",
      "YT-OS · Clone analyze",
      "Pixabay intros $0 · watermark",
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
    features: ["5 sets × 5-min", "1080p unlocked", "Voice · Merge · 1 seat"],
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
    features: ["10 sets × 5-min", "DNA upload", "3 seats · RTC rollover"],
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

const STUDIO_LIST = Object.values(STUDIO_PLANS);

export default function PricingPage() {
  const [tiers, setTiers] = useState<TierRow[]>(FALLBACK_TIERS);
  const [packs, setPacks] = useState<RtcPack[]>(FALLBACK_PACKS);
  const [unit, setUnit] = useState("1 RTC = 1 minute of final master · 1 set = 5 RTC");
  const [lane, setLane] = useState<"cloud" | "studio">("cloud");

  useEffect(() => {
    fetch(`${API_URL}/api/billing/tiers`)
      .then((r) => r.json())
      .then(
        (d: {
          tiers: TierRow[];
          packs?: RtcPack[];
          unit?: string;
        }) => {
          if (d.tiers?.length) setTiers(d.tiers);
          if (d.packs?.length) setPacks(d.packs);
          if (d.unit) setUnit(d.unit);
        },
      )
      .catch(() => undefined);

    fetch(`${getApiBase()}/api/studio/plans`)
      .then((r) => r.json())
      .catch(() => undefined);
  }, []);

  const accent: Record<string, string> = {
    free: "#00D9FF",
    storm: "#7C3AED",
    storm_pro: "#FF7A00",
    premium_pro: "#F472B6",
    network: "#C4B5FD",
  };

  const studioAccent: Record<string, string> = {
    free: "#00D9FF",
    starter: "#7C3AED",
    pro: "#FF7A00",
    agency: "#F472B6",
    unlimited: "#C4B5FD",
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />

      <section className="relative px-5 md:px-8 pt-16 md:pt-24 pb-10 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,217,255,0.22), transparent), radial-gradient(ellipse 60% 40% at 90% 20%, rgba(255,122,0,0.18), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-[880px] text-center">
          <div className="mono text-[11px] text-orange mb-3">TWO LANES · ONE FACTORY</div>
          <h1 className="display text-[clamp(2.6rem,8vw,5rem)] leading-[0.9]">
            Cloud RTC
            <br />
            <span className="text-white/35">or Studio on your GPU.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[15px] max-w-[560px] mx-auto leading-relaxed">
            Cloud meters finished masters in RTC. Studio meters minutes on <em>your</em> RTX — we keep
            MRR and seat control. <span className="text-white/85">{unit}</span>
          </p>

          <div className="mt-8 inline-flex p-1 rounded-rs border border-white/15 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setLane("cloud")}
              className={`h-11 px-5 rounded-[10px] text-sm font-semibold transition ${
                lane === "cloud" ? "bg-orange text-black" : "text-white/60 hover:text-white"
              }`}
            >
              Cloud OS
            </button>
            <button
              type="button"
              onClick={() => setLane("studio")}
              className={`h-11 px-5 rounded-[10px] text-sm font-semibold transition ${
                lane === "studio" ? "bg-cyan text-black" : "text-white/60 hover:text-white"
              }`}
            >
              Studio desktop
            </button>
          </div>
        </div>
      </section>

      {lane === "cloud" ? (
        <>
          <section className="px-5 md:px-8 pb-10">
            <div className="mx-auto max-w-[1100px] grid sm:grid-cols-3 gap-px bg-white/[0.06] rounded-rs-xl overflow-hidden border border-white/[0.06]">
              {[
                { k: "1 RTC", v: "1 MIN MASTER" },
                { k: "1 SET", v: "5 RTC · 5 MIN" },
                { k: "PIXABAY", v: "INTROS $0" },
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
                RTC packs when sets run out.
              </h2>
              <div className="mt-8 grid sm:grid-cols-3 gap-4">
                {packs.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] p-5 flex flex-col"
                  >
                    <div className="display text-[28px] mt-1">{p.label.split("·")[0]?.trim()}</div>
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
        </>
      ) : (
        <section className="px-5 md:px-8 py-4 md:py-8 pb-16">
          <div className="mx-auto max-w-[1100px] mb-8">
            <div className="mono text-[11px] text-cyan mb-2">YOUR GPU · CENTRAL MINUTES</div>
            <h2 className="display text-[clamp(1.8rem,4vw,2.8rem)] leading-none max-w-[640px]">
              Unlimited feel. Metered seats. $0 GPU COGS to us.
            </h2>
            <p className="mt-4 text-white/50 text-[14px] max-w-[520px]">
              Hardware-locked license · heartbeat · cancel Stripe and the desktop app stops generating.
            </p>
          </div>
          <div className="mx-auto max-w-[1280px] grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {STUDIO_LIST.map((p) => {
              const featured = p.id === "pro";
              const c = studioAccent[p.id] || "#00D9FF";
              return (
                <div
                  key={p.id}
                  className="rounded-rs-xl border p-5 flex flex-col"
                  style={{
                    borderColor: featured ? c : "rgba(255,255,255,0.08)",
                    background: featured ? `${c}14` : "#0A0A0A",
                  }}
                >
                  {featured && (
                    <div className="mono text-[9px] mb-1 tracking-[0.14em]" style={{ color: c }}>
                      TUBESTARTER
                    </div>
                  )}
                  <div className="mono text-[10px]" style={{ color: c }}>
                    {p.name.toUpperCase()}
                  </div>
                  <div className="display text-[32px] mt-2 leading-none">
                    {p.priceUsd === 0 ? "$0" : `$${p.priceUsd}`}
                    {p.priceUsd > 0 && <span className="text-[14px] text-white/40 font-sans">/mo</span>}
                  </div>
                  <div className="mt-3 text-[12px] text-white/60">
                    <span className="text-white font-semibold">{p.monthlyLimit} mins</span>
                    {" · "}
                    {p.devicesAllowed} device{p.devicesAllowed > 1 ? "s" : ""}
                  </div>
                  <p className="mt-4 text-[12px] text-white/50 flex-1 leading-relaxed">{p.blurb}</p>
                  <Link
                    href={p.id === "free" ? "/download" : "/download"}
                    className="mt-6 h-11 inline-flex items-center justify-center rounded-rs font-bold text-[13px]"
                    style={{
                      background: featured ? c : "transparent",
                      color: featured ? "#000" : "#fff",
                      border: featured ? "none" : "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    {p.priceUsd === 0 ? "Get free key" : "Subscribe"}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mx-auto max-w-[1100px] mt-8 mono text-[10px] text-white/30">
            Overage $0.10/min · weights download on first launch · see /settings/studio for devices
          </p>
        </section>
      )}

      <section className="px-5 md:px-8 py-12 border-t border-white/[0.06] text-center">
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/wallet"
            className="inline-flex h-12 px-8 items-center rounded-rs bg-orange text-black font-bold text-[14px]"
          >
            Open RTC Wallet
          </Link>
          <Link
            href="/download"
            className="inline-flex h-12 px-8 items-center rounded-rs border border-cyan/40 text-cyan font-bold text-[14px]"
          >
            Download Studio
          </Link>
        </div>
      </section>
    </div>
  );
}
