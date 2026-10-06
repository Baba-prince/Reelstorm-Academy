"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBase } from "@/lib/api";
import clsx from "clsx";

type CheckStatus = "pass" | "partial" | "fail" | "unknown";

type Check = {
  id: string;
  area: string;
  item: string;
  weight: number;
  status: CheckStatus;
  detail: string;
};

type Production1k = {
  ready?: boolean;
  pct?: number;
  grade?: string;
  blocking?: string[];
  webhookUrl?: string;
};

const STATIC: Array<Omit<Check, "status" | "detail"> & { status: CheckStatus; detail: string }> = [
  { id: "brand", area: "Brand", item: "Brand Kit 01 tokens + dark OS chrome", weight: 4, status: "pass", detail: "Applied across pages" },
  { id: "pages", area: "Frontend", item: "Factory pages · Forge · Templates · Wallet · Onboarding", weight: 6, status: "pass", detail: "Next production build OK" },
  { id: "forgeUi", area: "Differentiator", item: "Template Forge upload + URL extract + Apply Generate", weight: 8, status: "pass", detail: "Same-origin API/WS · reactive Apply" },
  { id: "onboard", area: "Frontend", item: "Onboarding ideals + dashboard welcome by name", weight: 4, status: "pass", detail: "Nollywood/Asia/social packs · Welcome / Welcome back" },
  { id: "tests", area: "Quality", item: "Smoke + production API check scripts", weight: 3, status: "pass", detail: "npm run smoke · npm run check:apis · check:apis:live" },
];

const LIVE_MAP: Array<{ id: string; area: string; item: string; weight: number; key: string }> = [
  { id: "api", area: "API", item: "Fastify health + routes", weight: 6, key: "api" },
  { id: "db", area: "Data", item: "Supabase Postgres via Prisma", weight: 8, key: "db" },
  { id: "redis", area: "Infra", item: "Redis BullMQ (db 17 · databases 32)", weight: 8, key: "redis" },
  { id: "ffmpeg", area: "Media", item: "ffmpeg binary (analyze/split/merge)", weight: 6, key: "ffmpeg" },
  { id: "ffprobe", area: "Media", item: "ffprobe (Template Forge Video Intelligence)", weight: 8, key: "ffprobe" },
  { id: "ytdlp", area: "Media", item: "yt-dlp for web reference download", weight: 5, key: "ytdlp" },
  { id: "urlExtract", area: "Differentiator", item: "POST /api/upload/video/from-url", weight: 5, key: "urlExtract" },
  { id: "disk", area: "Infra", item: "Upload volume free space (≥50 GiB)", weight: 4, key: "disk" },
  { id: "s3", area: "Infra", item: "Object storage S3/R2 (not local MinIO)", weight: 8, key: "s3" },
  { id: "auth", area: "Security", item: "Supabase + Google OAuth", weight: 6, key: "auth" },
            { id: "llm", area: "AI", item: "Production LLM (DashScope / Ollama)", weight: 6, key: "llm" },
            { id: "stripe", area: "Billing", item: "Stripe live + webhook", weight: 8, key: "prod_stripe" },
            { id: "video", area: "AI", item: "Seedance video (MOCK_VIDEO_GEN=0)", weight: 8, key: "prod_video_gen" },
            { id: "sound", area: "Audio", item: "Sound Studio voice OS", weight: 8, key: "prod_sound_studio" },
            { id: "intros", area: "Templates", item: "Stock intros R2 cache (≥100)", weight: 6, key: "intro_cache" },
            { id: "workers", area: "Scale", item: "Worker concurrency ≥8", weight: 4, key: "prod_worker_concurrency" },
];

function scoreOf(status: CheckStatus, weight: number) {
  if (status === "pass") return weight;
  if (status === "partial") return weight * 0.5;
  if (status === "unknown") return weight * 0.25;
  return 0;
}

function grade(pct: number) {
  if (pct >= 90) return { letter: "A", label: "SHIP-READY", color: "text-cyan" };
  if (pct >= 75) return { letter: "B", label: "BETA-READY", color: "text-violet-soft" };
  if (pct >= 60) return { letter: "C", label: "LOCAL MVP", color: "text-orange" };
  if (pct >= 40) return { letter: "D", label: "SCAFFOLD", color: "text-orange-soft" };
  return { letter: "F", label: "BLOCKED", color: "text-red-400" };
}

export default function ScorecardPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [apiLive, setApiLive] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [apiVersion, setApiVersion] = useState<string | null>(null);
  const [prod1k, setProd1k] = useState<Production1k | null>(null);

  async function scan() {
    setScanning(true);
    const live: Check[] = [...STATIC];

    try {
      const res = await fetch(`${getApiBase()}/api/readiness`);
      if (res.ok) {
        setApiLive(true);
        const data = (await res.json()) as {
          version?: string;
          pct: number;
          checks: Record<string, { status: CheckStatus; detail: string }>;
          production1k?: Production1k;
        };
        setApiVersion(data.version || null);
        setProd1k(data.production1k || null);
        for (const m of LIVE_MAP) {
          const c = data.checks[m.key];
          live.push({
            id: m.id,
            area: m.area,
            item: m.item,
            weight: m.weight,
            status: c?.status || "unknown",
            detail: c?.detail || "—",
          });
        }
      } else {
        setApiLive(false);
        setProd1k(null);
        live.push({
          id: "api",
          area: "API",
          item: "Fastify health",
          weight: 10,
          status: "fail",
          detail: `HTTP ${res.status}`,
        });
      }
    } catch {
      setApiLive(false);
      setProd1k(null);
      live.push({
        id: "api",
        area: "API",
        item: "Fastify health",
        weight: 10,
        status: "fail",
        detail: "API not reachable",
      });
    }

    setChecks(live);
    setScanning(false);
  }

  useEffect(() => {
    void scan();
  }, []);

  const { earned, total, pct, g } = useMemo(() => {
    const total = checks.reduce((a, c) => a + c.weight, 0) || 1;
    const earned = checks.reduce((a, c) => a + scoreOf(c.status, c.weight), 0);
    const shown = Math.round((earned / total) * 100);
    return { earned, total, pct: shown, g: grade(shown) };
  }, [checks]);

  return (
    <div className="max-w-[1100px] space-y-8 forge-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">
            PRODUCTION BUILD SCORECARD // v1.5 · soft-launch · 1k gates
            {apiVersion ? ` · API ${apiVersion}` : ""}
          </div>
          <h1 className="display text-4xl md:text-5xl">
            Ship{" "}
            <span className="bg-storm bg-clip-text text-transparent">readiness</span>
          </h1>
          <p className="mt-3 text-white/60 max-w-xl text-[15px]">
            Live scan: forge media stack, Redis, Stripe, DashScope/Seedance, Sound Studio, R2, worker scale.
            {scanning ? " Scanning…" : ` API ${apiLive ? "online" : "offline"}.`}
          </p>
        </div>

        <div className="rounded-rs-xl border border-white/[0.08] bg-panel px-6 py-5 min-w-[200px] text-center">
          <div className={clsx("display text-6xl", g.color)}>{g.letter}</div>
          <div className="mono text-[11px] text-white/50 mt-1">{g.label}</div>
          <div className="mt-3 text-3xl font-black">{pct}%</div>
          <div className="mono text-[9px] text-white/35 mt-1">
            {earned.toFixed(1)} / {total} pts
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full progress-bar" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {prod1k && (
        <section
          className={clsx(
            "rounded-rs-xl border p-5",
            prod1k.ready
              ? "border-cyan/40 bg-cyan/10"
              : "border-orange/30 bg-orange/5",
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="mono text-[11px] text-cyan">PRODUCTION 1K GATE</div>
              <div className="display text-2xl mt-1">
                {prod1k.ready ? "Ready for ~1000 users" : "Not ready — secrets still missing"}
              </div>
              <p className="text-sm text-white/55 mt-1">
                API grade {prod1k.grade || "—"} · {prod1k.pct ?? "—"}%
                {prod1k.webhookUrl ? ` · webhook ${prod1k.webhookUrl}` : ""}
              </p>
            </div>
            <div
              className={clsx(
                "mono text-[10px] px-3 py-2 rounded-full border w-fit",
                prod1k.ready
                  ? "bg-cyan text-black border-cyan"
                  : "bg-orange/20 text-orange border-orange/40",
              )}
            >
              {prod1k.ready ? "READY" : "BLOCKED"}
            </div>
          </div>
          {!prod1k.ready && prod1k.blocking && prod1k.blocking.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {prod1k.blocking.map((b) => (
                <span
                  key={b}
                  className="mono text-[9px] px-2 py-1 rounded-full border border-white/15 text-white/50"
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: "PASS", n: checks.filter((c) => c.status === "pass").length, cls: "text-cyan border-cyan/30 bg-cyan/10" },
          { label: "PARTIAL", n: checks.filter((c) => c.status === "partial").length, cls: "text-orange border-orange/30 bg-orange/10" },
          { label: "FAIL", n: checks.filter((c) => c.status === "fail").length, cls: "text-red-400 border-red-400/30 bg-red-400/10" },
        ].map((s) => (
          <div key={s.label} className={clsx("rounded-rs border px-4 py-3", s.cls)}>
            <div className="mono text-[10px]">{s.label}</div>
            <div className="text-2xl font-black mt-1">{s.n}</div>
          </div>
        ))}
      </div>

      <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
        <div className="h-12 px-5 flex items-center justify-between border-b border-white/[0.06] bg-panel">
          <span className="mono text-[11px]">CRITERIA</span>
          <button
            type="button"
            className="mono text-[9px] text-cyan disabled:opacity-40"
            disabled={scanning}
            onClick={() => void scan()}
          >
            {scanning ? "SCANNING…" : "RE-SCAN"}
          </button>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {checks.map((c) => (
            <div key={c.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="sm:w-28 mono text-[9px] text-white/40">{c.area}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{c.item}</div>
                <div className="text-xs text-white/45 mt-0.5 break-all">{c.detail}</div>
              </div>
              <div className="mono text-[9px] text-white/30 w-10">{c.weight}pt</div>
              <span
                className={clsx(
                  "mono text-[9px] px-2 py-1 rounded-full border w-fit",
                  c.status === "pass" && "bg-cyan/20 text-cyan border-cyan/30",
                  c.status === "partial" && "bg-orange/20 text-orange border-orange/30",
                  c.status === "fail" && "bg-red-500/15 text-red-400 border-red-400/30",
                  c.status === "unknown" && "bg-white/5 text-white/40 border-white/10",
                )}
              >
                {c.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
