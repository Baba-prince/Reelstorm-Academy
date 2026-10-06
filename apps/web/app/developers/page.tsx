"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";

const ENDPOINTS = [
  { m: "POST", path: "/v1/wl/tenants", desc: "Provision Academy tenant + brand + first API key" },
  { m: "GET", path: "/v1/wl/me", desc: "Tenant, brand, RTC wallet (Bearer rs_live_…)" },
  { m: "PATCH", path: "/v1/wl/brand", desc: "Update colors, product name, hideReelstorm" },
  { m: "GET", path: "/v1/wl/templates", desc: "List style templates" },
  { m: "POST", path: "/v1/wl/from-url", desc: "YouTube / web reference → analyze" },
  { m: "POST", path: "/v1/wl/generate", desc: "Script → ARCHIVE5 (debits 100 RTC / 5-min)" },
  { m: "GET", path: "/v1/wl/wallet", desc: "RTC balance + ledger" },
  { m: "POST", path: "/v1/wl/keys", desc: "Mint additional API keys" },
];

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />

      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-10">
        <div className="mx-auto max-w-[900px]">
          <div className="mono text-[11px] text-cyan mb-3">DEVELOPERS</div>
          <h1 className="display text-[clamp(2.4rem,6vw,4rem)] leading-[0.9]">
            White-label API
            <br />
            <span className="text-white/40">reference.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[15px] max-w-[520px]">
            Auth with <code className="text-cyan">Authorization: Bearer rs_live_…</code> or{" "}
            <code className="text-cyan">X-Api-Key</code>. Base URL: your API host (local{" "}
            <code className="text-white/80">http://localhost:4000</code>).
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 py-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[900px] space-y-3">
          {ENDPOINTS.map((e) => (
            <div
              key={e.path}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b border-white/[0.06]"
            >
              <span className="mono text-[10px] text-orange w-14">{e.m}</span>
              <code className="text-[13px] text-cyan flex-1">{e.path}</code>
              <span className="text-[13px] text-white/45 sm:text-right sm:max-w-[280px]">{e.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 md:px-8 py-12 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[900px]">
          <div className="mono text-[10px] text-white/40 mb-3">EXAMPLE · GENERATE</div>
          <pre className="rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] p-5 text-[12px] text-white/70 overflow-x-auto leading-relaxed">{`curl -X POST $API/v1/wl/generate \\
  -H "Authorization: Bearer rs_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Episode 01",
    "script": "INT. STUDIO - NIGHT\\n...",
    "durationSec": 300
  }'
# → bills 100 RTC for one ARCHIVE5 block`}</pre>
          <div className="mt-8 flex gap-3">
            <Link href="/white-label" className="h-11 px-5 inline-flex items-center rounded-rs bg-orange text-black font-bold text-sm">
              Provision tenant
            </Link>
            <Link href="/pricing" className="h-11 px-5 inline-flex items-center rounded-rs border border-white/15 text-sm">
              RTC pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
