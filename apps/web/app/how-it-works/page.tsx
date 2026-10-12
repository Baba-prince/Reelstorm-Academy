"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { PipelineInfographic } from "@/components/marketing/PipelineInfographic";

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />

      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-12">
        <div className="mx-auto max-w-[960px]">
          <div className="mono text-[11px] text-cyan mb-3">
            INFOGRAPHIC · YOUTUBE AUTOMATION · STUDIO SET · FACTORY
          </div>
          <h1 className="display text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.9]">
            How the storm
            <br />
            <span className="text-white/40">makes a master.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[16px] max-w-[520px] leading-relaxed">
            YouTube Automation OS (7 agents) or a viral link in. Avatar twins, Sound Studio VO, and Pixabay
            intros feed the same factory — Studio Set → STORM → ARCHIVE5 → Merge.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 py-12 md:py-16 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1280px]">
          <PipelineInfographic />
        </div>
      </section>

      <section className="px-5 md:px-8 py-16 md:py-24 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[800px] space-y-16">
          {[
            {
              t: "YouTube Automation OS Layer",
              d: "Open /yt-os → create a channel → Run Full Pipeline. Seven agents fire in order: Strategy, Script, Thumbnail, SEO, Production (Avatar + VO → R2), Publish, Analytics. Feedback loop reorders your next 14-day calendar. Cost: 20 RTC per video.",
              c: "#00D9FF",
            },
            {
              t: "Idea, viral link, or Studio Set",
              d: "BOT Director Wizard, Template Forge, or Viral Clone Factory still feed Full Studio Set — Room · Artist · Imagery. Paste YouTube / TikTok / Instagram — we extract structure, never the source bytes.",
              c: "#7C3AED",
            },
            {
              t: "World · STORM · ARCHIVE5 · Merge",
              d: "Soul ID + room plates, parallel block generation, Sound Studio voice OS, immutable 5-minute vault entries (5 RTC), then FFmpeg merge to a bankable master.",
              c: "#FF7A00",
            },
          ].map((b, i) => (
            <div key={b.t} className="grid md:grid-cols-[80px_1fr] gap-6 items-start">
              <div className="mono text-[28px] font-bold" style={{ color: b.c }}>
                0{i + 1}
              </div>
              <div>
                <h2 className="display text-[28px] md:text-[36px] leading-none">{b.t}</h2>
                <p className="mt-3 text-white/55 text-[15px] leading-relaxed">{b.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 md:px-8 py-20 border-t border-white/[0.06] text-center">
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/yt-os"
            className="inline-flex h-14 px-8 items-center rounded-rs bg-orange text-black font-bold"
          >
            Open YouTube Automation
          </Link>
          <Link
            href="/model-center/avatar"
            className="inline-flex h-14 px-8 items-center rounded-rs border border-white/20 font-medium"
          >
            Avatar Studio
          </Link>
          <Link
            href="/wizard"
            className="inline-flex h-14 px-8 items-center rounded-rs border border-white/20 font-medium"
          >
            BOT Director
          </Link>
          <Link
            href="/training"
            className="inline-flex h-14 px-8 items-center rounded-rs border border-white/20 font-medium"
          >
            Flip training guide
          </Link>
        </div>
      </section>
    </div>
  );
}
