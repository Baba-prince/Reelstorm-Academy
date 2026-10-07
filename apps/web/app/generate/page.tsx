"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/lib/auth";
import { getApiBase } from "@/lib/api";

const LICENSE_LS_KEY = "reelstorm_studio_license_key";
const FP_LS_KEY = "reelstorm_studio_web_fingerprint";

function webFingerprint() {
  if (typeof window === "undefined") return "web";
  let fp = localStorage.getItem(FP_LS_KEY);
  if (!fp) {
    fp = `web-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    localStorage.setItem(FP_LS_KEY, fp);
  }
  return fp;
}

function GenerateInner() {
  const { user, token, loading } = useAuth();
  const [prompt, setPrompt] = useState("Nollywood market at dusk, cinematic handheld, warm sodium light");
  const [duration, setDuration] = useState(60);
  const [licenseKey, setLicenseKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<{
    r2_url: string;
    remaining: number;
    minutes: number;
    engine?: string;
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LICENSE_LS_KEY);
    if (saved) setLicenseKey(saved);
  }, []);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setResult(null);
    setBusy(true);
    setStatus("Generating on saver (4.2GB engine) — ~5 mins — 0 MB download…");

    const key = licenseKey.trim();
    if (key) localStorage.setItem(LICENSE_LS_KEY, key);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const body: Record<string, unknown> = {
      prompt: prompt.trim(),
      duration,
      fingerprint: webFingerprint(),
      engine: "studio",
    };
    if (key) body.license_key = key;

    try {
      const res = await fetch(`${getApiBase()}/api/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setResult({
        r2_url: j.r2_url,
        remaining: j.remaining,
        minutes: j.minutes,
        engine: j.engine,
      });
      setStatus("Done — video on R2. Engine never left the saver.");
    } catch (e) {
      setErr((e as Error).message);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/[0.06] px-5 md:px-8 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="display text-[13px]">
          REELSTORM · Generate
        </Link>
        <div className="flex gap-3 text-[13px]">
          <Link href="/download" className="text-cyan hover:underline">
            Desktop 120MB
          </Link>
          <Link href="/settings/studio" className="text-white/55 hover:text-white">
            Studio license
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 py-12 md:py-16">
        <div className="mono text-[11px] text-cyan mb-3">0 MB WEB · GPU SAVER · POD xuvnute4l51iog</div>
        <h1 className="display text-[clamp(2rem,5vw,3rem)] leading-[0.95]">
          Generate on the saver.
          <br />
          <span className="text-white/40">No 4.2GB download.</span>
        </h1>
        <p className="mt-4 text-white/55 text-[15px] leading-relaxed">
          Prompt hits VPS license control, then RunPod RTX 4090 where SkyReels weights live. Same engine as the
          thin desktop app.
        </p>

        {!loading && !user && !licenseKey && (
          <p className="mt-6 text-[13px] text-orange/90 border border-orange/30 rounded-rs p-4">
            Sign in with a Studio license, or paste an{" "}
            <code className="text-cyan">RSTUDIO-</code> key below.{" "}
            <Link href="/login?next=/generate" className="underline">
              Sign in
            </Link>{" "}
            ·{" "}
            <Link href="/download" className="underline">
              Get free license
            </Link>
          </p>
        )}

        <form onSubmit={onGenerate} className="mt-10 space-y-5">
          <label className="block">
            <span className="mono text-[10px] text-white/40">PROMPT</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              required
              className="mt-2 w-full rounded-rs border border-white/15 bg-white/[0.03] px-4 py-3 text-[14px] outline-none focus:border-cyan/50"
            />
          </label>

          <label className="block">
            <span className="mono text-[10px] text-white/40">DURATION · {duration}s</span>
            <input
              type="range"
              min={15}
              max={120}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-3 w-full accent-orange"
            />
          </label>

          <label className="block">
            <span className="mono text-[10px] text-white/40">
              LICENSE KEY (optional if signed in) · stored in localStorage only
            </span>
            <input
              type="password"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="RSTUDIO-…"
              autoComplete="off"
              className="mt-2 w-full rounded-rs border border-white/15 bg-white/[0.03] px-4 py-3 text-[13px] font-mono outline-none focus:border-cyan/50"
            />
          </label>

          <button
            type="submit"
            disabled={busy || !prompt.trim()}
            className="h-12 px-8 rounded-rs bg-orange text-black font-bold text-[14px] disabled:opacity-40 hover:brightness-110"
          >
            {busy ? "Generating…" : "Generate"}
          </button>
        </form>

        {status && <p className="mt-6 text-[13px] text-cyan/90">{status}</p>}
        {err && <p className="mt-4 text-[13px] text-red-400">{err}</p>}

        {result && (
          <div className="mt-10 space-y-4 rounded-rs-xl border border-white/[0.08] bg-[#0A0A0A] p-5">
            <div className="mono text-[10px] text-white/40">
              {result.engine} · {result.minutes.toFixed(2)} min · {result.remaining.toFixed(2)} remaining
            </div>
            <video src={result.r2_url} controls className="w-full rounded-rs bg-black" />
            <a href={result.r2_url} target="_blank" rel="noreferrer" className="text-[13px] text-cyan underline">
              Open R2 URL
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <AuthProvider>
      <GenerateInner />
    </AuthProvider>
  );
}
