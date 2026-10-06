"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { FlipBook } from "@/components/marketing/training/FlipBook";

export default function TrainingGuidePage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />

      <section className="px-5 md:px-8 pt-14 md:pt-20 pb-8">
        <div className="mx-auto max-w-[980px]">
          <div className="mono text-[11px] text-cyan mb-3">FLIP ARTIFACT · OPERATOR GUIDE</div>
          <h1 className="display text-[clamp(2.4rem,7vw,4.75rem)] leading-[0.9]">
            Training
            <br />
            <span className="text-white/40">manual.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[15px] max-w-[480px] leading-relaxed">
            Step-by-step tutorial with system images. Flip each page like the production artifact — match the screen, run the factory.
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 pb-16 md:pb-24">
        <FlipBook />
      </section>

      <section className="px-5 md:px-8 py-16 border-t border-white/[0.06] text-center">
        <p className="text-white/50 text-[14px] mb-6">Ready to operate?</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/template-forge"
            className="h-12 px-6 inline-flex items-center rounded-rs bg-orange text-black font-bold text-[14px]"
          >
            Open Template Forge
          </Link>
          <Link
            href="/how-it-works"
            className="h-12 px-6 inline-flex items-center rounded-rs border border-white/15 text-[14px]"
          >
            Factory map
          </Link>
        </div>
      </section>
    </div>
  );
}
