"use client";

import { MarketingNav } from "@/components/marketing/MarketingNav";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />
      <article className="mx-auto max-w-[720px] px-5 md:px-8 py-16 md:py-24 prose-invert">
        <div className="mono text-[11px] text-white/40 mb-3">LEGAL</div>
        <h1 className="display text-4xl mb-6">Terms of Service</h1>
        <div className="space-y-4 text-[15px] text-white/60 leading-relaxed">
          <p>
            REELSTORM ACADEMY OS (“STORM OS”) is a production factory service. By using the product,
            API, or white-label tenant features you agree to these terms.
          </p>
          <p>
            <strong className="text-white">RTC.</strong> Reelstorm Currency meters ARCHIVE5 output.
            1 RTC = 1 minute of finished master (720p). One 5-minute ARCHIVE5 set = 5 RTC. Unused monthly
            RTC rolls over on Premium Pro only; Basic and Premium follow plan terms. Network (white-label)
            allowances follow the tenant agreement. Purchased packs are non-refundable once spent on
            generation jobs.
          </p>
          <p>
            <strong className="text-white">White-label.</strong> Academy tenants are responsible for
            end-user content, compliance, and brand representations. ReelStorm may appear in
            technical logs even when hideReelstorm is enabled.
          </p>
          <p>
            <strong className="text-white">Providers.</strong> Third-party model usage (DashScope,
            Veo, Kling, Seedance, ElevenLabs) is subject to those providers’ terms and is billed to
            keys you supply.
          </p>
          <p className="text-white/40 text-sm">Last updated: 2026-10-06 · Contact: legal@reelstorm.academy</p>
        </div>
      </article>
    </div>
  );
}
