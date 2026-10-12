"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { openStormGuide } from "@/components/guide/PageStartCoach";
import { PodStatusIndicator } from "@/components/PodStatusIndicator";

const PRIMARY = [
  { code: "de", label: "German", native: "Deutsch" },
  { code: "yo", label: "Yoruba", native: "Yorùbá" },
  { code: "ha", label: "Hausa", native: "Hausa" },
  { code: "ig", label: "Igbo", native: "Igbo" },
] as const;

const EXTRA = [
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
] as const;

const STEPS = [
  "DOWNLOADING",
  "TRANSCRIBING",
  "TRANSLATING",
  "TTS",
  "LIPSYNC",
  "MUXING",
  "DONE",
] as const;

type FinalVideo = {
  r2Url: string;
  lipSync?: boolean;
  bodySync?: boolean;
  engine?: string;
  label?: string;
  duration?: number;
};

type Job = {
  id: string;
  status: string;
  sourceR2Url?: string | null;
  transcriptOriginal?: { text?: string; segments?: Array<{ start: number; end: number; text: string }> } | null;
  translations?: Record<string, { text?: string; segments?: unknown[] }> | null;
  ttsUrls?: Record<string, { url?: string }> | null;
  finalVideos?: Record<string, FinalVideo> | null;
  subtitleUrls?: Record<string, string> | null;
  logs?: string[] | null;
  rtcCost?: number;
  error?: string | null;
};

function stepIndex(status?: string) {
  const i = STEPS.indexOf((status || "DOWNLOADING") as (typeof STEPS)[number]);
  return i < 0 ? 0 : i;
}

function TranslateInner() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [langs, setLangs] = useState<string[]>(["de", "yo", "ha", "ig"]);
  const [showExtra, setShowExtra] = useState(false);
  const [useAvatar, setUseAvatar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asyncMode, setAsyncMode] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const rtcCost = langs.length * 10;
  const progress = stepIndex(job?.status);

  const loadBalance = useCallback(async () => {
    try {
      const w = await api<{ wallet?: { balanceRtc?: number }; balanceRtc?: number }>(
        "/api/user/wallet",
      );
      setBalance(w.wallet?.balanceRtc ?? w.balanceRtc ?? null);
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  useEffect(() => {
    if (!job?.id || job.status === "DONE" || job.status === "FAILED" || !asyncMode) return;
    const t = window.setInterval(async () => {
      try {
        const res = await api<{ job?: Job }>(`/api/translate/status?id=${job.id}`);
        if (res.job) setJob(res.job as Job);
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => window.clearInterval(t);
  }, [job?.id, job?.status, asyncMode]);

  function toggleLang(code: string) {
    setLangs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

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

  async function runTranslate() {
    if (!url.trim() && !file) {
      setMsg("Paste a YouTube / Instagram URL or drop an MP4.");
      return;
    }
    if (!langs.length) {
      setMsg("Select at least one language.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setJob(null);
    try {
      const body: Record<string, unknown> = {
        url: url.trim() || undefined,
        targetLangs: langs,
        useAvatarTwin: useAvatar,
        voiceMode: "clone",
        ownerEmail: user?.email,
      };
      if (file) {
        body.fileBase64 = await fileToBase64(file);
        body.fileName = file.name;
      }
      const path = asyncMode
        ? "/api/translate/orchestrate?async=1"
        : "/api/translate/orchestrate";
      const res = await api<Job & { ok?: boolean; jobId?: string; error?: string; async?: boolean }>(
        path,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (res.async && res.jobId) {
        setJob({ id: res.jobId, status: "DOWNLOADING", rtcCost });
        setMsg("Queued on BullMQ — watching progress…");
      } else {
        setJob({ ...res, id: res.jobId || res.id });
        setMsg(res.status === "DONE" ? "Translation pack ready." : `Status: ${res.status}`);
      }
      void loadBalance();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Translate failed");
    } finally {
      setBusy(false);
    }
  }

  const finals = useMemo(() => {
    const fv = job?.finalVideos || {};
    return langs
      .map((code) => {
        const row = fv[code];
        return row
          ? { code, ...row, label: PRIMARY.find((p) => p.code === code)?.label || EXTRA.find((p) => p.code === code)?.label || code }
          : null;
      })
      .filter(Boolean) as Array<FinalVideo & { code: string; label: string }>;
  }, [job?.finalVideos, langs]);

  return (
    <div className="max-w-[1200px] space-y-8 forge-in pb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="mono text-[11px] text-cyan mb-2 tracking-[0.14em]">
            LANGUAGE STUDIO // TRANSLATE OS
          </div>
          <h1 className="display text-4xl md:text-5xl leading-[0.95]">
            Any English video.
            <br />
            <span className="text-white/40">German · Yoruba · Hausa · Igbo.</span>
          </h1>
          <p className="mt-3 text-white/55 max-w-xl text-[15px] leading-relaxed">
            Download YouTube or Instagram reels → Whisper transcript → NLLB/LLM dub → cloned TTS →
            Wav2Lip + LivePortrait body sync → R2{" "}
            <span className="mono text-[11px] text-cyan">videos.reelstorm.uk/translated/</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <PodStatusIndicator />
          <button
            type="button"
            onClick={() => openStormGuide("Where do I start on Language Studio?")}
            className="h-10 px-4 rounded-rs border border-white/15 text-[12px] text-white/70"
          >
            Guide
          </button>
          <div className="mono text-[11px] px-3 py-2 rounded-rs border border-cyan/30 text-cyan">
            Balance {balance ?? "—"} RTC · Cost {rtcCost} RTC
          </div>
        </div>
      </div>

      <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
        <div className="h-11 px-5 flex items-center border-b border-white/[0.06] bg-panel mono text-[11px] text-cyan tracking-[0.12em]">
          01 — SOURCE
        </div>
        <div className="p-5 space-y-4">
          <label className="block">
            <span className="mono text-[10px] text-white/40">YOUTUBE OR INSTAGRAM REEL URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://instagram.com/reel/DeEEFfoMyno/ or https://youtube.com/watch?v=…"
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
            <div className="mono text-[10px] text-white/40 mb-2">OR DROP MP4</div>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-[12px] text-white/60"
            />
            {file && <div className="mt-2 text-[13px] text-cyan">{file.name}</div>}
          </div>
        </div>
      </section>

      <section className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden">
        <div className="h-11 px-5 flex items-center justify-between border-b border-white/[0.06] bg-panel">
          <span className="mono text-[11px] text-violet-soft tracking-[0.12em]">02 — LANGUAGES</span>
          <button
            type="button"
            className="mono text-[10px] text-white/50 hover:text-cyan"
            onClick={() => setShowExtra((s) => !s)}
          >
            + Add language
          </button>
        </div>
        <div className="p-5 flex flex-wrap gap-2">
          {PRIMARY.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => toggleLang(l.code)}
              className={clsx(
                "h-10 px-4 rounded-rs border text-[13px] font-medium",
                langs.includes(l.code)
                  ? "bg-cyan/15 border-cyan/50 text-cyan"
                  : "border-white/10 text-white/50",
              )}
            >
              {l.label}{" "}
              <span className="mono text-[10px] opacity-70">({l.code})</span>
            </button>
          ))}
          {showExtra &&
            EXTRA.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => toggleLang(l.code)}
                className={clsx(
                  "h-10 px-4 rounded-rs border text-[13px]",
                  langs.includes(l.code)
                    ? "bg-violet/20 border-violet/40 text-violet-soft"
                    : "border-white/10 text-white/50",
                )}
              >
                {l.label}
              </button>
            ))}
        </div>
        <div className="px-5 pb-5 flex flex-wrap gap-4 text-[13px] text-white/60">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useAvatar}
              onChange={(e) => setUseAvatar(e.target.checked)}
            />
            Replace face with Avatar Twin
            <Link href="/model-center/avatar" className="text-cyan underline-offset-2 hover:underline">
              open studio
            </Link>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={asyncMode}
              onChange={(e) => setAsyncMode(e.target.checked)}
            />
            Run async (BullMQ)
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runTranslate()}
          className="h-12 px-8 rounded-rs bg-cyan text-black font-bold text-[14px] disabled:opacity-50"
        >
          {busy ? "Translating…" : "Translate Now"}
        </button>
        <Link
          href="/sound-studio"
          className="h-12 px-5 inline-flex items-center rounded-rs border border-white/15 text-[13px]"
        >
          Sound Studio voices
        </Link>
        <Link
          href="/yt-os"
          className="h-12 px-5 inline-flex items-center rounded-rs border border-white/15 text-[13px]"
        >
          Send to YouTube OS
        </Link>
      </div>

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
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={clsx(
                    "rounded-rs border px-2 py-3 text-center",
                    i <= progress
                      ? "border-cyan/40 bg-cyan/10 text-cyan"
                      : "border-white/10 text-white/30",
                    job.status === "FAILED" && i === progress && "border-orange/50 text-orange",
                  )}
                >
                  <div className="mono text-[9px]">{String(i + 1).padStart(2, "0")}</div>
                  <div className="text-[10px] mt-1 font-medium leading-tight">{s}</div>
                </div>
              ))}
            </div>
            {job.error && <p className="mt-3 text-orange text-[13px]">{job.error}</p>}
            {Array.isArray(job.logs) && job.logs.length > 0 && (
              <pre className="mt-4 max-h-40 overflow-auto mono text-[10px] text-white/40 leading-relaxed">
                {(job.logs as string[]).slice(-12).join("\n")}
              </pre>
            )}
          </section>

          {job.sourceR2Url && (
            <section className="rounded-rs-xl border border-white/[0.08] bg-deep p-5">
              <div className="mono text-[10px] text-white/40 mb-2">SOURCE</div>
              <video src={job.sourceR2Url} controls className="w-full max-w-md rounded-rs border border-white/10" />
              <a href={job.sourceR2Url} className="mono text-[11px] text-cyan mt-2 inline-block" target="_blank" rel="noreferrer">
                {job.sourceR2Url}
              </a>
            </section>
          )}

          {finals.length > 0 && (
            <section className="space-y-4">
              <div className="mono text-[11px] text-cyan tracking-[0.14em]">OUTPUT · BODY SYNC PACK</div>
              <div className="grid md:grid-cols-2 gap-4">
                {finals.map((v) => (
                  <div
                    key={v.code}
                    className="rounded-rs-xl border border-white/[0.08] bg-deep overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-white/[0.06] flex justify-between items-center">
                      <span className="font-semibold">{v.label}</span>
                      <span className="mono text-[9px] text-white/40">
                        {v.lipSync ? "LIPSYNC" : "SOFT-SYNC"} · {v.engine || "—"}
                      </span>
                    </div>
                    <video src={v.r2Url} controls className="w-full aspect-video bg-black" />
                    <div className="p-3 flex flex-wrap gap-2">
                      <a
                        href={v.r2Url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="h-9 px-3 inline-flex items-center rounded-rs bg-cyan text-black text-[12px] font-bold"
                      >
                        Download
                      </a>
                      <Link
                        href="/studio-set"
                        className="h-9 px-3 inline-flex items-center rounded-rs border border-white/15 text-[12px]"
                      >
                        Studio Set
                      </Link>
                      <Link
                        href="/yt-os"
                        className="h-9 px-3 inline-flex items-center rounded-rs border border-white/15 text-[12px]"
                      >
                        YouTube OS
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(job.transcriptOriginal?.text || job.translations) && (
            <section className="rounded-rs-xl border border-white/[0.08] bg-deep p-5 space-y-4">
              <div className="mono text-[10px] text-violet-soft tracking-[0.14em]">TRANSCRIPTS</div>
              {job.transcriptOriginal?.text && (
                <div>
                  <div className="mono text-[9px] text-cyan mb-1">EN ORIGINAL</div>
                  <p className="text-[13px] text-white/70 leading-relaxed">{job.transcriptOriginal.text}</p>
                </div>
              )}
              {job.translations &&
                Object.entries(job.translations).map(([code, pack]) => (
                  <div key={code}>
                    <div className="mono text-[9px] text-orange mb-1">{code.toUpperCase()}</div>
                    <p className="text-[13px] text-white/65 leading-relaxed">{pack.text}</p>
                    {job.subtitleUrls?.[code] && (
                      <a
                        href={job.subtitleUrls[code]}
                        className="mono text-[10px] text-cyan mt-1 inline-block"
                        target="_blank"
                        rel="noreferrer"
                      >
                        WebVTT
                      </a>
                    )}
                  </div>
                ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function TranslatePage() {
  return (
    <AuthProvider>
      <TranslateInner />
    </AuthProvider>
  );
}
