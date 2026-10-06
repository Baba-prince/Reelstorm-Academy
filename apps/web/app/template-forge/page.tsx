"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API_URL, WS_URL, api } from "@/lib/api";
import clsx from "clsx";

type AnalysisEvent = {
  uploadId?: string;
  stage: string;
  percent: number;
  message?: string;
  error?: string;
};

type Template = {
  id: string;
  name: string;
  stylePreset: string;
  durationSec: number;
  aspectRatio: string;
  lut?: string | null;
  createdAt: string;
};

const STAGES = [
  "queued",
  "probing",
  "scene_detect",
  "style_dna",
  "faces",
  "rooms",
  "audio",
  "template_extract",
  "block_split",
  "complete",
];

export default function TemplateForgePage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisEvent | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [script, setScript] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);
  const [refUrl, setRefUrl] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Poll upload status while fetching web reference (before WS events)
  useEffect(() => {
    if (!uploadId) return;
    const t = setInterval(() => {
      api<{ upload: { status: string; progressPct: number; progressMsg: string | null; error: string | null; s3Url?: string | null } }>(
        `/api/upload/video/${uploadId}`,
      )
        .then((d) => {
          if (d.upload.progressMsg || d.upload.error) {
            setProgress({
              uploadId,
              stage: d.upload.status === "FAILED" ? "failed" : d.upload.status.toLowerCase(),
              percent: d.upload.progressPct,
              message: d.upload.progressMsg || undefined,
              error: d.upload.error || undefined,
            });
          }
        })
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(t);
  }, [uploadId]);

  const loadTemplates = useCallback(() => {
    api<{ templates: Template[] }>("/api/templates")
      .then((d) => setTemplates(d.templates))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!uploadId) return;
    wsRef.current?.close();
    const ws = new WebSocket(`${WS_URL}/ws/analysis/${uploadId}`);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as AnalysisEvent;
        setProgress(data);
        if (data.stage === "complete") loadTemplates();
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [uploadId, loadTemplates]);

  async function handleFile(file: File) {
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm)$/i.test(file.name)) {
      alert("MP4 or MOV only (up to 2GB)");
      return;
    }
    if (file.size > 2 * 1024 * 1024 * 1024) {
      alert("Max 2GB");
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setProgress({ stage: "uploading", percent: 2, message: "Uploading to factory…" });
    setRebuildMsg(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("analyze", "true");

      const res = await fetch(`${API_URL}/api/upload/video`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { upload: { id: string } };
      setUploadId(data.upload.id);
      setProgress({ stage: "queued", percent: 5, message: "Queued for Video Intelligence" });
    } catch (e) {
      setProgress({ stage: "failed", percent: 0, error: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function handleUrlExtract() {
    const url = refUrl.trim();
    if (!url) return;
    setUrlBusy(true);
    setRebuildMsg(null);
    setPreviewUrl(null);
    setProgress({ stage: "uploading", percent: 3, message: "Fetching web reference video…" });
    try {
      const data = await api<{ uploadId: string; wsChannel: string }>("/api/upload/video/from-url", {
        method: "POST",
        body: JSON.stringify({ url, analyze: true }),
      });
      setUploadId(data.uploadId);
      setProgress({
        stage: "uploading",
        percent: 8,
        message: "Download started — extracting template after analyze…",
      });
    } catch (e) {
      setProgress({ stage: "failed", percent: 0, error: (e as Error).message });
    } finally {
      setUrlBusy(false);
    }
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  }

  async function rebuild() {
    if (!selectedTemplate || !script.trim()) {
      setRebuildMsg("Select a template and paste a new script.");
      return;
    }
    setRebuildMsg("Creating project + applying template…");
    try {
      const { project } = await api<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title: `Rebuild — ${templates.find((t) => t.id === selectedTemplate)?.stylePreset || "Template"}`,
          script,
        }),
      });
      await api(`/api/templates/${selectedTemplate}/apply`, {
        method: "POST",
        body: JSON.stringify({ projectId: project.id, script }),
      });
      setRebuildMsg(`STORM rebuild queued for project ${project.id}`);
    } catch (e) {
      setRebuildMsg((e as Error).message);
    }
  }

  const pct = progress?.percent ?? 0;

  return (
    <div className="space-y-8 forge-in max-w-[1200px]">
      <div>
        <div className="mono text-[11px] text-violet-soft mb-2">TEMPLATE FORGE v2 // UPLOAD + WEB LINK</div>
        <h1 className="display text-4xl md:text-5xl">
          Steal the{" "}
          <span className="bg-empire bg-clip-text text-transparent">style</span>
        </h1>
        <p className="mt-3 text-white/60 max-w-2xl text-[15px] leading-relaxed">
          Drop a file <span className="text-white/90">or paste a YouTube / Vimeo / direct MP4 link</span>.
          We download the reference, extract scene DNA, camera moves, LUTs, character + room plates —
          then you type a new script and rebuild in that exact style. Prefer curated ideals? Open{" "}
          <Link href="/templates-room" className="text-cyan hover:underline">
            Templates Room
          </Link>
          .
        </p>
      </div>

      {/* Web reference URL */}
      <section className="rounded-rs-xl border border-cyan/25 bg-cyan/5 p-5">
        <div className="mono text-[11px] text-cyan mb-3">WEB REFERENCE LINK</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={refUrl}
            onChange={(e) => setRefUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleUrlExtract()}
            placeholder="https://youtube.com/watch?v=…  or  https://cdn.example.com/reel.mp4"
            className="flex-1 h-12 rounded-rs bg-void border border-white/10 px-4 text-sm focus:outline-none focus:border-cyan/50"
          />
          <button
            onClick={() => void handleUrlExtract()}
            disabled={urlBusy || !refUrl.trim()}
            className="h-12 px-6 rounded-rs bg-cyan text-black font-bold text-sm disabled:opacity-40"
          >
            {urlBusy ? "Fetching…" : "Extract from URL"}
          </button>
        </div>
        <div className="mono text-[9px] text-white/40 mt-2">
          YOUTUBE • VIMEO • DIRECT MP4/MOV • yt-dlp powered
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={clsx(
            "relative rounded-rs-xl border-2 border-dashed min-h-[280px] flex flex-col items-center justify-center cursor-pointer transition-all noise overflow-hidden",
            dragOver
              ? "border-cyan bg-cyan/10"
              : "border-white/15 bg-panel/60 hover:border-violet/50 hover:bg-violet/5",
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <div className="w-14 h-14 rounded-rs bg-storm flex items-center justify-center font-black text-xl mb-4">
            ↑
          </div>
          <div className="display text-xl text-center px-6">Drag & drop video</div>
          <div className="mono text-[10px] text-white/40 mt-2">MP4 / MOV • MAX 2GB</div>
          {uploading && (
            <div className="absolute bottom-4 mono text-[10px] text-cyan">UPLOADING…</div>
          )}
        </div>

        <div className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden flex flex-col min-h-[280px]">
          <div className="h-11 px-4 flex items-center justify-between border-b border-white/[0.06] bg-panel">
            <span className="mono text-[10px]">PREVIEW PLAYER</span>
            {uploadId && (
              <span className="mono text-[9px] text-cyan truncate max-w-[180px]">{uploadId}</span>
            )}
          </div>
          <div className="flex-1 bg-black flex items-center justify-center">
            {previewUrl ? (
              <video src={previewUrl} controls className="w-full max-h-[320px]" />
            ) : (
              <div className="text-white/30 text-sm px-6 text-center">
                {refUrl.trim()
                  ? "Web reference queued — preview appears after local download"
                  : "No video loaded"}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-rs-xl border border-white/[0.08] bg-panel/80 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="mono text-[11px] text-cyan">VIDEO INTELLIGENCE</div>
          <div className="mono text-[11px]">{pct}%</div>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all",
              progress?.stage === "failed" ? "bg-red-500" : "progress-bar",
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="mt-3 text-sm text-white/70">
          {progress?.error || progress?.message || "Waiting for upload or web link…"}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["uploading", ...STAGES].map((s) => {
            const active = progress?.stage === s;
            const order = ["uploading", ...STAGES];
            const done = progress ? order.indexOf(progress.stage) > order.indexOf(s) : false;
            return (
              <span
                key={s}
                className={clsx(
                  "mono text-[9px] px-2 py-1 rounded-full border",
                  active
                    ? "bg-cyan text-black border-cyan"
                    : done
                      ? "bg-violet/30 border-violet/40 text-violet-soft"
                      : "border-white/10 text-white/30",
                )}
              >
                {s}
              </span>
            );
          })}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
          <div className="h-12 px-5 flex items-center justify-between border-b border-white/[0.06] bg-panel">
            <span className="mono text-[11px]">TEMPLATE GALLERY</span>
            <button onClick={loadTemplates} className="mono text-[9px] text-cyan">
              REFRESH
            </button>
          </div>
          <div className="max-h-[360px] overflow-auto divide-y divide-white/[0.06]">
            {templates.length === 0 && (
              <div className="p-6 text-white/40 text-sm">Extracted templates appear here.</div>
            )}
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={clsx(
                  "w-full text-left px-5 py-4 hover:bg-white/[0.03] transition-colors",
                  selectedTemplate === t.id && "bg-violet/15",
                )}
              >
                <div className="font-semibold">{t.name}</div>
                <div className="mono text-[10px] text-orange mt-1">{t.stylePreset}</div>
                <div className="mono text-[9px] text-white/35 mt-1">
                  {Math.round(t.durationSec)}s • {t.aspectRatio}
                  {t.lut ? ` • LUT ${t.lut}` : ""}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-rs-xl border border-white/[0.08] bg-deep p-5 flex flex-col">
          <div className="mono text-[11px] text-orange mb-3">REBUILD WITH SCRIPT</div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste new script… STORM OS will rebuild video in the selected template style (Seedance / Kling / Veo)."
            className="flex-1 min-h-[180px] rounded-rs bg-void border border-white/10 p-4 text-sm resize-none focus:outline-none focus:border-violet/50"
          />
          <button
            onClick={rebuild}
            className="mt-4 h-12 rounded-rs bg-orange text-black font-bold text-[14px]"
          >
            Apply Template → Generate
          </button>
          {rebuildMsg && <div className="mt-3 text-sm text-white/60">{rebuildMsg}</div>}
        </section>
      </div>
    </div>
  );
}

