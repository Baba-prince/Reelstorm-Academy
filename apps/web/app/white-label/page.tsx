"use client";

import { useState } from "react";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { API_URL } from "@/lib/api";

export default function WhiteLabelPage() {
  const [name, setName] = useState("Nova Academy");
  const [slug, setSlug] = useState("nova-academy");
  const [email, setEmail] = useState("studio@nova.academy");
  const [productName, setProductName] = useState("Nova Studio OS");
  const [primary, setPrimary] = useState("#7C3AED");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createTenant() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/v1/wl/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: email,
          name,
          slug,
          brand: {
            productName,
            primaryHex: primary,
            accentHex: "#00D9FF",
            ctaHex: "#FF7A00",
            hideReelstorm: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setResult(
        `Tenant ready.\nSlug: ${data.tenant.slug}\nAPI key (copy now):\n${data.apiKey}\n\nTry:\ncurl -H "Authorization: Bearer ${data.apiKey}" ${API_URL}/v1/wl/me`,
      );
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <MarketingNav variant="solid" />

      <section className="px-5 md:px-8 pt-16 md:pt-24 pb-12">
        <div className="mx-auto max-w-[960px]">
          <div className="mono text-[11px] text-cyan mb-3">WHITE-LABEL · ACADEMY API</div>
          <h1 className="display text-[clamp(2.4rem,7vw,4.75rem)] leading-[0.9]">
            ReelStorm under
            <br />
            <span className="text-white/40">your academy brand.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[16px] max-w-[520px] leading-relaxed">
            Studios and academies call our factory with their logo, colors, and product name.
            Students never see RS — unless you want them to. Metered in RTC (100 RTC = one 5-min ARCHIVE5).
          </p>
        </div>
      </section>

      <section className="px-5 md:px-8 py-12 border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1100px] grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="display text-[28px] mb-4">What you get</h2>
            <ul className="space-y-3 text-[14px] text-white/65">
              {[
                "REST API: /v1/wl/* with rs_live_ keys",
                "Brand tokens: colors, monogram, product name",
                "Generate + YouTube URL extract under your brand",
                "Tenant RTC wallet (Storm Pro pool by default)",
                "Hide ReelStorm chrome when hideReelstorm=true",
              ].map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-orange">▸</span>
                  {i}
                </li>
              ))}
            </ul>
            <Link href="/developers" className="mt-8 inline-flex text-cyan text-[14px] font-medium">
              Read developer docs →
            </Link>
          </div>

          <div className="rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] p-6 space-y-3">
            <div className="mono text-[10px] text-orange">PROVISION TENANT</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Studio name"
              className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
            />
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug"
              className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner email"
              className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
            />
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Product name shown to users"
              className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
            />
            <label className="flex items-center gap-3 text-sm text-white/60">
              Primary
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="h-10 w-14 bg-transparent border-0"
              />
            </label>
            <button
              onClick={() => void createTenant()}
              disabled={busy}
              className="w-full h-12 rounded-rs bg-orange text-black font-bold text-sm"
            >
              {busy ? "Creating…" : "Create white-label tenant"}
            </button>
            {result && (
              <pre className="mt-2 p-3 rounded-rs bg-void border border-white/10 text-[11px] text-cyan whitespace-pre-wrap break-all">
                {result}
              </pre>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
