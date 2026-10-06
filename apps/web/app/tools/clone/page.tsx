"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";

type AnalyzeResult = {
  cloneJobId: string;
  platform: string;
  title?: string;
  hook?: string;
  body_points?: string[];
  cta?: string;
  duration?: number;
  visual_style?: string;
  pacing?: { wordsPerSec?: number; estimatedCutsPerMin?: number };
  thumbnail?: string;
  tags?: string[];
  estimated_rtc?: number;
  analyze_rtc?: number;
  watermark?: string;
  breakdown?: { hook?: string; body?: string; cta?: string; visual?: string };
};

type ReproduceResult = {
  cloneJobId: string;
  status: string;
  style?: string;
  r2Url?: string;
  rewrittenTranscript?: string;
  watermark?: string;
  message?: string;
  jobId?: string;
};

const STYLES = [
  { id: "kids", label: "Reproduce as Kids Story (5 RTC)" },
  { id: "gaming", label: "Reproduce as Gaming (5 RTC)" },
  { id: "a24", label: "Reproduce as A24 Short (5 RTC)" },
  { id: "original", label: "Reproduce Original Structure (5 RTC)" },
] as const;

function CloneInner() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [repro, setRepro] = useState<ReproduceResult | null>(null);

  async function analyze() {
    if (!url.trim()) {
      setMsg("Paste a YouTube / TikTok / Instagram link first.");
      return;
    }
    setBusy(true);
    setMsg("Analyzing viral structure…");
    setRepro(null);
    try {
      const data = await api<AnalyzeResult>("/api/clone/analyze", {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), ownerEmail: user?.email }),
      });
      setAnalysis(data);
      setMsg(`Analyzed (${data.analyze_rtc ?? 1} RTC). Ready to reproduce (${data.estimated_rtc ?? 5} RTC).`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reproduce(style: string) {
    if (!analysis?.cloneJobId) return;
    setBusy(true);
    setMsg(`Reproducing as ${style}… transformative remake (not a copy)`);
    try {
      const data = await api<ReproduceResult>("/api/clone/reproduce", {
        method: "POST",
        body: JSON.stringify({
          cloneJobId: analysis.cloneJobId,
          style,
          ownerEmail: user?.email,
        }),
      });
      setRepro(data);
      setMsg(data.message || "Remake queued");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto forge-in space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">YT-OS · /rs-clone</div>
          <h1 className="display text-4xl md:text-5xl">
            Viral <span className="bg-storm bg-clip-text text-transparent">Clone Factory</span>
          </h1>
          <p className="mt-2 text-white/55 text-sm max-w-xl">
            Paste a viral link. We extract structure only — then rewrite + remake with Seedance, Pixabay, and Sound
            Studio. Never copies source bytes.
          </p>
        </div>
        <Link href="/yt-os" className="mono text-[11px] text-white/40 hover:text-cyan shrink-0">
          ← YT-OS
        </Link>
      </div>

      <div className="rounded-rs-xl border border-white/[0.08] bg-panel/80 p-5 space-y-3">
        <label className="mono text-[10px] text-orange">PASTE LINK</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/shorts/… or TikTok / Instagram Reel"
          className="w-full h-12 rounded-rs bg-void border border-white/10 px-4 text-sm focus:outline-none focus:border-cyan/40"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void analyze()}
          className="h-12 px-6 rounded-rs bg-cyan text-black font-bold text-sm disabled:opacity-40"
        >
          {busy && !analysis ? "Analyzing…" : "Analyze (1 RTC)"}
        </button>
        <div className="mono text-[9px] text-white/35">
          Allowed: youtube.com · youtu.be · tiktok.com · instagram.com · Rate limit 10/hour
        </div>
      </div>

      {analysis && (
        <div className="rounded-rs-xl border border-violet/30 bg-deep p-5 space-y-4">
          <div className="flex gap-4 items-start">
            {analysis.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={analysis.thumbnail}
                alt=""
                className="w-28 h-40 object-cover rounded-rs border border-white/10"
              />
            ) : null}
            <div className="flex-1 space-y-2">
              <div className="mono text-[9px] text-cyan uppercase">{analysis.platform}</div>
              <div className="font-semibold text-lg leading-tight">{analysis.title}</div>
              <div className="mono text-[10px] text-white/40">
                {analysis.duration}s · {analysis.visual_style}
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="rounded-rs border border-white/10 p-3 text-sm">
              <div className="mono text-[9px] text-orange mb-1">HOOK (0–3s)</div>
              {analysis.hook}
            </div>
            <div className="rounded-rs border border-white/10 p-3 text-sm">
              <div className="mono text-[9px] text-orange mb-1">BODY (3 POINTS)</div>
              <ul className="list-disc pl-4 space-y-1">
                {(analysis.body_points || []).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-rs border border-white/10 p-3 text-sm">
              <div className="mono text-[9px] text-orange mb-1">CTA</div>
              {analysis.cta}
            </div>
          </div>

          <div className="mono text-[9px] text-white/35">{analysis.watermark}</div>

          <div className="grid sm:grid-cols-2 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => void reproduce(s.id)}
                className="h-11 rounded-rs bg-orange text-black font-bold text-[12px] disabled:opacity-40 px-3"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {repro && (
        <div className="rounded-rs-xl border border-cyan/30 bg-cyan/5 p-5 space-y-2">
          <div className="mono text-[10px] text-cyan">REMAKE · {repro.status}</div>
          <p className="text-sm text-white/70">{repro.message}</p>
          {repro.r2Url && (
            <a href={repro.r2Url} className="text-cyan text-sm hover:underline break-all" target="_blank" rel="noreferrer">
              {repro.r2Url}
            </a>
          )}
          {repro.rewrittenTranscript && (
            <pre className="text-xs text-white/50 whitespace-pre-wrap max-h-40 overflow-auto mt-2">
              {repro.rewrittenTranscript.slice(0, 1200)}
            </pre>
          )}
        </div>
      )}

      {msg && <div className="text-sm text-white/55">{msg}</div>}
    </div>
  );
}

export default function ClonePage() {
  return (
    <AuthProvider>
      <CloneInner />
    </AuthProvider>
  );
}
