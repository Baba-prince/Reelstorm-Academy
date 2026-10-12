"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (!job?.id || job.status === "DONE" || job.status === "FAILED" || !asyncMode) return;
    const t = window.setInterval(async () => {
      try {
        const res = await api<{ job?: Job }>(`/api/camera/status?id=${job.id}`);
        if (res.job) setJob(res.job);
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
      return;
    }
    setBusy(true);
    setMsg(null);
    setJob(null);
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
      } else {
        setJob({ ...res, id: res.jobId || res.id });
        setMsg(
          res.status === "DONE"
            ? `${Array.isArray(res.prompts) ? res.prompts.length : 0} angle prompts ready.`
            : `Status: ${res.status}`,
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  const prompts = useMemo(() => {
    const list = job?.prompts || [];
    return list.filter((p) => {
      if (filter !== "all" && p.category !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.command.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.keywords.toLowerCase().includes(q)
      );
    });
  }, [job?.prompts, filter, search]);

  const progress = Math.max(0, STEPS.indexOf((job?.status || "UPLOADING") as (typeof STEPS)[number]));

  const copyPrompt = useCallback(async (p: PromptRow) => {
    try {
      await navigator.clipboard.writeText(p.prompt);
      setCopied(p.command);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setMsg("Copy failed — select text manually.");
    }
  }, []);

  async function genPreview(command: string) {
    if (!job?.id) return;
    setPreviewBusy(command);
    try {
      const res = await api<{ previewR2Url?: string; command?: string }>(
        "/api/camera/generate-preview",
        {
          method: "POST",
          body: JSON.stringify({ jobId: job.id, command, ownerEmail: user?.email }),
        },
      );
      setJob((prev) => {
        if (!prev) return prev;
        const nextPrompts = (prev.prompts || []).map((p) =>
          p.command === (res.command || command)
            ? { ...p, previewR2Url: res.previewR2Url }
            : p,
        );
        return {
          ...prev,
          prompts: nextPrompts,
          previews: { ...(prev.previews || {}), [res.command || command]: res.previewR2Url || "" },
        };
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewBusy(null);
    }
  }

  return (
    <div className="max-w-[1200px] space-y-8 forge-in pb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2 tracking-[0.14em]">
            CAMERA ANGLE PROMPT GENERATOR // 30+ PRO
          </div>
          <h1 className="display text-4xl md:text-5xl leading-[0.95]">
            Type this to get this.
            <br />
            <span className="text-white/40">Upgraded from Dario&apos;s 5.</span>
          </h1>
          <p className="mt-3 text-white/55 max-w-xl text-[15px] leading-relaxed">
            Upload image/video or paste YouTube/Instagram → detect current angle → generate{" "}
            <span className="text-cyan">/BTS /Adcreative /Blueprint /Droneview /Explodeview</span> +
            LowAngle, BirdsEye, Orbit, Anamorphic… ready for ComfyUI Flux.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <PodStatusIndicator />
          <button
            type="button"
            onClick={() => openStormGuide("Where do I start on Camera Angle Studio?")}
            className="h-10 px-4 rounded-rs border border-white/15 text-[12px] text-white/70"
          >
            Guide
          </button>
          <div className="mono text-[11px] px-3 py-2 rounded-rs border border-cyan/30 text-cyan">
            2 RTC analyze · 1 RTC preview
          </div>
        </div>
      </div>

      <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
        <div className="h-11 px-5 flex items-center border-b border-white/[0.06] bg-panel mono text-[11px] text-cyan tracking-[0.12em]">
          01 — SOURCE
        </div>
        <div className="p-5 space-y-4">
          <label className="block">
            <span className="mono text-[10px] text-white/40">YOUTUBE / INSTAGRAM URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://instagram.com/reel/DeUDJImj9q2/ or youtube.com/watch?v=…"
              className="mt-1 w-full h-12 rounded-rs bg-void border border-white/10 px-4 text-[14px]"
            />
          </label>
          <div
            className={clsx(
              "rounded-rs border border-dashed border-white/15 bg-void/60 px-4 py-8 text-center",
              file && "border-cyan/40",
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
          >
            <div className="mono text-[10px] text-white/40 mb-2">OR DROP IMAGE / VIDEO</div>
            <input
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-[12px] text-white/60"
            />
            {file && <div className="mt-2 text-[13px] text-cyan">{file.name}</div>}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAnalyze()}
              className="h-12 px-8 rounded-rs bg-cyan text-black font-bold text-[14px] disabled:opacity-50"
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
            <Link href="/world-builder" className="text-[13px] text-white/50 hover:text-cyan">
              → World Builder
            </Link>
            <Link href="/wizard" className="text-[13px] text-white/50 hover:text-cyan">
              → BOT Director Shot List
            </Link>
          </div>
        </div>
      </section>

      {msg && (
        <div className="rounded-rs border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] text-white/70">
          {msg}
        </div>
      )}

      {job && (
        <>
          <section className="rounded-rs-xl border border-white/[0.08] bg-deep p-5">
            <div className="mono text-[10px] text-orange mb-4 tracking-[0.14em]">
              PIPELINE · {job.status} · {job.id.slice(0, 10)}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={clsx(
                    "rounded-rs border px-2 py-3 text-center",
                    i <= progress ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-white/10 text-white/30",
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
              <div className="rounded-rs-xl border border-white/[0.08] bg-deep p-4">
                <div className="mono text-[10px] text-white/40 mb-2">SOURCE</div>
                {job.sourceR2Url?.match(/\.(mp4|webm|mov)/i) ? (
                  <video src={job.sourceR2Url} controls className="w-full rounded-rs border border-white/10" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={job.sourceR2Url || job.keyframes?.[0]?.r2Url || ""}
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
              <div className="rounded-rs-xl border border-white/[0.08] bg-deep p-5 space-y-3">
                <div className="mono text-[10px] text-cyan tracking-[0.14em]">CURRENT ANGLE DETECTED</div>
                <div className="display text-2xl">{job.analysis?.currentAngle || "—"}</div>
                <div className="grid grid-cols-2 gap-3 text-[13px] text-white/60">
                  <div>
                    <span className="mono text-[9px] text-white/35">LENS</span>
                    <div>{job.analysis?.detectedLens || "—"}</div>
                  </div>
                  <div>
                    <span className="mono text-[9px] text-white/35">CONFIDENCE</span>
                    <div>
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
                </div>
                <div className="mono text-[10px] text-white/35">
                  Subject: {job.analysis?.subject || "—"} · Engine: {job.analysis?.engine || "—"}
                </div>
              </div>
            </section>
          )}

          {Array.isArray(job.prompts) && job.prompts.length > 0 && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="mono text-[11px] text-cyan tracking-[0.14em]">
                  PROMPT PACK · {prompts.length}/{job.prompts.length}
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
                          ? "border-cyan/50 bg-cyan/15 text-cyan"
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
                    className="h-8 w-36 rounded-rs bg-void border border-white/10 px-2 text-[12px]"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {prompts.map((p) => (
                  <div
                    key={p.command}
                    className="rounded-rs-xl border border-white/[0.08] bg-deep p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="mono text-[12px] text-cyan font-bold">{p.command}</div>
                        <div className="text-[13px] font-semibold mt-0.5">{p.label}</div>
                      </div>
                      <span className="mono text-[8px] px-1.5 py-0.5 rounded border border-white/10 text-white/40 uppercase">
                        {p.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/45 leading-snug line-clamp-2">{p.keywords}</p>
                    <p className="text-[11px] text-white/70 leading-snug line-clamp-3 font-mono bg-void/80 rounded p-2 border border-white/[0.06]">
                      {p.prompt}
                    </p>
                    <div className="mono text-[9px] text-white/35">
                      {p.lens} · {p.movement} · {p.useCase}
                    </div>
                    {p.previewR2Url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.previewR2Url}
                        alt={p.command}
                        className="w-full h-28 object-cover rounded border border-cyan/30"
                      />
                    )}
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void copyPrompt(p)}
                        className="h-8 px-3 rounded-rs bg-cyan text-black text-[11px] font-bold"
                      >
                        {copied === p.command ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        disabled={previewBusy === p.command}
                        onClick={() => void genPreview(p.command)}
                        className="h-8 px-3 rounded-rs border border-white/15 text-[11px] text-white/70 disabled:opacity-40"
                      >
                        {previewBusy === p.command ? "…" : "Preview"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  href="/world-builder"
                  className="h-10 px-4 inline-flex items-center rounded-rs border border-violet/40 text-violet-soft text-[12px]"
                >
                  Send to World Builder
                </Link>
                <Link
                  href="/studio-set"
                  className="h-10 px-4 inline-flex items-center rounded-rs border border-white/15 text-[12px]"
                >
                  Studio Set variants
                </Link>
                <Link
                  href="/model-center/avatar"
                  className="h-10 px-4 inline-flex items-center rounded-rs border border-white/15 text-[12px]"
                >
                  Avatar angles
                </Link>
                <Link
                  href="/yt-os"
                  className="h-10 px-4 inline-flex items-center rounded-rs border border-white/15 text-[12px]"
                >
                  Thumbnail angles
                </Link>
              </div>
            </section>
          )}
        </>
      )}
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
