"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api, getWsBase } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";

type Stage = {
  id: string;
  step: string;
  title: string;
  meta: string;
  engine: string;
};

type Movie = {
  title: string;
  selectedLogline: string;
  loglines: Array<{ id: string; text: string; tone: string; durationSec: number }>;
  worldBible: {
    characters: Array<{ stableId: string; name: string; role: string }>;
    locations: Array<{ stableId: string; name: string; angles: number }>;
    style: { lut: string; grain: number; accent: string };
  };
  sceneMap: Array<{ id: string; from: string; to: string; prompt: string; type: string }>;
  shotList: Array<{ id: string; sceneId: string; type: string; dur: number; status: string }>;
  budget: { rtcEstimate: number; archive5Blocks: number; notes: string };
  voiceover?: { text: string };
};

const ENGINE = ["SCRIPT", "WORLD", "STUDIO", "ARCHIVE", "MERGE"] as const;

const SOCIAL_HINTS = [
  "YouTube",
  "TikTok",
  "Instagram",
  "Facebook",
  "X",
  "Vimeo",
  "MP4",
] as const;

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function detectPlatform(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("youtube") || host === "youtu.be") return "YouTube";
    if (host.includes("tiktok")) return "TikTok";
    if (host.includes("instagram") || host === "instagr.am") return "Instagram";
    if (host.includes("facebook") || host.includes("fb.watch") || host === "fb.com") return "Facebook";
    if (host === "x.com" || host.includes("twitter")) return "X";
    if (host.includes("vimeo")) return "Vimeo";
    if (/\.(mp4|mov|webm)(\?|$)/i.test(new URL(url).pathname)) return "Direct MP4";
    return "Web video";
  } catch {
    return null;
  }
}

function WizardInner() {
  const { user, token } = useAuth();
  const [step, setStep] = useState(0);
  const [stages, setStages] = useState<Stage[]>([]);
  const [idea, setIdea] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [ideaTab, setIdeaTab] = useState<"idea" | "clone">("idea");
  const [audience, setAudience] = useState("Nollywood + global social");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [engine, setEngine] = useState<string>("SCRIPT");
  const [livePct, setLivePct] = useState(0);
  const [liveMsg, setLiveMsg] = useState("BOT Director standing by");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [voNote, setVoNote] = useState<string | null>(null);
  const [refUploadId, setRefUploadId] = useState<string | null>(null);
  const [refStatus, setRefStatus] = useState<string | null>(null);
  const [rtcBalance, setRtcBalance] = useState<number | null>(null);
  const [freeDemoUsed, setFreeDemoUsed] = useState(false);
  const [freeDemoGranted, setFreeDemoGranted] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const name = useMemo(() => {
    const raw = (user?.name || user?.email || "Producer").split(/[\s@._-]/)[0];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [user]);

  const platform = useMemo(() => (refUrl.trim() ? detectPlatform(refUrl.trim()) : null), [refUrl]);
  const canGenerate = idea.trim().length > 0 || looksLikeUrl(refUrl);
  const demoAvailable =
    Boolean(freeDemoGranted && !freeDemoUsed && (user?.tier === "free" || !user?.tier) && (rtcBalance ?? 0) === 1);
  const usedCount = freeDemoUsed ? 1 : 0;

  useEffect(() => {
    async function loadWallet() {
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const { getApiBase } = await import("@/lib/api");
        const res = await fetch(`${getApiBase()}/api/billing/wallet`, { headers });
        if (!res.ok) return;
        const d = (await res.json()) as {
          rtcBalance?: number;
          wallet?: { balanceRtc: number };
          freeDemo?: { granted: boolean; used: boolean };
        };
        setRtcBalance(d.rtcBalance ?? d.wallet?.balanceRtc ?? null);
        setFreeDemoGranted(Boolean(d.freeDemo?.granted));
        setFreeDemoUsed(Boolean(d.freeDemo?.used));
      } catch {
        /* ignore */
      }
    }
    void loadWallet();
  }, [token, user?.email]);

  useEffect(() => {
    api<{ stages: Stage[] }>("/api/blueprint/stages")
      .then((d) => setStages(d.stages))
      .catch(() =>
        setStages([
          { id: "welcome", step: "00", title: "Welcome", meta: "Director greets you", engine: "SCRIPT" },
          { id: "idea", step: "01", title: "1st Scene · Idea", meta: "Idea + link", engine: "SCRIPT" },
          { id: "script", step: "02", title: "Script · Voice", meta: "VO", engine: "SCRIPT" },
          { id: "world", step: "03", title: "World", meta: "CH_ / LOC_", engine: "WORLD" },
          { id: "scenes", step: "04", title: "Scene Map", meta: "1st→Hand", engine: "STUDIO" },
          { id: "shots", step: "05", title: "Shot List", meta: "Budget", engine: "ARCHIVE" },
          { id: "feed", step: "06", title: "Feed Factory", meta: "Go live", engine: "MERGE" },
        ]),
      );
  }, []);

  useEffect(() => {
    if (!blueprintId) return;
    const ws = new WebSocket(`${getWsBase()}/ws/blueprint/${blueprintId}`);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          engine?: string;
          percent?: number;
          message?: string;
          projectId?: string;
          uploadId?: string;
        };
        if (data.engine) setEngine(data.engine);
        if (typeof data.percent === "number") setLivePct(data.percent);
        if (data.message) setLiveMsg(data.message);
        if (data.projectId) setProjectId(data.projectId);
        if (data.uploadId) setRefUploadId(data.uploadId);
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [blueprintId]);

  useEffect(() => {
    if (!refUploadId) return;
    const ws = new WebSocket(`${getWsBase()}/ws/analysis/${refUploadId}`);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          percent?: number;
          message?: string;
          error?: string;
          stage?: string;
        };
        if (data.error) {
          setRefStatus(`Reference failed: ${data.error}`);
          return;
        }
        if (data.message) setRefStatus(data.message);
        if (data.stage) setLiveMsg(data.message || `Reference ${data.stage}`);
      } catch {
        /* ignore */
      }
    };
    const poll = setInterval(() => {
      api<{
        upload: { status: string; progressPct: number; progressMsg: string | null; error: string | null };
      }>(`/api/upload/video/${refUploadId}`)
        .then((d) => {
          if (d.upload.progressMsg) setRefStatus(d.upload.progressMsg);
          if (d.upload.error) setRefStatus(`Reference failed: ${d.upload.error}`);
        })
        .catch(() => undefined);
    }, 2500);
    return () => {
      ws.close();
      clearInterval(poll);
    };
  }, [refUploadId]);

  async function generate() {
    const ideaText = idea.trim();
    let url = refUrl.trim();
    if (!url && looksLikeUrl(ideaText)) url = ideaText;
    if (!ideaText && !url) {
      setMsg("Drop a raw idea and/or paste a YouTube / social video link.");
      return;
    }
    if (url && !looksLikeUrl(url)) {
      setMsg("Reference link must start with http:// or https://");
      return;
    }
    setBusy(true);
    setMsg(null);
    setProjectId(null);
    setRefStatus(url ? `Queuing ${detectPlatform(url) || "web"} reference…` : null);
    try {
      const data = await api<{
        blueprintId: string;
        movie: Movie;
        reference?: { uploadId?: string | null; kindLabel?: string | null } | null;
      }>("/api/blueprint/generate", {
        method: "POST",
        body: JSON.stringify({
          rawIdea: ideaText && !looksLikeUrl(ideaText) ? ideaText : undefined,
          videoUrl: url || undefined,
          audience,
          ownerEmail: user?.email,
        }),
      });
      setBlueprintId(data.blueprintId);
      setMovie(data.movie);
      if (data.reference?.uploadId) setRefUploadId(data.reference.uploadId);
      if (data.reference?.kindLabel) {
        setRefStatus(`${data.reference.kindLabel} reference downloading in background…`);
      }
      setStep(2);
      setLiveMsg(
        url
          ? "Blueprint locked — reference DNA extracting in LIVE ENGINE"
          : "Blueprint locked — walk the stages",
      );

      // Spend free demo RTC after successful blueprint (1-min funnel)
      if (demoAvailable && token) {
        try {
          const { getApiBase } = await import("@/lib/api");
          const burn = await fetch(`${getApiBase()}/api/billing/use-free-demo`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (burn.ok) {
            setFreeDemoUsed(true);
            setRtcBalance(0);
            setShowUpgrade(true);
          }
        } catch {
          /* non-fatal */
        }
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openSoundStudioVo() {
    const text = encodeURIComponent(movie?.voiceover?.text || movie?.selectedLogline || "");
    window.location.href = `/sound-studio?tab=tts&text=${text}`;
  }

  async function feedFactory() {
    if (!blueprintId) return;
    setBusy(true);
    setMsg(null);
    try {
      const data = await api<{ project: { id: string } }>("/api/projects/from-blueprint", {
        method: "POST",
        body: JSON.stringify({ blueprintId, ownerEmail: user?.email }),
      });
      setProjectId(data.project.id);
      setStep(6);
      setMsg(`Factory live — project ${data.project.id}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const current = stages[step] || stages[0];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col gap-4 forge-in max-w-[1400px]">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2">BOT DIRECTOR WIZARD // 7 STAGES</div>
          <h1 className="display text-4xl md:text-5xl">
            {step === 0 ? (
              <>
                Welcome, <span className="bg-storm bg-clip-text text-transparent">{name}</span>
              </>
            ) : (
              <>
                Director{" "}
                <span className="bg-storm bg-clip-text text-transparent">blueprint</span>
              </>
            )}
          </h1>
          <p className="mt-2 text-white/55 text-sm max-w-xl">
            Idea and/or YouTube · TikTok · Instagram · Facebook · X link in — Movie Blueprint out. Reference DNA
            feeds the factory.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="mono text-[10px] px-2.5 py-1 rounded-full border border-cyan/40 bg-cyan/10 text-cyan">
              FREE DEMO: 1 RTC (1 min) — {usedCount}/1 used
            </span>
            {rtcBalance !== null && (
              <span className="mono text-[10px] px-2.5 py-1 rounded-full border border-white/15 text-white/55">
                Balance {rtcBalance} RTC
              </span>
            )}
          </div>
          <p className="mt-2 text-[12px] text-white/45 max-w-xl">
            {demoAvailable
              ? "You have a 1-min free demo. Use it to generate your first scene. Upgrade to Premium for 25 mins."
              : freeDemoUsed
                ? "Free demo used — unlock Basic ($49 / 15 min) or Premium ($99 / 25 min) to keep directing."
                : "Sign in to claim your 1-min free demo from the System Bank."}
          </p>
        </div>
        <Link href="/dashboard" className="mono text-[11px] text-white/40 hover:text-cyan">
          ← Factory floor
        </Link>
      </div>

      {showUpgrade && (
        <div className="rounded-rs-xl border border-orange/40 bg-orange/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="display text-lg text-orange">Free demo used!</div>
            <p className="text-sm text-white/70 mt-1">
              Get 15 mins for $49 or 25 mins for $99 — unlock Archive5 + download.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/wallet?upgrade=storm"
              className="h-11 px-4 inline-flex items-center rounded-rs bg-violet text-white text-sm font-bold"
            >
              Unlock Archive5 — $49
            </Link>
            <Link
              href="/wallet?upgrade=storm_pro"
              className="h-11 px-4 inline-flex items-center rounded-rs bg-orange text-black text-sm font-bold"
            >
              Premium 25 mins — $99
            </Link>
            <button
              type="button"
              onClick={() => setShowUpgrade(false)}
              className="h-11 px-3 text-xs text-white/50"
            >
              Later
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[220px_1fr_280px] gap-4 flex-1 min-h-0">
        <aside className="rounded-rs-xl border border-white/[0.08] bg-deep p-3 space-y-1">
          {stages.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className={clsx(
                "w-full text-left px-3 py-2.5 rounded-rs border transition-colors",
                i === step
                  ? "bg-violet/20 border-violet/40"
                  : "border-transparent hover:bg-white/[0.03]",
              )}
            >
              <div className="mono text-[9px] text-cyan">{s.step}</div>
              <div className="text-[12px] font-semibold leading-tight mt-0.5">{s.title}</div>
              <div className="mono text-[8px] text-white/35 mt-1">{s.meta}</div>
            </button>
          ))}
        </aside>

        <section className="rounded-rs-xl border border-white/[0.08] bg-panel/80 p-5 flex flex-col min-h-[420px]">
          <div className="mono text-[11px] text-orange mb-3">
            {current?.step} · {current?.title}
          </div>

          {step === 0 && (
            <div className="space-y-4 flex-1">
              <p className="text-white/70 text-sm leading-relaxed">
                I&apos;m your BOT Director. Drop a raw idea, paste a YouTube or social video link (or both) — I&apos;ll
                walk 7 stages and hand a blueprint the factory can execute without guesswork.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SOCIAL_HINTS.map((h) => (
                  <span
                    key={h}
                    className="mono text-[9px] px-2 py-1 rounded-full border border-white/10 text-white/45"
                  >
                    {h}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-12 px-6 rounded-rs bg-cyan text-black font-bold text-sm"
              >
                Start directing →
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3 flex-1 flex flex-col">
              <div className="flex gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setIdeaTab("idea")}
                  className={clsx(
                    "mono text-[9px] px-3 py-1.5 rounded-rs border",
                    ideaTab === "idea"
                      ? "border-cyan/40 bg-cyan/10 text-cyan"
                      : "border-white/10 text-white/40",
                  )}
                >
                  Generate from Idea
                </button>
                <button
                  type="button"
                  onClick={() => setIdeaTab("clone")}
                  className={clsx(
                    "mono text-[9px] px-3 py-1.5 rounded-rs border",
                    ideaTab === "clone"
                      ? "border-orange/40 bg-orange/10 text-orange"
                      : "border-white/10 text-white/40",
                  )}
                >
                  Clone Viral Link
                </button>
              </div>

              {ideaTab === "clone" ? (
                <div className="flex-1 flex flex-col gap-3">
                  <p className="text-sm text-white/60">
                    Paste a YouTube Short / TikTok / Instagram Reel — analyze structure (1 RTC), then remake with your
                    brand (5 RTC). Transformative only — never copies source video.
                  </p>
                  <Link
                    href="/tools/clone"
                    className="h-12 rounded-rs bg-orange text-black font-bold text-sm flex items-center justify-center"
                  >
                    Open Viral Clone Factory →
                  </Link>
                  <Link href="/yt-os" className="mono text-[10px] text-cyan hover:underline">
                    Or browse all 11 YT-OS skills →
                  </Link>
                </div>
              ) : (
                <>
              <label className="mono text-[9px] text-white/40">RAW IDEA</label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder='e.g. "Vexo Garage FOMO 30s ad for Lagos youth"'
                className="flex-1 min-h-[110px] rounded-rs bg-void border border-white/10 p-4 text-sm resize-none focus:outline-none focus:border-cyan/40"
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="mono text-[9px] text-cyan">REFERENCE VIDEO LINK · WORKSTATION</label>
                  {platform && (
                    <span className="mono text-[9px] px-2 py-0.5 rounded-full border border-cyan/30 text-cyan">
                      {platform}
                    </span>
                  )}
                </div>
                <input
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canGenerate && void generate()}
                  placeholder="https://youtube.com/watch?v=…  ·  tiktok.com/@…  ·  instagram.com/reel/…  ·  mp4"
                  className="w-full h-12 rounded-rs bg-void border border-white/10 px-4 text-sm focus:outline-none focus:border-cyan/40"
                />
                <div className="mono text-[8px] text-white/35">
                  YouTube · TikTok · Instagram · Facebook · X · Vimeo · direct MP4 — yt-dlp pulls DNA into LIVE ENGINE
                </div>
              </div>

              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="h-11 rounded-rs bg-void border border-white/10 px-4 text-sm"
                placeholder="Audience"
              />
              <button
                type="button"
                disabled={busy || !canGenerate}
                onClick={() => void generate()}
                className="h-12 rounded-rs bg-orange text-black font-bold text-sm disabled:opacity-40"
              >
                {busy
                  ? refUrl.trim()
                    ? "Pulling reference + directing…"
                    : "Directing…"
                  : demoAvailable
                    ? "Use Free Demo (1 RTC) → Generate 1-min preview"
                    : refUrl.trim()
                      ? "Generate from idea + link"
                      : "Generate blueprint"}
              </button>
              {demoAvailable && (
                <div className="mono text-[9px] text-white/40">
                  480p watermarked · no download · burns your 1 RTC free demo
                </div>
              )}
                </>
              )}
            </div>
          )}

          {step === 2 && movie && (
            <div className="space-y-3 flex-1 overflow-auto">
              {refUrl.trim() && (
                <div className="rounded-rs border border-cyan/25 bg-cyan/5 px-3 py-2 text-xs text-cyan/90">
                  Reference: {detectPlatform(refUrl) || "Web"} · {refUrl.slice(0, 64)}
                  {refUrl.length > 64 ? "…" : ""}
                  {refStatus ? <div className="mono text-[9px] text-white/45 mt-1">{refStatus}</div> : null}
                </div>
              )}
              <div className="text-sm text-white/70">{movie.selectedLogline}</div>
              <div className="space-y-2">
                {movie.loglines.map((l) => (
                  <div key={l.id} className="rounded-rs border border-white/10 p-3 text-sm">
                    <div className="mono text-[9px] text-cyan">
                      {l.id} · {l.tone} · {l.durationSec}s
                    </div>
                    <div className="mt-1">{l.text}</div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  openSoundStudioVo();
                  setVoNote("Opening Sound Studio — sync, extract, clone, and TTS live there.");
                }}
                className="h-11 px-4 rounded-rs border border-cyan/40 text-cyan text-sm font-semibold"
              >
                Open Sound Studio for voice →
              </button>
              {voNote && <div className="text-xs text-white/50">{voNote}</div>}
              <button
                type="button"
                onClick={() => setStep(3)}
                className="h-11 rounded-rs bg-violet text-white text-sm font-bold px-4"
              >
                Next: World →
              </button>
            </div>
          )}

          {step === 3 && movie && (
            <div className="space-y-4 flex-1 overflow-auto">
              <div>
                <div className="mono text-[10px] text-cyan mb-2">CHARACTERS</div>
                {movie.worldBible.characters.map((c) => (
                  <div key={c.stableId} className="text-sm py-1.5 border-b border-white/[0.06]">
                    <span className="text-orange mono text-[10px]">{c.stableId}</span> {c.name} · {c.role}
                  </div>
                ))}
              </div>
              <div>
                <div className="mono text-[10px] text-cyan mb-2">LOCATIONS · 4-ANGLE</div>
                {movie.worldBible.locations.map((l) => (
                  <div key={l.stableId} className="text-sm py-1.5 border-b border-white/[0.06]">
                    <span className="text-cyan mono text-[10px]">{l.stableId}</span> {l.name} · {l.angles} plates
                  </div>
                ))}
              </div>
              <div className="mono text-[10px] text-white/40">
                LUT {movie.worldBible.style.lut} · grain {movie.worldBible.style.grain}
              </div>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="h-11 rounded-rs bg-violet text-white text-sm font-bold px-4"
              >
                Next: Scenes →
              </button>
            </div>
          )}

          {step === 4 && movie && (
            <div className="space-y-2 flex-1 overflow-auto">
              {movie.sceneMap.map((s) => (
                <div key={s.id} className="rounded-rs border border-white/10 p-3">
                  <div className="mono text-[9px] text-cyan">
                    {s.id} · {s.type} · {s.from} → {s.to}
                  </div>
                  <div className="text-sm mt-1">{s.prompt}</div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setStep(5)}
                className="h-11 rounded-rs bg-violet text-white text-sm font-bold px-4 mt-2"
              >
                Next: Shots →
              </button>
            </div>
          )}

          {step === 5 && movie && (
            <div className="space-y-3 flex-1 overflow-auto">
              <div className="rounded-rs border border-orange/30 bg-orange/10 p-3">
                <div className="mono text-[10px] text-orange">BUDGET</div>
                <div className="display text-2xl mt-1">{movie.budget.rtcEstimate} RTC</div>
                <div className="text-xs text-white/50">{movie.budget.notes}</div>
              </div>
              <div className="overflow-auto max-h-[240px]">
                <table className="w-full text-left text-xs">
                  <thead className="mono text-[9px] text-white/40">
                    <tr>
                      <th className="py-2">SHOT</th>
                      <th>SCENE</th>
                      <th>TYPE</th>
                      <th>DUR</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movie.shotList.map((sh) => (
                      <tr key={sh.id} className="border-t border-white/[0.06]">
                        <td className="py-2 text-cyan">{sh.id}</td>
                        <td>{sh.sceneId}</td>
                        <td>{sh.type}</td>
                        <td>{sh.dur}s</td>
                        <td>{sh.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setStep(6)}
                className="h-11 rounded-rs bg-violet text-white text-sm font-bold px-4"
              >
                Next: Feed Factory →
              </button>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 flex-1">
              <p className="text-sm text-white/70">
                Blueprint {blueprintId || "—"} is ready. Feed it into the factory to spawn Soul IDs, rooms, storyboard,
                then run Studio → Archive5 → Merge.
              </p>
              {refStatus && <div className="text-xs text-cyan/80 mono">{refStatus}</div>}
              <button
                type="button"
                disabled={busy || !blueprintId}
                onClick={() => void feedFactory()}
                className="h-12 px-6 rounded-rs bg-orange text-black font-bold text-sm disabled:opacity-40"
              >
                {busy ? "Feeding…" : "Feed Factory → See Magic"}
              </button>
              {projectId && (
                <Link href={`/projects/${projectId}`} className="block text-cyan text-sm hover:underline">
                  Open project {projectId} →
                </Link>
              )}
            </div>
          )}

          {msg && <div className="mt-4 text-sm text-white/60">{msg}</div>}
          {!movie && step > 1 && step < 6 && (
            <div className="text-sm text-white/40">Generate a blueprint from step 01 first.</div>
          )}
        </section>

        <aside className="rounded-rs-xl border border-white/[0.08] bg-deep p-4 space-y-4">
          <div className="mono text-[11px] text-cyan">LIVE ENGINE</div>
          <div className="space-y-2">
            {ENGINE.map((e) => (
              <div
                key={e}
                className={clsx(
                  "rounded-rs border px-3 py-2 mono text-[10px] flex items-center justify-between",
                  engine === e
                    ? "border-cyan/50 bg-cyan/10 text-cyan"
                    : "border-white/10 text-white/35",
                )}
              >
                <span>{e}</span>
                {engine === e && <span className="w-1.5 h-1.5 rounded-full bg-cyan live-dot" />}
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between mono text-[9px] text-white/40 mb-1">
              <span>PROGRESS</span>
              <span>{livePct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full progress-bar" style={{ width: `${livePct}%` }} />
            </div>
            <div className="text-[11px] text-white/50 mt-2">{liveMsg}</div>
            {refStatus && <div className="text-[10px] text-cyan/70 mt-2 mono">{refStatus}</div>}
          </div>
          {movie && (
            <div className="rounded-rs border border-white/10 p-3">
              <div className="mono text-[9px] text-orange">RTC PREVIEW</div>
              <div className="display text-xl mt-1">{movie.budget.rtcEstimate}</div>
              <div className="mono text-[8px] text-white/35">{movie.budget.archive5Blocks} ARCHIVE5</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function WizardPage() {
  return (
    <AuthProvider>
      <WizardInner />
    </AuthProvider>
  );
}
