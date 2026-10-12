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
          <div className="mx-auto w-full max-w-[1280px] grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-14 items-end">
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
                  href="/camera"
                  className="h-12 md:h-14 px-7 inline-flex items-center rounded-rs bg-orange text-black font-bold text-[14px] md:text-[15px] hover:brightness-110 transition"
                >
                  {t("marketing.ctaForge")}
                </Link>
                <Link
                  href="/translate"
                  className="h-12 md:h-14 px-7 inline-flex items-center rounded-rs border border-cyan/40 text-cyan font-medium text-[14px] md:text-[15px] hover:bg-cyan/10 transition"
                >
                  Language Studio
                </Link>
                <Link
                  href="/studio-set"
                  className="h-12 md:h-14 px-7 inline-flex items-center rounded-rs border border-white/20 text-white font-medium text-[14px] md:text-[15px] hover:bg-white/[0.05] transition"
                >
                  {t("marketing.ctaStudio")}
                </Link>
              </div>
            </div>

            {/* Camera Angle Prompt Studio — interactive hero display */}
            <Link
              href="/camera"
              className="group relative block w-full max-w-[420px] lg:max-w-none justify-self-end rounded-rs-xl border border-[#00f0ff]/40 bg-[#0A0A0A]/85 backdrop-blur-md overflow-hidden hover:border-[#00f0ff]/70 hover:bg-[#0C1214]/95 transition-all duration-300 hero-copy"
              style={{ animationDelay: "0.15s" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#00f0ff]/15 via-transparent to-[#ff7a00]/15 pointer-events-none" />
              <div className="relative p-5 md:p-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="mono text-[10px] text-[#00f0ff] tracking-[0.16em]">
                    {t("marketing.heroCameraEyebrow")}
                  </span>
                  <span className="mono text-[9px] px-2 py-1 rounded-full bg-[#ff7a00] text-black font-bold">
                    LIVE
                  </span>
                </div>
                <div className="display text-[28px] md:text-[32px] leading-none">
                  {t("marketing.heroCameraTitle")}
                </div>
                <p className="mt-3 text-[13px] text-white/60 leading-relaxed">
                  {t("marketing.heroCameraBody")}
                </p>
                <div className="mt-5 grid grid-cols-5 gap-1.5">
                  {[
                    { code: "/BTS", c: "#ff7a00" },
                    { code: "/Ad", c: "#ff7a00" },
                    { code: "/Drone", c: "#00f0ff" },
                    { code: "/Low", c: "#00f0ff" },
                    { code: "/Orbit", c: "#8b5cf6" },
                  ].map((l) => (
                    <div
                      key={l.code}
                      className="rounded-md border py-2 text-center mono text-[9px] font-bold group-hover:scale-[1.03] transition-transform truncate px-0.5"
                      style={{ borderColor: `${l.c}66`, color: l.c }}
                    >
                      {l.code}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="mono text-[9px] text-white/35">{t("marketing.heroCameraMeta")}</span>
                  <span className="inline-flex h-10 px-4 items-center rounded-rs bg-[#00f0ff] text-black text-[12px] font-bold group-hover:brightness-110">
                    {t("marketing.heroCameraCta")} →
                  </span>
                </div>
              </div>
            </Link>
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

      {/* Full Studio Set */}
      <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7C3AED]/14 via-transparent to-[#00D9FF]/10" />
        <div className="relative mx-auto max-w-[1280px] grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="mono text-[11px] text-violet-soft mb-3">{t("marketing.studioSetEyebrow")}</div>
            <h2 className="display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.95]">
              {t("marketing.studioSetTitle")}
              <br />
              <span className="text-white/40">{t("marketing.studioSetTitleMuted")}</span>
            </h2>
            <p className="mt-4 text-white/55 text-[15px] leading-relaxed max-w-[420px]">
              {t("marketing.studioSetBody")}
            </p>
            <Link
              href="/studio-set"
              className="mt-8 inline-flex h-12 px-6 items-center rounded-rs bg-violet text-white font-bold text-[14px]"
            >
              {t("marketing.studioSetCta")}
            </Link>
          </div>
          <div className="relative aspect-[4/3] rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
            <svg viewBox="0 0 480 360" className="w-full h-full" aria-hidden>
              <rect width="480" height="360" fill="#0A0A0A" />
              <text x="32" y="40" fill="#C4B5FD" fontSize="11" fontFamily="monospace" letterSpacing="2">
                FULL STUDIO SET · APPLY TO DIRECTOR
              </text>
              {[
                { y: 70, label: "ROOM — establishing · wide · OSH · close", w: 360, stroke: "#7C3AED" },
                { y: 120, label: "ARTIST — front · left · right · 3Q", w: 300, stroke: "#00D9FF" },
                { y: 170, label: "IMAGERY — prompt DNA · refresh plates", w: 320, stroke: "#FF7A00" },
                { y: 220, label: "READINESS → APPLY TO DIRECTOR", w: 280, stroke: "#C4B5FD" },
              ].map((row) => (
                <g key={row.label}>
                  <rect
                    x="32"
                    y={row.y}
                    width={row.w}
                    height="36"
                    rx="8"
                    fill="#151515"
                    stroke={row.stroke}
                  />
                  <text x="48" y={row.y + 23} fill="rgba(255,255,255,0.78)" fontSize="12" fontFamily="monospace">
                    {row.label}
                  </text>
                </g>
              ))}
              <text x="32" y="300" fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="monospace">
                THEN STORYBOARD · STUDIO · SOUND · VAULT · MERGE
              </text>
              <text x="32" y="330" fill="rgba(255,255,255,0.28)" fontSize="10" fontFamily="monospace">
                WORLD BUILDER = QUICK SOUL/ROOM STUB
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* Camera Angle Prompt Studio OS Layer */}
      <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00f0ff]/14 via-transparent to-[#ff7a00]/12" />
        <div className="relative mx-auto max-w-[1280px] grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="mono text-[11px] text-[#00f0ff] mb-3">{t("marketing.cameraEyebrow")}</div>
            <h2 className="display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.95]">
              {t("marketing.cameraTitle")}
              <br />
              <span className="text-white/40">{t("marketing.cameraTitleMuted")}</span>
            </h2>
            <p className="mt-4 text-white/55 text-[15px] leading-relaxed max-w-[420px]">
              {t("marketing.cameraBody")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/camera"
                className="inline-flex h-12 px-6 items-center rounded-rs bg-[#00f0ff] text-black font-bold text-[14px]"
              >
                {t("marketing.cameraCta")}
              </Link>
              <Link
                href="/world-builder"
                className="inline-flex h-12 px-6 items-center rounded-rs border border-[#8b5cf6]/40 text-[#c4b5fd] font-medium text-[14px] hover:bg-[#8b5cf6]/10"
              >
                World Builder
              </Link>
              <Link
                href="/training"
                className="inline-flex h-12 px-6 items-center rounded-rs border border-white/20 text-white/80 font-medium text-[14px] hover:bg-white/[0.05]"
              >
                {t("marketing.ctaTraining")}
              </Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
            <svg viewBox="0 0 480 360" className="w-full h-full" aria-hidden>
              <rect width="480" height="360" fill="#0A0A0A" />
              <text x="28" y="36" fill="#00f0ff" fontSize="11" fontFamily="monospace" letterSpacing="2">
                CAMERA ANGLES · DARIO 5 → 30+ · FLUX READY
              </text>
              {[
                { y: 56, label: "01 SOURCE — image · video · YouTube / IG reel", w: 400, c: "#00f0ff" },
                { y: 96, label: "02 DETECT — eye-level · lens · confidence", w: 380, c: "#8b5cf6" },
                { y: 136, label: "03 DARIO — /BTS /Adcreative /Blueprint /Drone /Explode", w: 420, c: "#ff7a00" },
                { y: 176, label: "04 ANGLES — Low · High · BirdsEye · POV · Orbit…", w: 390, c: "#00f0ff" },
                { y: 216, label: "05 PREVIEW — ComfyUI Flux → R2 camera/preview/", w: 400, c: "#8b5cf6" },
                { y: 256, label: "06 SEND — World Builder · Shot List · Studio Set", w: 390, c: "#ff7a00" },
              ].map((row) => (
                <g key={row.label}>
                  <rect
                    x="24"
                    y={row.y}
                    width={row.w}
                    height="32"
                    rx="6"
                    fill="#12121a"
                    stroke={`${row.c}66`}
                  />
                  <text x="40" y={row.y + 21} fill="rgba(255,255,255,0.8)" fontSize="11" fontFamily="monospace">
                    {row.label}
                  </text>
                </g>
              ))}
              <text x="28" y="330" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="monospace">
                2 RTC ANALYZE · 1 RTC PREVIEW · app.reelstorm.uk/camera
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* Language Studio OS Layer */}
      <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00D9FF]/14 via-transparent to-[#7C3AED]/12" />
        <div className="relative mx-auto max-w-[1280px] grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="mono text-[11px] text-cyan mb-3">{t("marketing.langEyebrow")}</div>
            <h2 className="display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.95]">
              {t("marketing.langTitle")}
              <br />
              <span className="text-white/40">{t("marketing.langTitleMuted")}</span>
            </h2>
            <p className="mt-4 text-white/55 text-[15px] leading-relaxed max-w-[420px]">
              {t("marketing.langBody")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/translate"
                className="inline-flex h-12 px-6 items-center rounded-rs bg-cyan text-black font-bold text-[14px]"
              >
                {t("marketing.langCta")}
              </Link>
              <Link
                href="/sound-studio"
                className="inline-flex h-12 px-6 items-center rounded-rs border border-white/20 text-white/80 font-medium text-[14px] hover:bg-white/[0.05]"
              >
                Sound Studio
              </Link>
              <Link
                href="/training"
                className="inline-flex h-12 px-6 items-center rounded-rs border border-white/20 text-white/80 font-medium text-[14px] hover:bg-white/[0.05]"
              >
                {t("marketing.ctaTraining")}
              </Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
            <svg viewBox="0 0 480 360" className="w-full h-full" aria-hidden>
              <rect width="480" height="360" fill="#0A0A0A" />
              <text x="28" y="36" fill="#00D9FF" fontSize="11" fontFamily="monospace" letterSpacing="2">
                LANGUAGE STUDIO · EN → DE / YO / HA / IG
              </text>
              {[
                { y: 56, label: "01 DOWNLOAD — YouTube · Instagram · MP4", w: 400, c: "#00D9FF" },
                { y: 96, label: "02 WHISPER — English transcript + segments", w: 380, c: "#C4B5FD" },
                { y: 136, label: "03 TRANSLATE — NLLB / LLM dub packs", w: 360, c: "#FF7A00" },
                { y: 176, label: "04 TTS — cloned voice · multilingual", w: 340, c: "#7C3AED" },
                { y: 216, label: "05 LIP + BODY SYNC — Wav2Lip · LivePortrait", w: 410, c: "#00D9FF" },
                { y: 256, label: "06 R2 — videos.reelstorm.uk/translated/", w: 370, c: "#FF7A00" },
              ].map((row) => (
                <g key={row.label}>
                  <rect x="24" y={row.y} width={row.w} height="30" rx="6" fill="#12121a" stroke={`${row.c}66`} />
                  <text x="40" y={row.y + 20} fill="rgba(255,255,255,0.8)" fontSize="11" fontFamily="monospace">
                    {row.label}
                  </text>
                </g>
              ))}
              <text x="28" y="330" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="monospace">
                10 RTC / LANG · BODY SYNC · AFRICA + GLOBAL
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* YouTube Automation OS Layer */}
      <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00D9FF]/12 via-transparent to-[#FF7A00]/10" />
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
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/yt-os"
                className="inline-flex h-12 px-6 items-center rounded-rs bg-cyan text-black font-bold text-[14px]"
              >
                {t("marketing.ytosCta")}
              </Link>
              <Link
                href="/model-center/avatar"
                className="inline-flex h-12 px-6 items-center rounded-rs border border-orange/40 text-orange font-medium text-[14px] hover:bg-orange/10"
              >
                Avatar Studio
              </Link>
              <Link
                href="/training"
                className="inline-flex h-12 px-6 items-center rounded-rs border border-white/20 text-white/80 font-medium text-[14px] hover:bg-white/[0.05]"
              >
                {t("marketing.ctaTraining")}
              </Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
            <svg viewBox="0 0 480 360" className="w-full h-full" aria-hidden>
              <rect width="480" height="360" fill="#0A0A0A" />
              <text x="32" y="36" fill="#00D9FF" fontSize="11" fontFamily="monospace" letterSpacing="2">
                YOUTUBE AUTOMATION OS · 7 AGENTS
              </text>
              {[
                { y: 56, label: "01 STRATEGY — winning topics · 14-day calendar", w: 400, c: "#00D9FF" },
                { y: 92, label: "02 SCRIPT — HOOK · INTRO · BEATS · CTA", w: 360, c: "#C4B5FD" },
                { y: 128, label: "03 THUMBNAIL — I FIRED MYSELF · A/B CTR", w: 380, c: "#FF7A00" },
                { y: 164, label: "04 SEO — keywords · titles · tags 15–20", w: 340, c: "#00D9FF" },
                { y: 200, label: "05 PRODUCTION — Avatar · VO · R2 assemble", w: 390, c: "#7C3AED" },
                { y: 236, label: "06 PUBLISH — YouTube upload · schedule", w: 350, c: "#FF7A00" },
                { y: 272, label: "07 ANALYTICS — feedback loop → calendar", w: 370, c: "#00D9FF" },
              ].map((row) => (
                <g key={row.label}>
                  <rect
                    x="24"
                    y={row.y}
                    width={row.w}
                    height="28"
                    rx="6"
                    fill="#12121a"
                    stroke={`${row.c}66`}
                  />
                  <text x="40" y={row.y + 18} fill="rgba(255,255,255,0.8)" fontSize="11" fontFamily="monospace">
                    {row.label}
                  </text>
                </g>
              ))}
              <text x="32" y="330" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="monospace">
                20 RTC / VIDEO · AVATAR TWIN · NO FILMING
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

      {/* ReelStorm Studio */}
      <section className="relative px-5 md:px-8 py-20 md:py-28 border-t border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan/10 via-transparent to-orange/10" />
        <div className="relative mx-auto max-w-[1280px] grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="mono text-[11px] text-cyan mb-3">{t("marketing.studioEyebrow")}</div>
            <h2 className="display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.95]">
              {t("marketing.studioTitle")}
              <br />
              <span className="text-white/40">{t("marketing.studioTitleMuted")}</span>
            </h2>
            <p className="mt-4 text-white/55 text-[15px] leading-relaxed max-w-[420px]">
              {t("marketing.studioBody")}
            </p>
            <Link
              href="/download"
              className="mt-8 inline-flex h-12 px-6 items-center rounded-rs bg-cyan text-black font-bold text-[14px]"
            >
              {t("marketing.studioCta")}
            </Link>
          </div>
          <div className="relative aspect-[4/3] rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] overflow-hidden">
            <svg viewBox="0 0 480 360" className="w-full h-full" aria-hidden>
              <rect width="480" height="360" fill="#0A0A0A" />
              <text x="32" y="48" fill="#00D9FF" fontSize="11" fontFamily="monospace" letterSpacing="2">
                RTX LOCAL · CENTRAL METER · HEARTBEAT
              </text>
              {[
                { y: 90, label: "ACTIVATE LICENSE", w: 220 },
                { y: 140, label: "SKYREELS ON YOUR GPU", w: 280 },
                { y: 190, label: "REPORT MINUTES → API", w: 260 },
                { y: 240, label: "CANCEL STRIPE → BLOCK", w: 250 },
              ].map((row, i) => (
                <g key={row.label}>
                  <rect
                    x="32"
                    y={row.y}
                    width={row.w}
                    height="36"
                    rx="8"
                    fill="#151515"
                    stroke={i === 1 ? "#00D9FF" : "rgba(255,255,255,0.1)"}
                  />
                  <text x="48" y={row.y + 23} fill="rgba(255,255,255,0.75)" fontSize="12" fontFamily="monospace">
                    {row.label}
                  </text>
                </g>
              ))}
              <text x="32" y="330" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="monospace">
                $0 GPU COGS TO REELSTORM · MRR INTACT
              </text>
            </svg>
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
            <Link href="/camera" className="hover:text-white">
              Camera Angles
            </Link>
            <Link href="/translate" className="hover:text-white">
              Language Studio
            </Link>
            <Link href="/yt-os" className="hover:text-white">
              YouTube OS
            </Link>
            <Link href="/studio-set" className="hover:text-white">
              Studio Set
            </Link>
            <Link href="/download" className="hover:text-white">
              Studio
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
