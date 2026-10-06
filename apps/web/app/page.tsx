"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { HeroVisual } from "@/components/marketing/HeroVisual";
import { PipelineInfographic } from "@/components/marketing/PipelineInfographic";
import { useT } from "@/lib/i18n/I18nProvider";

export default function LandingPage() {
  const t = useT();

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* HERO — brand, headline, sentence, CTAs, full-bleed visual */}
      <section className="relative min-h-[100svh] flex flex-col">
        <HeroVisual />
        <MarketingNav />

        <div className="relative z-10 flex-1 flex flex-col justify-end pb-16 md:pb-24 px-5 md:px-8">
          <div className="mx-auto w-full max-w-[1280px]">
            <div className="hero-copy max-w-[920px]">
              <h1 className="display text-[clamp(3.2rem,12vw,8.5rem)] leading-[0.88] tracking-[-0.05em]">
                REELSTORM
              </h1>
              <p className="mt-5 md:mt-6 text-[clamp(1.05rem,2.4vw,1.45rem)] text-white/70 max-w-[34rem] leading-relaxed font-light">
                {t("marketing.heroLine")}
              </p>
              <p className="mt-3 text-[12px] text-cyan/80 max-w-[34rem]">{t("marketing.targetMarkets")}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/yt-os"
                  className="h-12 md:h-14 px-7 inline-flex items-center rounded-rs bg-orange text-black font-bold text-[14px] md:text-[15px] hover:brightness-110 transition"
                >
                  {t("marketing.ctaForge")}
                </Link>
                <Link
                  href="/tools/clone"
                  className="h-12 md:h-14 px-7 inline-flex items-center rounded-rs border border-white/20 text-white font-medium text-[14px] md:text-[15px] hover:bg-white/[0.05] transition"
                >
                  {t("marketing.ctaClone")}
                </Link>
                <Link
                  href="/training"
                  className="h-12 md:h-14 px-7 inline-flex items-center rounded-rs border border-white/20 text-white font-medium text-[14px] md:text-[15px] hover:bg-white/[0.05] transition"
                >
                  {t("marketing.ctaTraining")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-[560px] mb-12 md:mb-16">
            <div className="mono text-[11px] text-cyan mb-3">{t("marketing.pipelineEyebrow")}</div>
            <h2 className="display text-[clamp(2rem,5vw,3.5rem)] leading-[0.95]">
              {t("marketing.pipelineTitle")}
              <br />
              <span className="text-white/40">{t("marketing.pipelineTitleMuted")}</span>
            </h2>
            <p className="mt-4 text-white/55 text-[15px] leading-relaxed">{t("marketing.pipelineBody")}</p>
          </div>
          <PipelineInfographic />
        </div>
      </section>

      {/* YT-OS */}
      <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00D9FF]/12 via-transparent to-[#7C3AED]/10" />
        <div className="relative mx-auto max-w-[1280px] grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="mono text-[11px] text-cyan mb-3">{t("marketing.ytosEyebrow")}</div>
            <h2 className="display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.95]">
              {t("marketing.ytosTitle")}
              <br />
              <span className="text-white/40">{t("marketing.ytosTitleMuted")}</span>
            </h2>
            <p className="mt-4 text-white/55 text-[15px] leading-relaxed max-w-[420px]">
              {t("marketing.ytosBody")}
            </p>
            <Link
              href="/yt-os"
              className="mt-8 inline-flex h-12 px-6 items-center rounded-rs bg-cyan text-black font-bold text-[14px]"
            >
              {t("marketing.ytosCta")}
            </Link>
          </div>
          <div className="relative aspect-[4/3] rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
            <svg viewBox="0 0 480 360" className="w-full h-full" aria-hidden>
              <rect width="480" height="360" fill="#0A0A0A" />
              <text x="32" y="40" fill="#00D9FF" fontSize="11" fontFamily="monospace" letterSpacing="2">
                /rs-* · 11 SKILLS
              </text>
              {[
                { y: 70, label: "/rs-viral", w: 200 },
                { y: 108, label: "/rs-hooks · 21", w: 240 },
                { y: 146, label: "/rs-titles · thumbs", w: 280 },
                { y: 184, label: "/rs-edit · voice", w: 220 },
                { y: 222, label: "/rs-calendar · 30d", w: 260 },
                { y: 260, label: "/rs-publish", w: 180 },
              ].map((row, i) => (
                <g key={row.label}>
                  <rect
                    x="32"
                    y={row.y}
                    width={row.w}
                    height="28"
                    rx="6"
                    fill={i % 2 ? "#151515" : "#12121a"}
                    stroke={i < 2 ? "#00D9FF" : "rgba(255,255,255,0.1)"}
                  />
                  <text x="48" y={row.y + 18} fill="rgba(255,255,255,0.75)" fontSize="12" fontFamily="monospace">
                    {row.label}
                  </text>
                </g>
              ))}
              <text x="32" y="330" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="monospace">
                RTC WALLET · NOT AN EXTERNAL BOT
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* Viral Clone Factory */}
      <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF7A00]/12 via-transparent to-[#7C3AED]/10" />
        <div className="relative mx-auto max-w-[1280px] grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="order-2 lg:order-1 relative aspect-[4/3] rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
            <svg viewBox="0 0 480 360" className="w-full h-full" aria-hidden>
              <rect width="480" height="360" fill="#0A0A0A" />
              <text x="32" y="48" fill="#FF7A00" fontSize="11" fontFamily="monospace" letterSpacing="2">
                LINK → DNA → TRANSFORMATIVE REMAKE
              </text>
              <rect x="40" y="90" width="100" height="56" rx="12" fill="#151515" stroke="#FF7A00" />
              <text x="90" y="124" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">
                PASTE URL
              </text>
              <path d="M150 118 H200" stroke="#FF7A00" strokeWidth="2" />
              <rect x="200" y="90" width="100" height="56" rx="12" fill="#151515" stroke="#7C3AED" />
              <text x="250" y="124" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">
                ANALYZE
              </text>
              <path d="M310 118 H360" stroke="#7C3AED" strokeWidth="2" />
              <rect x="360" y="90" width="80" height="56" rx="12" fill="#FF7A00" />
              <text x="400" y="124" textAnchor="middle" fill="#000" fontSize="11" fontWeight="800">
                1 RTC
              </text>
              <rect x="40" y="200" width="400" height="100" rx="12" fill="#12121a" stroke="rgba(255,255,255,0.1)" />
              <text x="60" y="240" fill="rgba(255,255,255,0.7)" fontSize="13" fontWeight="600">
                Reproduce · kids · gaming · A24
              </text>
              <text x="60" y="268" fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="monospace">
                PIXABAY B-ROLL + SEEDANCE + VOICE · 5 RTC
              </text>
            </svg>
          </div>
          <div className="order-1 lg:order-2">
            <div className="mono text-[11px] text-orange mb-3">{t("marketing.cloneEyebrow")}</div>
            <h2 className="display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.95]">
              {t("marketing.cloneTitle")}
              <br />
              <span className="text-white/40">{t("marketing.cloneTitleMuted")}</span>
            </h2>
            <p className="mt-4 text-white/55 text-[15px] leading-relaxed max-w-[420px]">
              {t("marketing.cloneBody")}
            </p>
            <Link
              href="/tools/clone"
              className="mt-8 inline-flex h-12 px-6 items-center rounded-rs bg-orange text-black font-bold text-[14px]"
            >
              {t("marketing.cloneCta")}
            </Link>
          </div>
        </div>
      </section>

      {/* Template Forge + Clone DNA */}
      <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/15 via-transparent to-[#00D9FF]/10" />
        <div className="relative mx-auto max-w-[1280px] grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="mono text-[11px] text-violet-soft mb-3">{t("marketing.forgeEyebrow")}</div>
            <h2 className="display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.95]">
              {t("marketing.forgeTitle")}
              <br />
              <span className="text-white/40">{t("marketing.forgeTitleMuted")}</span>
            </h2>
            <p className="mt-4 text-white/55 text-[15px] leading-relaxed max-w-[420px]">
              {t("marketing.forgeBody")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/template-forge"
                className="inline-flex h-12 px-6 items-center rounded-rs bg-violet text-white font-bold text-[14px]"
              >
                {t("marketing.forgeCta")}
              </Link>
              <Link
                href="/tools/clone"
                className="inline-flex h-12 px-6 items-center rounded-rs border border-white/20 font-medium text-[14px]"
              >
                {t("marketing.cloneCta")}
              </Link>
            </div>
          </div>

          <div className="relative aspect-[4/3] rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
            <svg viewBox="0 0 480 360" className="w-full h-full" aria-hidden>
              <rect width="480" height="360" fill="#0A0A0A" />
              <text x="32" y="48" fill="#00D9FF" fontSize="11" fontFamily="monospace" letterSpacing="2">
                STRUCTURE ONLY · NEVER THE BYTES
              </text>
              <rect x="40" y="90" width="120" height="56" rx="12" fill="#151515" stroke="#7C3AED" />
              <text x="100" y="124" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">
                YT / TT / IG
              </text>
              <path d="M170 118 H220" stroke="#7C3AED" strokeWidth="2" />
              <rect x="220" y="90" width="120" height="56" rx="12" fill="#151515" stroke="#00D9FF" />
              <text x="280" y="124" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">
                STYLE DNA
              </text>
              <path d="M350 118 H400" stroke="#00D9FF" strokeWidth="2" />
              <rect x="400" y="90" width="40" height="56" rx="12" fill="#FF7A00" />
              <text x="420" y="124" textAnchor="middle" fill="#000" fontSize="11" fontWeight="800">
                OUT
              </text>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect
                  key={i}
                  x={48 + i * 68}
                  y={200}
                  width="52"
                  height={40 + (i % 3) * 28}
                  rx="8"
                  fill={i % 2 ? "#7C3AED" : "#00D9FF"}
                  opacity={0.35 + i * 0.08}
                  className="pipe-node"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
              <text x="32" y="330" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="monospace">
                CUT RATE · LUT · CAMERA · ROOM · VOICE
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* Templates Room · Pixabay */}
      <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1280px] grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="mono text-[11px] text-orange mb-3">{t("marketing.roomEyebrow")}</div>
            <h2 className="display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.95]">
              {t("marketing.roomTitle")}
              <br />
              <span className="text-white/40">{t("marketing.roomTitleMuted")}</span>
            </h2>
            <p className="mt-4 text-white/55 text-[15px] leading-relaxed max-w-[420px]">
              {t("marketing.roomBody")}
            </p>
            <Link
              href="/templates-room"
              className="mt-8 inline-flex h-12 px-6 items-center rounded-rs bg-orange text-black font-bold text-[14px]"
            >
              {t("marketing.roomCta")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { t: "Nollywood", c: "#FF7A00" },
              { t: "Asia", c: "#00D9FF" },
              { t: "Drama", c: "#7C3AED" },
              { t: "Action", c: "#FF7A00" },
              { t: "Product", c: "#00D9FF" },
              { t: "Pixabay ×100", c: "#C4B5FD" },
            ].map((x) => (
              <div
                key={x.t}
                className="rounded-rs-xl border border-white/10 p-5 min-h-[100px] flex items-end"
                style={{ background: `linear-gradient(160deg, ${x.c}33, #0A0A0A)` }}
              >
                <span className="display text-[22px]">{x.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Close CTA */}
      <section className="relative px-5 md:px-8 py-24 md:py-32 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[900px] text-center">
          <h2 className="display text-[clamp(2.4rem,7vw,5rem)] leading-[0.9]">
            {t("marketing.closeTitle")}
            <br />
            <span className="bg-empire bg-clip-text text-transparent">{t("marketing.closeTitleAccent")}</span>
          </h2>
          <p className="mt-5 text-white/55 text-[16px] max-w-[420px] mx-auto">{t("marketing.closeBody")}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="h-14 px-8 inline-flex items-center rounded-rs bg-orange text-black font-bold"
            >
              {t("marketing.closeCtaFactory")}
            </Link>
            <Link
              href="/pricing"
              className="h-14 px-8 inline-flex items-center rounded-rs border border-white/20 font-medium"
            >
              {t("marketing.closeCtaPricing")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-5 md:px-8 py-8">
        <div className="mx-auto max-w-[1280px] flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="mono text-[10px] text-white/35">{t("marketing.footerCopy")}</div>
          <div className="flex flex-wrap gap-5 text-[13px] text-white/50">
            <Link href="/how-it-works" className="hover:text-white">
              {t("nav.howItWorks")}
            </Link>
            <Link href="/yt-os" className="hover:text-white">
              YT-OS
            </Link>
            <Link href="/tools/clone" className="hover:text-white">
              Clone
            </Link>
            <Link href="/producers" className="hover:text-white">
              {t("nav.producers")}
            </Link>
            <Link href="/training" className="hover:text-white">
              {t("nav.training")}
            </Link>
            <Link href="/pricing" className="hover:text-white">
              {t("nav.pricing")}
            </Link>
            <Link href="/dashboard" className="hover:text-white">
              {t("nav.dashboard")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
