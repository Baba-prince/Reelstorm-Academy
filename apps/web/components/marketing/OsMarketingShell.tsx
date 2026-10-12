"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { OsInfographic } from "@/components/marketing/OsInfographic";
import { OS_LAYERS, type OsLayer } from "@/lib/marketing/os-layers";

export function OsMarketingShell({ layer }: { layer: OsLayer }) {
  const others = OS_LAYERS.filter((l) => l.slug !== layer.slug).slice(0, 6);

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />

      <section className="relative px-5 md:px-8 pt-14 md:pt-20 pb-16 md:pb-24 overflow-hidden border-b border-white/[0.06]">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 20% 0%, ${layer.accent}33, transparent 55%)`,
          }}
        />
        <div className="relative mx-auto max-w-[1280px] grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          <div>
            <div className="mono text-[11px] mb-3 tracking-[0.14em]" style={{ color: layer.accent }}>
              {layer.eyebrow}
            </div>
            <h1 className="display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.92]">
              {layer.headline}
              <br />
              <span className="text-white/40">{layer.headlineMuted}</span>
            </h1>
            <p className="mt-5 text-white/55 text-[16px] leading-relaxed max-w-[34rem]">{layer.body}</p>
            {layer.rtc && (
              <div className="mt-4 mono text-[11px] text-white/40">{layer.rtc}</div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={layer.appHref}
                className="h-12 md:h-14 px-7 inline-flex items-center rounded-rs font-bold text-[14px] text-black"
                style={{ background: layer.accent }}
              >
                {layer.cta}
              </Link>
              <Link
                href="/os"
                className="h-12 md:h-14 px-7 inline-flex items-center rounded-rs border border-white/20 font-medium text-[14px] hover:bg-white/[0.05]"
              >
                All OS layers
              </Link>
              <Link
                href="/signup"
                className="h-12 md:h-14 px-7 inline-flex items-center rounded-rs border border-white/20 font-medium text-[14px] hover:bg-white/[0.05]"
              >
                Start free demo
              </Link>
            </div>
          </div>
          <OsInfographic layer={layer} />
        </div>
      </section>

      <section className="px-5 md:px-8 py-16 md:py-20 border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1280px]">
          <div className="mono text-[11px] text-white/40 mb-6 tracking-[0.14em]">PIPELINE STEPS · STATIC DEMO</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {layer.steps.map((s) => (
              <div
                key={s.n}
                className="rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] p-5"
              >
                <div className="mono text-[12px] font-bold" style={{ color: layer.accent }}>
                  {s.n}
                </div>
                <div className="display text-[22px] mt-2 leading-none">{s.label}</div>
                <p className="mt-2 text-[13px] text-white/50">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 md:px-8 py-16 md:py-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <div className="mono text-[11px] text-cyan mb-2 tracking-[0.14em]">MORE OS LAYERS</div>
              <h2 className="display text-[clamp(1.6rem,3vw,2.4rem)] leading-none">Explore the factory</h2>
            </div>
            <Link href="/os" className="mono text-[11px] text-cyan hover:underline shrink-0">
              View all →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {others.map((l) => (
              <Link
                key={l.slug}
                href={`/os/${l.slug}`}
                className="rounded-rs border border-white/10 bg-white/[0.02] px-4 py-4 hover:border-white/25 transition"
              >
                <div className="mono text-[9px] tracking-[0.12em]" style={{ color: l.accent }}>
                  {l.eyebrow.split("·")[0]?.trim()}
                </div>
                <div className="font-semibold mt-1">{l.title}</div>
                <p className="text-[12px] text-white/45 mt-1 line-clamp-2">{l.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
