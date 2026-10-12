"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { OS_LAYERS } from "@/lib/marketing/os-layers";

export default function OsIndexPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />

      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-12">
        <div className="mx-auto max-w-[960px]">
          <div className="mono text-[11px] text-cyan mb-3 tracking-[0.14em]">
            REELSTORM OS · MARKETING LAYERS
          </div>
          <h1 className="display text-[clamp(2.5rem,8vw,5rem)] leading-[0.9]">
            Every OS room.
            <br />
            <span className="text-white/40">One factory map.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[16px] max-w-[520px] leading-relaxed">
            Static infographic demos for each operating layer — open the live app when you are ready
            to run jobs.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 pb-24">
        <div className="mx-auto max-w-[1280px] grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {OS_LAYERS.map((l) => (
            <Link
              key={l.slug}
              href={`/os/${l.slug}`}
              className="group rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] p-5 hover:border-white/25 transition"
            >
              <div
                className="mono text-[9px] tracking-[0.14em] mb-3"
                style={{ color: l.accent }}
              >
                {l.eyebrow}
              </div>
              <div className="display text-[26px] leading-none group-hover:text-white">{l.title}</div>
              <p className="mt-3 text-[13px] text-white/50 leading-relaxed line-clamp-3">{l.body}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="mono text-[10px] text-white/35">{l.steps.length} steps</span>
                <span className="mono text-[11px] font-bold" style={{ color: l.accent }}>
                  View demo →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
