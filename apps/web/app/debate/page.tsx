"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { openStormGuide } from "@/components/guide/PageStartCoach";
import { PodStatusIndicator } from "@/components/PodStatusIndicator";

type Persona = {
  name: string;
  voiceId: string;
  avatarId?: string;
  personality: string;
};

type DialogueLine = { host: "A" | "B"; text: string; start?: number; end?: number; angle?: string };

type Job = {
  id: string;
  status: string;
  mode?: string;
  debateStyle?: string;
  sourceText?: string | null;
  analysis?: {
    mainIdeas?: string[];
    arguments?: string[];
    opposingViewpoints?: string[];
    summary?: string;
  } | null;
  script?: { dialogue?: DialogueLine[]; duration?: number } | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  logs?: string[] | null;
  error?: string | null;
  rtcCost?: number;
};

const STEPS = [
  "EXTRACTING",
  "ANALYZING",
  "SCRIPTING",
  "GENERATING_AUDIO",
  "GENERATING_VIDEO",
  "MUXING",
  "DONE",
] as const;

const MODES = [
  { id: "AUDIO_ONLY", label: "Audio Only", tip: "Audio Overview — two voices (NotebookLM-style)" },
  { id: "VIDEO_TWO_AVATARS", label: "Video · Two Avatars", tip: "Animated presenters + body sync" },
  { id: "VIDEO_ONE_AVATAR_SPLIT", label: "Video · Split Twin", tip: "One avatar, dual framing" },
] as const;

const STYLES = [
  { id: "EXPLORE_TOPIC", label: "Explore Topic" },
  { id: "EXPLAIN_ARGUMENTS", label: "Explain Arguments" },
  { id: "DEBATE_OPPOSING", label: "Debate Opposing" },
] as const;

const LANGS = [
  { id: "en", label: "EN" },
  { id: "de", label: "DE" },
  { id: "yo", label: "YO" },
  { id: "ha", label: "HA" },
  { id: "ig", label: "IG" },
] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function DebateInner() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [textTopic, setTextTopic] = useState("Explain AI debate simulation");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<string>("VIDEO_TWO_AVATARS");
  const [debateStyle, setDebateStyle] = useState<string>("DEBATE_OPPOSING");
  const [hostA, setHostA] = useState<Persona>({
    name: "Alex",
    voiceId: "library-host-a",
    personality: "Optimist",
  });
  const [hostB, setHostB] = useState<Persona>({
    name: "Blake",
    voiceId: "library-host-b",
    personality: "Skeptic",
  });
  const [langs, setLangs] = useState<string[]>(["en"]);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const stepIndex = useMemo(() => {
    if (!job?.status) return -1;
    if (job.status === "FAILED") return -1;
    return STEPS.indexOf(job.status as (typeof STEPS)[number]);
  }, [job?.status]);

  const poll = useCallback(async (id: string) => {
    const res = await api<{ job?: Job }>(`/api/debate/job/${id}`);
    if (res.job) setJob(res.job);
    return res.job;
  }, []);

  useEffect(() => {
    if (!job?.id) return;
    if (job.status === "DONE" || job.status === "FAILED") return;
    const t = setInterval(() => {
      void poll(job.id);
    }, 2500);
    return () => clearInterval(t);
  }, [job?.id, job?.status, poll]);

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        mode,
        debateStyle,
        hostA,
        hostB,
        targetLangs: langs,
        ownerEmail: user?.email,
        async: true,
      };
      if (file) {
        payload.fileBase64 = await fileToBase64(file);
        payload.fileName = file.name;
        payload.mimeType = file.type || "application/octet-stream";
      } else if (url.trim()) {
        payload.url = url.trim();
      } else {
        payload.textTopic = textTopic.trim() || "Explain AI debate simulation";
      }

      const res = await api<{ ok?: boolean; jobId?: string; error?: string; rtcCost?: number }>(
        "/api/debate/orchestrate",
        { method: "POST", body: JSON.stringify(payload) },
      );
      if (!res.jobId) throw new Error(res.error || "No jobId");
      setMsg(`Queued · ${res.rtcCost ?? "?"} RTC`);
      const j = await poll(res.jobId);
      if (j) setJob(j);
      try {
        localStorage.setItem("rs_debate_job", res.jobId);
      } catch {
        /* */
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    try {
      const id = localStorage.getItem("rs_debate_job");
      if (id) void poll(id);
    } catch {
      /* */
    }
  }, [poll]);

  async function translateHandoff() {
    if (!job?.id) return;
    const res = await api<{ href?: string }>("/api/debate/translate", {
      method: "POST",
      body: JSON.stringify({ jobId: job.id, langs: langs.filter((l) => l !== "en") }),
    });
    if (res.href) window.location.href = res.href;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="border-b border-white/10 px-5 md:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mono text-[10px] text-[#00f0ff] tracking-[0.16em]">
            DEBATE STUDIO · AI-GENERATED PODCAST · DUAL HOST
          </div>
          <h1 className="display text-[28px] md:text-[34px] leading-none mt-1">
            Upload material → two AI hosts debate
          </h1>
          <p className="text-white/50 text-[13px] mt-2 max-w-[640px]">
            Audio Overview + Multi-Agent conversation + AI Debate Simulation. NotebookLM is audio-only —
            ReelStorm adds optional video avatars with body sync.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PodStatusIndicator />
          <button
            type="button"
            onClick={() => openStormGuide("How does Debate Studio / Audio Overview work?")}
            className="h-10 px-4 rounded-rs border border-white/15 text-[12px] hover:bg-white/5"
          >
            Guide
          </button>
          <Link href="/dashboard" className="h-10 px-4 inline-flex items-center rounded-rs border border-white/15 text-[12px]">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-5 md:px-8 py-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-8">
        <section className="space-y-5">
          <div className="rounded-rs-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mono text-[10px] text-white/40 mb-3 tracking-[0.14em]">1 · SOURCE MATERIAL</div>
            <label className="block border border-dashed border-[#00f0ff]/35 rounded-rs p-6 text-center cursor-pointer hover:bg-[#00f0ff]/5">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.mp3,.mp4,.wav,.m4a"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="text-[14px] font-medium">
                {file ? file.name : "Drop PDF / DOCX / MP3 / MP4 / TXT"}
              </div>
              <div className="text-[12px] text-white/40 mt-1">or paste a link / type a topic below</div>
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="YouTube / Instagram URL"
              className="mt-3 w-full h-11 px-3 rounded-rs bg-black/40 border border-white/10 text-[13px]"
            />
            <textarea
              value={textTopic}
              onChange={(e) => setTextTopic(e.target.value)}
              rows={3}
              placeholder="Or type a topic…"
              className="mt-3 w-full px-3 py-2 rounded-rs bg-black/40 border border-white/10 text-[13px]"
            />
          </div>

          <div className="rounded-rs-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mono text-[10px] text-white/40 mb-3 tracking-[0.14em]">2 · MODE · STYLE · LANGS</div>
            <div className="grid sm:grid-cols-3 gap-2 mb-4">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  title={m.tip}
                  onClick={() => setMode(m.id)}
                  className={clsx(
                    "rounded-rs border px-3 py-3 text-left text-[12px]",
                    mode === m.id ? "border-[#00f0ff] bg-[#00f0ff]/10" : "border-white/10",
                  )}
                >
                  <div className="font-semibold">{m.label}</div>
                  <div className="text-white/40 mt-1 text-[11px]">{m.tip}</div>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setDebateStyle(s.id)}
                  className={clsx(
                    "h-9 px-3 rounded-rs border text-[12px]",
                    debateStyle === s.id ? "border-orange bg-orange/15 text-orange" : "border-white/10",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {LANGS.map((l) => {
                const on = langs.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() =>
                      setLangs((prev) => (on ? prev.filter((x) => x !== l.id) : [...prev, l.id]))
                    }
                    className={clsx(
                      "h-8 px-3 rounded-rs border text-[11px] mono",
                      on ? "border-[#00f0ff] text-[#00f0ff]" : "border-white/10 text-white/40",
                    )}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {(
              [
                ["A", hostA, setHostA, ["Optimist", "Expert", "Enthusiast"]],
                ["B", hostB, setHostB, ["Skeptic", "Critic", "Devil's Advocate"]],
              ] as const
            ).map(([key, host, setHost, personalities]) => (
              <div key={key} className="rounded-rs-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mono text-[10px] text-[#00f0ff] mb-2">HOST {key}</div>
                <input
                  value={host.name}
                  onChange={(e) => setHost({ ...host, name: e.target.value })}
                  className="w-full h-10 px-3 mb-2 rounded-rs bg-black/40 border border-white/10 text-[13px]"
                  placeholder="Name"
                />
                <select
                  value={host.personality}
                  onChange={(e) => setHost({ ...host, personality: e.target.value })}
                  className="w-full h-10 px-3 mb-2 rounded-rs bg-black/40 border border-white/10 text-[13px]"
                >
                  {personalities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  value={host.voiceId}
                  onChange={(e) => setHost({ ...host, voiceId: e.target.value })}
                  className="w-full h-10 px-3 rounded-rs bg-black/40 border border-white/10 text-[12px]"
                  placeholder="Sound Studio voiceId"
                />
                <Link href="/model-center/avatar" className="block mt-2 text-[11px] text-[#00f0ff] hover:underline">
                  Pick Avatar Studio twin →
                </Link>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void generate()}
            className="w-full h-14 rounded-rs bg-[#00f0ff] text-black font-bold text-[15px] disabled:opacity-50"
          >
            {busy ? "Queuing…" : `Generate Debate · ${mode === "AUDIO_ONLY" ? "15" : "25"} RTC`}
          </button>
          {msg && <div className="text-[12px] text-orange">{msg}</div>}

          <button
            type="button"
            onClick={() => setGlossaryOpen((v) => !v)}
            className="text-[11px] text-white/40 hover:text-white underline"
          >
            {glossaryOpen ? "Hide" : "What is this called?"} tech glossary
          </button>
          {glossaryOpen && (
            <div className="rounded-rs border border-white/10 p-4 text-[12px] text-white/60 space-y-2">
              <p>
                <span className="text-[#00f0ff]">Audio Overview</span> — Google NotebookLM name (audio only).
              </p>
              <p>
                <span className="text-[#00f0ff]">AI-Generated Podcast</span> — broader podcast-style AI conversation.
              </p>
              <p>
                <span className="text-[#00f0ff]">Multi-Agent AI Conversation</span> — two personas interact.
              </p>
              <p>
                <span className="text-[#00f0ff]">AI Debate Simulation</span> — opposing viewpoints.
              </p>
              <p>
                ReelStorm upgrade: <span className="text-orange">Video AI Debate</span> with Avatar Studio twins.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div className="rounded-rs-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mono text-[10px] text-white/40 mb-3 tracking-[0.14em]">PIPELINE</div>
            <div className="flex flex-wrap gap-1.5">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={clsx(
                    "mono text-[9px] px-2 py-1 rounded border",
                    job?.status === "FAILED"
                      ? "border-red-500/40 text-red-300"
                      : i <= stepIndex
                        ? "border-[#00f0ff]/50 text-[#00f0ff]"
                        : "border-white/10 text-white/30",
                  )}
                >
                  {s}
                </span>
              ))}
            </div>
            {job?.error && <div className="mt-3 text-[12px] text-red-300">{job.error}</div>}
            <div className="mt-3 max-h-36 overflow-auto mono text-[10px] text-white/35 space-y-1">
              {(job?.logs || ["Awaiting generate…"]).slice(-12).map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>

          <div className="rounded-rs-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mono text-[10px] text-white/40 mb-3">AUDIO · TWO VOICES</div>
            {job?.audioUrl ? (
              <>
                <audio controls src={job.audioUrl} className="w-full" />
                <a href={job.audioUrl} className="text-[11px] text-[#00f0ff] mt-2 inline-block" target="_blank" rel="noreferrer">
                  Download MP3 →
                </a>
              </>
            ) : (
              <div className="text-[12px] text-white/35">Audio lands on videos.reelstorm.uk/debate/…_audio.mp3</div>
            )}
          </div>

          <div className="rounded-rs-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mono text-[10px] text-white/40 mb-3">VIDEO · TWO AVATARS</div>
            {job?.videoUrl ? (
              <>
                <video controls src={job.videoUrl} className="w-full rounded-rs border border-white/10" />
                <a href={job.videoUrl} className="text-[11px] text-[#00f0ff] mt-2 inline-block" target="_blank" rel="noreferrer">
                  Download MP4 →
                </a>
              </>
            ) : (
              <div className="text-[12px] text-white/35">
                {mode === "AUDIO_ONLY"
                  ? "Audio-only mode — video skipped"
                  : "Video uses Avatar + Camera angles (/OverShoulder…) when GPU wakes"}
              </div>
            )}
          </div>

          {job?.analysis && (
            <div className="rounded-rs-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mono text-[10px] text-white/40 mb-2">ANALYSIS</div>
              <p className="text-[13px] text-white/70 mb-3">{job.analysis.summary}</p>
              <div className="grid sm:grid-cols-3 gap-3 text-[12px]">
                <div>
                  <div className="text-[#00f0ff] mono text-[10px] mb-1">Ideas</div>
                  <ul className="space-y-1 text-white/55">
                    {(job.analysis.mainIdeas || []).map((x) => (
                      <li key={x}>• {x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-orange mono text-[10px] mb-1">Arguments</div>
                  <ul className="space-y-1 text-white/55">
                    {(job.analysis.arguments || []).map((x) => (
                      <li key={x}>• {x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-violet-soft mono text-[10px] mb-1">Opposing</div>
                  <ul className="space-y-1 text-white/55">
                    {(job.analysis.opposingViewpoints || []).map((x) => (
                      <li key={x}>• {x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {job?.script?.dialogue && (
            <div className="rounded-rs-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mono text-[10px] text-white/40 mb-3">SCRIPT</div>
              <div className="space-y-3 max-h-80 overflow-auto">
                {job.script.dialogue.map((line, i) => (
                  <div key={i} className="text-[13px]">
                    <span
                      className={clsx(
                        "mono text-[10px] font-bold mr-2",
                        line.host === "A" ? "text-[#00f0ff]" : "text-orange",
                      )}
                    >
                      {line.host === "A" ? hostA.name : hostB.name}
                      {line.angle ? ` · ${line.angle}` : ""}
                    </span>
                    <span className="text-white/70">{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href="/yt-os" className="h-10 px-4 inline-flex items-center rounded-rs border border-white/15 text-[12px]">
              Send to YouTube OS
            </Link>
            <Link href="/training" className="h-10 px-4 inline-flex items-center rounded-rs border border-white/15 text-[12px]">
              Training Academy
            </Link>
            <button
              type="button"
              disabled={!job?.audioUrl && !job?.videoUrl}
              onClick={() => void translateHandoff()}
              className="h-10 px-4 rounded-rs border border-[#00f0ff]/40 text-[#00f0ff] text-[12px] disabled:opacity-40"
            >
              Translate de/yo/ha/ig
            </button>
            <Link href="/sound-studio" className="h-10 px-4 inline-flex items-center rounded-rs border border-white/15 text-[12px]">
              Sound Studio
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DebatePage() {
  return (
    <AuthProvider>
      <DebateInner />
    </AuthProvider>
  );
}
