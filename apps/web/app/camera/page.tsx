"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { openStormGuide } from "@/components/guide/PageStartCoach";
import { PodStatusIndicator } from "@/components/PodStatusIndicator";

type PromptRow = {
  command: string;
  label: string;
  category: string;
  keywords: string;
  prompt: string;
  lens: string;
  movement: string;
  useCase: string;
  previewR2Url?: string;
};

type Analysis = {
  currentAngle?: string;
  detectedLens?: string;
  composition?: string;
  lighting?: string;
  subject?: string;
  confidence?: number;
  engine?: string;
};

type Job = {
  id: string;
  status: string;
  sourceR2Url?: string | null;
  keyframes?: Array<{ time: number; r2Url: string }> | null;
  analysis?: Analysis | null;
  prompts?: PromptRow[] | null;
  previews?: Record<string, string> | null;
  logs?: string[] | null;
  error?: string | null;
  rtcCost?: number;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "dario", label: "Dario 5" },
  { id: "angle", label: "Angles" },
  { id: "movement", label: "Moves" },
  { id: "lens", label: "Lens" },
] as const;

const STEPS = ["UPLOADING", "EXTRACTING", "ANALYZING", "GENERATING_PROMPTS", "DONE"] as const;

const SEND_TO = [
  { label: "World Builder (4-angle locations)", href: "/world-builder", color: "#00f0ff" },
  { label: "Shot List (framing)", href: "/wizard", color: "#8b5cf6" },
  { label: "Studio Set", href: "/studio-set", color: "#ffe600" },
  { label: "Avatar Studio", href: "/model-center/avatar", color: "#00f0ff" },
  { label: "YouTube Thumbnail", href: "/yt-os", color: "#ff7a00" },
] as const;

const DARIO_CMDS = new Set(["/BTS", "/Adcreative", "/Blueprint", "/Droneview", "/Explodeview"]);

function catKey(c: string) {
  const x = (c || "").toLowerCase();
  if (x.includes("dario")) return "dario";
  if (x.includes("move")) return "movement";
  if (x.includes("lens")) return "lens";
  if (x === "dario" || x === "angle" || x === "movement" || x === "lens") return x;
  return "angle";
}

function accentFor(p: PromptRow) {
  if (DARIO_CMDS.has(p.command) || catKey(p.category) === "dario") return "#ff7a00";
  if (catKey(p.category) === "movement" || catKey(p.category) === "lens") return "#8b5cf6";
  return "#00f0ff";
}

function CameraInner() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const [asyncMode, setAsyncMode] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "[ENGINE] Ready — awaiting input",
    "[SYSTEM] Flux ComfyUI nodes loaded",
    "[RTC] Analyze 2 · Preview 1",
  ]);
  const [compareCmd, setCompareCmd] = useState<string | null>(null);
  const [slider, setSlider] = useState(50);
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pushLog = useCallback((line: string) => {
    setLogs((prev) => [...prev.slice(-40), line]);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  useEffect(() => {
    if (!job?.id || job.status === "DONE" || job.status === "FAILED" || !asyncMode) return;
    const t = window.setInterval(async () => {
      try {
        const res = await api<{ job?: Job }>(`/api/camera/status?id=${job.id}`);
        if (res.job) {
          setJob(res.job);
          if (Array.isArray(res.job.logs) && res.job.logs.length) {
            setLogs((prev) => {
              const merged = [...prev];
              for (const l of res.job!.logs!) {
                if (!merged.includes(l)) merged.push(l);
              }
              return merged.slice(-50);
            });
          }
        }
      } catch {
        /* */
      }
    }, 2500);
    return () => window.clearInterval(t);
  }, [job?.id, job?.status, asyncMode]);

  async function fileToBase64(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function runAnalyze() {
    if (!url.trim() && !file) {
      setMsg("Drop an image/video or paste a YouTube / Instagram URL.");
      pushLog("[ERROR] No source — drop file or paste URL");
      return;
    }
    setBusy(true);
    setMsg(null);
    setJob(null);
    setCompareCmd(null);
    if (file) pushLog(`[UPLOAD] ${file.name} — ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    if (url.trim()) pushLog(`[LINK] ${url.trim().slice(0, 80)}`);
    pushLog("[ANALYZE] Starting vision pipeline — CLIP + Florence-2");
    try {
      const body: Record<string, unknown> = {
        url: url.trim() || undefined,
        ownerEmail: user?.email,
      };
      if (file) {
        body.fileBase64 = await fileToBase64(file);
        body.fileName = file.name;
        body.mimeType = file.type;
      }
      const path = asyncMode ? "/api/camera/orchestrate?async=1" : "/api/camera/orchestrate";
      const res = await api<Job & { ok?: boolean; jobId?: string; async?: boolean; error?: string }>(
        path,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (res.async && res.jobId) {
        setJob({ id: res.jobId, status: "UPLOADING" });
        setMsg("Queued — extracting frames & generating 30+ prompts…");
        pushLog(`[QUEUE] job ${res.jobId.slice(0, 10)} — BullMQ cameraAngleGenerator`);
      } else {
        const next = { ...res, id: res.jobId || res.id };
        setJob(next);
        const conf =
          next.analysis?.confidence != null
            ? Math.round(Number(next.analysis.confidence) * 100)
            : null;
        if (next.analysis?.currentAngle) {
          pushLog(
            `[DETECT] ${next.analysis.currentAngle}${conf != null ? ` — confidence ${conf}%` : ""}`,
          );
        }
        if (Array.isArray(next.keyframes) && next.keyframes.length) {
          pushLog(`[KEYFRAMES] Extracted ${next.keyframes.length} keyframes`);
        }
        const n = Array.isArray(next.prompts) ? next.prompts.length : 0;
        pushLog(`[DONE] Analysis complete — ${n} prompts ready`);
        setMsg(next.status === "DONE" ? `${n} angle prompts ready.` : `Status: ${next.status}`);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : "Analyze failed";
      setMsg(err);
      pushLog(`[FAILED] ${err}`);
    } finally {
      setBusy(false);
    }
  }

  const prompts = useMemo(() => {
    const list = job?.prompts || [];
    return list.filter((p) => {
      const cat = catKey(p.category);
      if (filter !== "all" && cat !== filter && !(filter === "dario" && DARIO_CMDS.has(p.command))) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.command.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.keywords.toLowerCase().includes(q)
      );
    });
  }, [job?.prompts, filter, search]);

  const darioPack = useMemo(
    () => (job?.prompts || []).filter((p) => DARIO_CMDS.has(p.command)),
    [job?.prompts],
  );

  const progress = Math.max(0, STEPS.indexOf((job?.status || "UPLOADING") as (typeof STEPS)[number]));

  const copyPrompt = useCallback(
    async (p: PromptRow) => {
      try {
        await navigator.clipboard.writeText(p.prompt);
        setCopied(p.command);
        pushLog(`[COPY] ${p.command} prompt copied`);
        window.setTimeout(() => setCopied(null), 1500);
      } catch {
        setMsg("Copy failed — select text manually.");
      }
    },
    [pushLog],
  );

  async function genPreview(command: string) {
    if (!job?.id) return;
    setPreviewBusy(command);
    pushLog(`[GENERATE] ${command} — 1 RTC — Flux preview`);
    try {
      const res = await api<{ previewR2Url?: string; command?: string }>(
        "/api/camera/generate-preview",
        {
          method: "POST",
          body: JSON.stringify({ jobId: job.id, command, ownerEmail: user?.email }),
        },
      );
      const cmd = res.command || command;
      setJob((prev) => {
        if (!prev) return prev;
        const nextPrompts = (prev.prompts || []).map((p) =>
          p.command === cmd ? { ...p, previewR2Url: res.previewR2Url } : p,
        );
        return {
          ...prev,
          prompts: nextPrompts,
          previews: { ...(prev.previews || {}), [cmd]: res.previewR2Url || "" },
        };
      });
      setCompareCmd(cmd);
      setSlider(50);
      pushLog(`[PREVIEW] ${cmd} ready — before/after updated`);
    } catch (e) {
      const err = e instanceof Error ? e.message : "Preview failed";
      setMsg(err);
      pushLog(`[FAILED] ${err}`);
    } finally {
      setPreviewBusy(null);
    }
  }

  const comparePreview =
    compareCmd &&
    ((job?.prompts || []).find((p) => p.command === compareCmd)?.previewR2Url ||
      job?.previews?.[compareCmd]);
  const sourceStill =
    job?.sourceR2Url && !job.sourceR2Url.match(/\.(mp4|webm|mov)/i)
      ? job.sourceR2Url
      : job?.keyframes?.[0]?.r2Url || job?.sourceR2Url || "";

  return (
    <div className="max-w-[1240px] space-y-6 forge-in pb-20" style={{ background: "transparent" }}>
      {/* Header — artifact */}
      <div className="rounded-rs-xl border border-[#00f0ff]/25 bg-[#0a0a0a] overflow-hidden">
        <div className="px-5 py-5 md:px-7 md:py-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="mono text-[10px] md:text-[11px] text-[#00f0ff] mb-2 tracking-[0.16em]">
              CAMERA ANGLE PROMPT GENERATOR // 30+ PRO ANGLES FROM ANY IMAGE/VIDEO/LINK
            </div>
            <h1 className="display text-3xl md:text-5xl leading-[0.95]">
              Type this to get this.
            </h1>
            <p className="mt-3 text-white/55 max-w-2xl text-[14px] leading-relaxed">
              Upload image/video or paste YouTube/Instagram URL → Get pro prompt keywords for every
              angle.{" "}
              <span className="text-[#ff7a00]">
                /BTS /Adcreative /Blueprint /Droneview /Explodeview
              </span>{" "}
              + LowAngle, BirdsEye, Orbit, Anamorphic — ComfyUI Flux ready.
            </p>
            <div className="mt-3 mono text-[10px] text-white/35 tracking-wide">
              wizard / camera-angles · Supports: YouTube 4K, Reels, TikTok · Auto keyframe extraction
              · CLIP ViT-L/14
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center shrink-0">
            <PodStatusIndicator />
            <button
              type="button"
              onClick={() => openStormGuide("Where do I start on Camera Angle Studio?")}
              className="h-10 px-4 rounded-rs border border-white/15 text-[12px] text-white/70"
            >
              Guide
            </button>
            <div className="mono text-[11px] px-3 py-2 rounded-rs border border-[#00f0ff]/35 text-[#00f0ff] bg-[#00f0ff]/5">
              2 RTC analyze · 1 RTC preview
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* Source */}
        <section className="rounded-rs-xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
          <div className="h-11 px-5 flex items-center justify-between border-b border-white/[0.06] bg-[#121212] mono text-[11px] text-[#00f0ff] tracking-[0.12em]">
            <span>01 — SOURCE</span>
            <span className="text-white/30 normal-case tracking-normal">image · video · link</span>
          </div>
          <div className="p-5 space-y-4">
            <label className="block">
              <span className="mono text-[10px] text-white/40">YOUTUBE / INSTAGRAM / TIKTOK URL</span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://instagram.com/reel/DeUDJImj9q2/ or youtube.com/watch?v=…"
                className="mt-1 w-full h-12 rounded-rs bg-[#141414] border border-white/10 px-4 text-[14px] focus:border-[#00f0ff]/50 focus:outline-none"
              />
            </label>
            <div
              className={clsx(
                "rounded-rs border border-dashed px-4 py-10 text-center cursor-pointer transition",
                file
                  ? "border-[#00f0ff]/50 bg-[#00f0ff]/5"
                  : "border-white/15 bg-[#141414]/80 hover:border-[#00f0ff]/30",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  setFile(f);
                  pushLog(`[UPLOAD] ${f.name} — ${(f.size / 1024 / 1024).toFixed(2)}MB`);
                }
              }}
              onClick={() => fileRef.current?.click()}
            >
              <div className="mono text-[10px] text-white/40 mb-2">DROP IMAGE / VIDEO HERE</div>
              <div className="text-[13px] text-white/55">
                {file ? (
                  <span className="text-[#00f0ff]">{file.name}</span>
                ) : (
                  "jpg · png · webp · mp4 — or paste a reel URL above"
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/webm"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  if (f) pushLog(`[UPLOAD] ${f.name} — ${(f.size / 1024 / 1024).toFixed(2)}MB`);
                }}
                className="hidden"
              />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAnalyze()}
                className="h-12 px-8 rounded-rs bg-[#00f0ff] text-black font-bold text-[14px] disabled:opacity-50 shadow-[0_0_24px_rgba(0,240,255,0.25)]"
              >
                {busy ? "Analyzing…" : "Analyze → 30+ Prompts"}
              </button>
              <label className="flex items-center gap-2 text-[13px] text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={asyncMode}
                  onChange={(e) => setAsyncMode(e.target.checked)}
                />
                Async BullMQ
              </label>
            </div>
          </div>
        </section>

        {/* Console */}
        <aside className="rounded-rs-xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden flex flex-col min-h-[280px]">
          <div className="h-11 px-4 flex items-center border-b border-white/[0.06] bg-[#121212] mono text-[10px] text-[#8b5cf6] tracking-[0.14em]">
            SYSTEM CONSOLE
          </div>
          <div
            ref={logRef}
            className="flex-1 p-3 mono text-[10px] leading-relaxed text-white/55 overflow-y-auto max-h-[340px] space-y-1"
          >
            {logs.map((l, i) => (
              <div
                key={`${i}-${l.slice(0, 24)}`}
                className={clsx(
                  l.includes("FAILED") || l.includes("ERROR")
                    ? "text-orange"
                    : l.includes("DONE") || l.includes("PREVIEW")
                      ? "text-[#00f0ff]"
                      : l.includes("DETECT")
                        ? "text-[#8b5cf6]"
                        : "",
                )}
              >
                {l}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {msg && (
        <div className="rounded-rs border border-white/10 bg-[#121212] px-4 py-3 text-[13px] text-white/70">
          {msg}
        </div>
      )}

      {job && (
        <>
          <section className="rounded-rs-xl border border-white/[0.08] bg-[#0a0a0a] p-5">
            <div className="mono text-[10px] text-[#ff7a00] mb-4 tracking-[0.14em]">
              PIPELINE · {job.status} · {job.id.slice(0, 10)}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={clsx(
                    "rounded-rs border px-2 py-3 text-center",
                    i <= progress
                      ? "border-[#00f0ff]/40 bg-[#00f0ff]/10 text-[#00f0ff]"
                      : "border-white/10 text-white/30",
                  )}
                >
                  <div className="mono text-[9px]">{String(i + 1).padStart(2, "0")}</div>
                  <div className="text-[10px] mt-1 font-medium">{s.replace("_", " ")}</div>
                </div>
              ))}
            </div>
            {job.error && <p className="mt-3 text-orange text-[13px]">{job.error}</p>}
          </section>

          {(job.sourceR2Url || job.analysis) && (
            <section className="grid md:grid-cols-2 gap-4">
              <div className="rounded-rs-xl border border-white/[0.08] bg-[#0a0a0a] p-4">
                <div className="mono text-[10px] text-white/40 mb-2">SOURCE / KEYFRAMES</div>
                {job.sourceR2Url?.match(/\.(mp4|webm|mov)/i) ? (
                  <video
                    src={job.sourceR2Url}
                    controls
                    className="w-full rounded-rs border border-white/10"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sourceStill}
                    alt="Source"
                    className="w-full rounded-rs border border-white/10 object-cover max-h-72"
                  />
                )}
                {Array.isArray(job.keyframes) && job.keyframes.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {job.keyframes.map((k) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={k.r2Url}
                        src={k.r2Url}
                        alt={`t=${k.time}`}
                        className="h-16 w-24 object-cover rounded border border-white/10 shrink-0"
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-rs-xl border border-[#00f0ff]/25 bg-[#0a0a0a] p-5 space-y-3">
                <div className="mono text-[10px] text-[#00f0ff] tracking-[0.14em]">
                  CURRENT ANGLE DETECTED
                </div>
                <div className="display text-2xl md:text-3xl">
                  {job.analysis?.currentAngle || "—"}
                  {job.analysis?.detectedLens ? (
                    <span className="text-white/35 text-xl">, {job.analysis.detectedLens}</span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 text-[13px] text-white/60">
                  <div>
                    <span className="mono text-[9px] text-white/35">CONFIDENCE</span>
                    <div className="text-[#00f0ff]">
                      {job.analysis?.confidence != null
                        ? `${Math.round(Number(job.analysis.confidence) * 100)}%`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <span className="mono text-[9px] text-white/35">COMPOSITION</span>
                    <div>{job.analysis?.composition || "—"}</div>
                  </div>
                  <div>
                    <span className="mono text-[9px] text-white/35">LIGHTING</span>
                    <div>{job.analysis?.lighting || "—"}</div>
                  </div>
                  <div>
                    <span className="mono text-[9px] text-white/35">SUBJECT</span>
                    <div>{job.analysis?.subject || "—"}</div>
                  </div>
                </div>
                <div className="mono text-[10px] text-white/35">
                  Engine: {job.analysis?.engine || "vision"} · Exports Flux JSON · ComfyUI compatible
                  · 8k
                </div>
              </div>
            </section>
          )}

          {/* Before / After */}
          {comparePreview && sourceStill && (
            <section className="rounded-rs-xl border border-[#8b5cf6]/30 bg-[#0a0a0a] p-5 space-y-3">
              <div className="mono text-[10px] text-[#8b5cf6] tracking-[0.14em]">
                PREVIEW COMPARISON — {compareCmd}
              </div>
              <div className="relative w-full max-w-3xl mx-auto aspect-video rounded-rs overflow-hidden border border-white/10 select-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={comparePreview}
                  alt="After"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${slider}%` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sourceStill}
                    alt="Before"
                    className="absolute inset-0 h-full object-cover"
                    style={{ width: `${10000 / Math.max(slider, 1)}%`, maxWidth: "none" }}
                  />
                </div>
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#00f0ff] shadow-[0_0_12px_#00f0ff]"
                  style={{ left: `${slider}%` }}
                />
                <div className="absolute top-2 left-2 mono text-[9px] px-2 py-0.5 rounded bg-black/60 text-white/70">
                  BEFORE
                </div>
                <div className="absolute top-2 right-2 mono text-[9px] px-2 py-0.5 rounded bg-black/60 text-[#00f0ff]">
                  AFTER
                </div>
              </div>
              <input
                type="range"
                min={5}
                max={95}
                value={slider}
                onChange={(e) => setSlider(Number(e.target.value))}
                className="w-full max-w-3xl mx-auto block accent-[#00f0ff]"
              />
            </section>
          )}

          {/* Dario Custom Pack */}
          {darioPack.length > 0 && (
            <section className="space-y-3">
              <div>
                <div className="mono text-[11px] text-[#ff7a00] tracking-[0.14em]">
                  DARIO CUSTOM PACK — 5 SIGNATURE
                </div>
                <p className="text-[12px] text-white/45 mt-1">
                  Used in ReelStorm wizard — BTS, Adcreative, Blueprint, Droneview, Explodeview.
                  Orange border = custom model tuned on Dario&apos;s dataset.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {darioPack.map((p) => (
                  <PromptCard
                    key={p.command}
                    p={p}
                    accent="#ff7a00"
                    copied={copied}
                    previewBusy={previewBusy}
                    onCopy={() => void copyPrompt(p)}
                    onPreview={() => void genPreview(p.command)}
                    compact
                  />
                ))}
              </div>
            </section>
          )}

          {Array.isArray(job.prompts) && job.prompts.length > 0 && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="mono text-[11px] text-[#00f0ff] tracking-[0.14em]">
                  FULL PROMPT PACK · {prompts.length}/{job.prompts.length} — COMFYUI FLUX READY
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={clsx(
                        "h-8 px-3 rounded-rs border text-[11px]",
                        filter === f.id
                          ? "border-[#00f0ff]/50 bg-[#00f0ff]/15 text-[#00f0ff]"
                          : "border-white/10 text-white/50",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search angle…"
                    className="h-8 w-36 rounded-rs bg-[#141414] border border-white/10 px-2 text-[12px]"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {prompts.map((p) => (
                  <PromptCard
                    key={p.command}
                    p={p}
                    accent={accentFor(p)}
                    copied={copied}
                    previewBusy={previewBusy}
                    onCopy={() => void copyPrompt(p)}
                    onPreview={() => void genPreview(p.command)}
                  />
                ))}
              </div>

              <div className="rounded-rs-xl border border-white/[0.08] bg-[#0a0a0a] px-4 py-4">
                <div className="mono text-[10px] text-[#666] tracking-widest mb-3">SEND TO:</div>
                <div className="flex flex-wrap gap-2">
                  {SEND_TO.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      className="h-10 px-4 inline-flex items-center rounded-rs border text-[12px] font-medium hover:bg-white/[0.04]"
                      style={{ borderColor: `${s.color}55`, color: s.color }}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
                <div className="mt-3 mono text-[9px] text-white/30">
                  ReelStorm v2.4 · app.reelstorm.uk/camera · ComfyUI Flux
                  {compareCmd ? ` · ${compareCmd} preview active` : ""}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PromptCard({
  p,
  accent,
  copied,
  previewBusy,
  onCopy,
  onPreview,
  compact,
}: {
  p: PromptRow;
  accent: string;
  copied: string | null;
  previewBusy: string | null;
  onCopy: () => void;
  onPreview: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className="rounded-rs-xl bg-[#0a0a0a] p-4 flex flex-col gap-2 border"
      style={{ borderColor: `${accent}55` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="mono text-[12px] font-bold" style={{ color: accent }}>
            {p.command}
          </div>
          <div className="text-[13px] font-semibold mt-0.5">{p.label}</div>
        </div>
        <span
          className="mono text-[8px] px-1.5 py-0.5 rounded border uppercase"
          style={{ borderColor: `${accent}40`, color: accent }}
        >
          {catKey(p.category)}
        </span>
      </div>
      {!compact && (
        <p className="text-[11px] text-white/45 leading-snug line-clamp-2">{p.keywords}</p>
      )}
      <div>
        <div className="mono text-[8px] text-white/30 mb-1 tracking-wider">
          FULL PROMPT — COMFYUI FLUX READY
        </div>
        <p className="text-[11px] text-white/75 leading-snug line-clamp-3 font-mono bg-[#141414] rounded p-2 border border-white/[0.06]">
          {p.prompt}
        </p>
      </div>
      <div className="mono text-[9px] text-white/35">
        {p.lens} · {p.movement} · {p.useCase}
      </div>
      {p.previewR2Url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.previewR2Url}
          alt={p.command}
          className="w-full h-28 object-cover rounded border"
          style={{ borderColor: `${accent}55` }}
        />
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onCopy}
          className="h-8 px-3 rounded-rs text-black text-[11px] font-bold"
          style={{ background: accent }}
        >
          {copied === p.command ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          disabled={previewBusy === p.command}
          onClick={onPreview}
          className="h-8 px-3 rounded-rs border border-white/15 text-[11px] text-white/70 disabled:opacity-40"
        >
          {previewBusy === p.command ? "…" : "Generate Preview"}
        </button>
      </div>
    </div>
  );
}

export default function CameraPage() {
  return (
    <AuthProvider>
      <CameraInner />
    </AuthProvider>
  );
}
