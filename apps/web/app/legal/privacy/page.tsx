"use client";

import { MarketingNav } from "@/components/marketing/MarketingNav";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />
      <article className="mx-auto max-w-[720px] px-5 md:px-8 py-16 md:py-24">
        <div className="mono text-[11px] text-white/40 mb-3">LEGAL</div>
        <h1 className="display text-4xl mb-6">Privacy</h1>
        <div className="space-y-4 text-[15px] text-white/60 leading-relaxed">
          <p>
            We process account email, project scripts, uploaded / referenced videos, and generation
            artifacts to operate STORM OS. White-label tenants act as controllers for their end users;
            ReelStorm acts as processor for factory jobs.
          </p>
          <p>
            API keys are stored hashed. Raw <code className="text-cyan">rs_live_</code> secrets are
            shown once at creation. Video temp files live under controlled storage and may be retained
            for ARCHIVE5 IP as configured by the project owner.
          </p>
          <p>
            Billing tier data follows the VisaVideos-aligned Storm / Storm Pro model for subscription
            state; RTC ledgers record grants and ARCHIVE5 debits.
          </p>
          <p className="text-white/40 text-sm">Last updated: 2026-10-06 · privacy@reelstorm.academy</p>
        </div>
      </article>
    </div>
  );
}
