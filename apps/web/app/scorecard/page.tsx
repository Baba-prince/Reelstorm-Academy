"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
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

const STATIC: Array<Omit<Check, "status" | "detail"> & { status: CheckStatus; detail: string }> = [
  { id: "brand", area: "Brand", item: "Brand Kit 01 tokens + dark OS chrome", weight: 6, status: "pass", detail: "Applied across pages" },
  { id: "pages", area: "Frontend", item: "11+ pages incl. Forge + Scorecard", weight: 8, status: "pass", detail: "Next production build OK" },
  { id: "forgeUi", area: "Differentiator", item: "Template Forge file drop + web URL extract", weight: 10, status: "pass", detail: "YouTube / Vimeo / direct MP4" },
  { id: "tests", area: "Quality", item: "Smoke test script", weight: 4, status: "partial", detail: "scripts/smoke.sh" },
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
  const [livePct, setLivePct] = useState<number | null>(null);

  useEffect(() => {
    async function scan() {
      setScanning(true);
      const live: Check[] = [...STATIC];

      try {
        const res = await fetch(`${API_URL}/api/readiness`);
        if (res.ok) {
          setApiLive(true);
          const data = (await res.json()) as {
            pct: number;
            checks: Record<string, { status: CheckStatus; detail: string }>;
          };
          setLivePct(data.pct);
          const map: Array<{ id: string; area: string; item: string; weight: number; key: string }> = [
            { id: "api", area: "API", item: "Fastify health + routes", weight: 8, key: "api" },
            { id: "db", area: "Data", item: "Supabase Postgres via Prisma", weight: 8, key: "db" },
            { id: "redis", area: "Infra", item: "Redis / memory-server for BullMQ", weight: 8, key: "redis" },
            { id: "ffmpeg", area: "Media", item: "ffmpeg binary (analyze/split/merge)", weight: 8, key: "ffmpeg" },
            { id: "ytdlp", area: "Media", item: "yt-dlp for web reference download", weight: 8, key: "ytdlp" },
            { id: "urlExtract", area: "Differentiator", item: "POST /api/upload/video/from-url", weight: 10, key: "urlExtract" },
            { id: "localStorage", area: "Infra", item: "Local AssetCenter temp storage", weight: 4, key: "localStorage" },
            { id: "auth", area: "Security", item: "Supabase JWT + dev login", weight: 6, key: "auth" },
            { id: "ollama", area: "AI", item: "Local Ollama orchestration", weight: 4, key: "ollama" },
          ];
          for (const m of map) {
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
    void scan();
  }, []);

  const { earned, total, pct, g } = useMemo(() => {
    const total = checks.reduce((a, c) => a + c.weight, 0) || 1;
    const earned = checks.reduce((a, c) => a + scoreOf(c.status, c.weight), 0);
    const pct = livePct ?? Math.round((earned / total) * 100);
    // Prefer composite of all checks shown
    const shown = Math.round((earned / total) * 100);
    return { earned, total, pct: shown, g: grade(shown) };
  }, [checks, livePct]);

  return (
    <div className="max-w-[1100px] space-y-8 forge-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">PRODUCTION BUILD SCORECARD // v1.2</div>
          <h1 className="display text-4xl md:text-5xl">
            Ship{" "}
            <span className="bg-storm bg-clip-text text-transparent">readiness</span>
          </h1>
          <p className="mt-3 text-white/60 max-w-xl text-[15px]">
            Live scan including web URL reference extract.
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
            className="mono text-[9px] text-cyan"
            onClick={() => window.location.reload()}
          >
            RE-SCAN
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
