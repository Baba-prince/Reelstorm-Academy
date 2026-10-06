"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";

type Tab = "sync" | "extract" | "clone" | "tts" | "library";

type AssetRow = {
  id: string;
  type: string;
  key: string;
  url?: string | null;
  mimeType?: string | null;
  labels: string[];
  meta?: { localPath?: string; title?: string; text?: string };
  createdAt: string;
};

type VoiceProfile = {
  id: string;
  name: string;
  status: string;
  providerVoiceId?: string | null;
  error?: string | null;
};

type ElevenVoice = { voiceId: string; name: string; category?: string };

export default function SoundStudioPage() {
  const [tab, setTab] = useState<Tab>("sync");
  const [projectId, setProjectId] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Sync
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [uploadId, setUploadId] = useState("");
  const [audioAssetId, setAudioAssetId] = useState("");
  const [offsetSec, setOffsetSec] = useState("0");
  const [replaceAudio, setReplaceAudio] = useState(true);

  // Extract
  const [extractUploadId, setExtractUploadId] = useState("");
  const [stems, setStems] = useState(true);

  // Clone
  const [cloneName, setCloneName] = useState("");
  const [cloneSample, setCloneSample] = useState<File | null>(null);
  const [cloneDesc, setCloneDesc] = useState("");

  // TTS
  const [ttsText, setTtsText] = useState("");
  const [voiceProfileId, setVoiceProfileId] = useState("");
  const [stockVoiceId, setStockVoiceId] = useState("");

  const [library, setLibrary] = useState<AssetRow[]>([]);
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [eleven, setEleven] = useState<ElevenVoice[]>([]);
  const [elevenErr, setElevenErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [lib, voices] = await Promise.all([
        api<{ assets: AssetRow[] }>(
          `/api/sound/library${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
        ),
        api<{
          profiles: VoiceProfile[];
          elevenlabs: ElevenVoice[];
          elevenlabsError: string | null;
        }>("/api/sound/voices"),
      ]);
      setLibrary(lib.assets);
      setProfiles(voices.profiles);
      setEleven(voices.elevenlabs);
      setElevenErr(voices.elevenlabsError);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function pollJob(jobId: string) {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const res = await api<{
          job: { status: string; result?: unknown; error?: string | null };
        }>(`/api/sound/job/${jobId}`);
        if (res.job.status === "COMPLETED") {
          setMsg(`Done · ${JSON.stringify(res.job.result)}`);
          await refresh();
          return;
        }
        if (res.job.status === "FAILED") {
          setMsg(`Failed · ${res.job.error || "unknown"}`);
          return;
        }
        setMsg(`Job ${res.job.status}…`);
      } catch {
        /* job record may lag */
      }
    }
    setMsg("Still running — refresh library shortly");
  }

  async function uploadAudio(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    if (projectId) fd.append("projectId", projectId);
    fd.append("label", "external");
    const res = await fetch(`${API_URL}/api/sound/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ asset: { id: string }; localPath: string }>;
  }

  async function runFromUrl() {
    if (!audioUrl.trim()) return setMsg("Paste an audio / YouTube URL");
    setBusy(true);
    setMsg("Queuing external audio…");
    try {
      const res = await api<{ jobId: string; soundId: string }>("/api/sound/from-url", {
        method: "POST",
        body: JSON.stringify({ url: audioUrl.trim(), projectId: projectId || undefined }),
      });
      setMsg(`Queued ${res.soundId}`);
      await pollJob(res.jobId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runSync() {
    setBusy(true);
    setMsg("Preparing sync…");
    try {
      let aid = audioAssetId;
      if (audioFile) {
        const up = await uploadAudio(audioFile);
        aid = up.asset.id;
        setAudioAssetId(aid);
      }
      if (!aid && audioUrl.trim()) {
        const from = await api<{ jobId: string }>("/api/sound/from-url", {
          method: "POST",
          body: JSON.stringify({ url: audioUrl.trim(), projectId: projectId || undefined }),
        });
        await pollJob(from.jobId);
        await refresh();
        const latest = library[0] || (await api<{ assets: AssetRow[] }>("/api/sound/library")).assets[0];
        aid = latest?.id || "";
      }
      if (!aid) throw new Error("Need audio file, asset id, or URL");
      if (!uploadId.trim()) throw new Error("Video uploadId required (from Template Forge)");

      const res = await api<{ jobId: string }>("/api/sound/sync", {
        method: "POST",
        body: JSON.stringify({
          uploadId: uploadId.trim(),
          audioAssetId: aid,
          projectId: projectId || undefined,
          replace: replaceAudio,
          offsetSec: Number(offsetSec) || 0,
        }),
      });
      await pollJob(res.jobId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runExtract() {
    if (!extractUploadId.trim()) return setMsg("uploadId required");
    setBusy(true);
    try {
      const res = await api<{ jobId: string }>("/api/sound/extract", {
        method: "POST",
        body: JSON.stringify({
          uploadId: extractUploadId.trim(),
          projectId: projectId || undefined,
          stems,
          format: "wav",
        }),
      });
      await pollJob(res.jobId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runClone() {
    if (!cloneName.trim()) return setMsg("Voice name required");
    if (!cloneSample && !audioAssetId) return setMsg("Upload a sample or pick an asset id");
    setBusy(true);
    try {
      let sampleIds = audioAssetId ? [audioAssetId] : [];
      if (cloneSample) {
        const up = await uploadAudio(cloneSample);
        sampleIds = [up.asset.id];
      }
      const res = await api<{ jobId: string; voiceProfile: VoiceProfile }>("/api/sound/clone", {
        method: "POST",
        body: JSON.stringify({
          name: cloneName.trim(),
          projectId: projectId || undefined,
          sampleAssetIds: sampleIds,
          description: cloneDesc || undefined,
        }),
      });
      setVoiceProfileId(res.voiceProfile.id);
      await pollJob(res.jobId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runTts() {
    if (!ttsText.trim()) return setMsg("Script text required");
    setBusy(true);
    try {
      const res = await api<{ jobId: string }>("/api/sound/tts", {
        method: "POST",
        body: JSON.stringify({
          text: ttsText.trim(),
          projectId: projectId || undefined,
          voiceProfileId: voiceProfileId || undefined,
          voiceId: stockVoiceId || undefined,
        }),
      });
      await pollJob(res.jobId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string; accent: string }[] = [
    { id: "sync", label: "Sync External", accent: "#00D9FF" },
    { id: "extract", label: "Extract", accent: "#7C3AED" },
    { id: "clone", label: "Voice Clone", accent: "#FF7A00" },
    { id: "tts", label: "Voice Forge", accent: "#C4B5FD" },
    { id: "library", label: "Library", accent: "#E5E7EB" },
  ];

  return (
    <div className="max-w-[960px] space-y-6 forge-in">
      <div>
        <div className="mono text-[11px] text-cyan mb-2">SOUND STUDIO // VOICE FORGE</div>
        <h1 className="display text-4xl md:text-5xl leading-none">Audio OS</h1>
        <p className="mt-3 text-white/60 max-w-[520px]">
          Sync beds from URL or file, extract voice/music stems from video, clone a talent voice, then
          speak any script through Voice Forge.
        </p>
      </div>

      <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-4">
        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Project ID (optional)"
          className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="h-10 px-4 rounded-rs text-[12px] font-semibold border transition"
            style={{
              borderColor: tab === t.id ? t.accent : "rgba(255,255,255,0.1)",
              background: tab === t.id ? `${t.accent}22` : "transparent",
              color: tab === t.id ? "#fff" : "rgba(255,255,255,0.55)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sync" && (
        <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-6 space-y-4">
          <div className="mono text-[10px] text-cyan">01 — EXTERNAL AUDIO → VIDEO SYNC</div>
          <input
            value={uploadId}
            onChange={(e) => setUploadId(e.target.value)}
            placeholder="Video uploadId (from Template Forge)"
            className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          />
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac"
            onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-white/60"
          />
          <div className="flex gap-2">
            <input
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="Or paste YouTube / podcast / mp3 URL"
              className="flex-1 h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={runFromUrl}
              className="h-11 px-4 rounded-rs border border-cyan/40 text-cyan text-sm font-semibold disabled:opacity-40"
            >
              Pull URL
            </button>
          </div>
          <input
            value={audioAssetId}
            onChange={(e) => setAudioAssetId(e.target.value)}
            placeholder="Or existing audio asset id"
            className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-white/60">
              Offset (sec)
              <input
                value={offsetSec}
                onChange={(e) => setOffsetSec(e.target.value)}
                className="mt-1 w-full h-11 rounded-rs bg-void border border-white/10 px-3"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-white/60 mt-6">
              <input
                type="checkbox"
                checked={replaceAudio}
                onChange={(e) => setReplaceAudio(e.target.checked)}
              />
              Replace original audio
            </label>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={runSync}
            className="w-full h-12 rounded-rs bg-cyan text-black font-bold disabled:opacity-40"
          >
            Sync onto video
          </button>
        </div>
      )}

      {tab === "extract" && (
        <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-6 space-y-4">
          <div className="mono text-[10px] text-violet-soft">02 — EXTRACT FULL + STEMS</div>
          <p className="text-sm text-white/50">
            Pulls full.wav plus heuristic voice / music stems from a Template Forge upload.
          </p>
          <input
            value={extractUploadId}
            onChange={(e) => setExtractUploadId(e.target.value)}
            placeholder="Video uploadId"
            className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-white/60">
            <input type="checkbox" checked={stems} onChange={(e) => setStems(e.target.checked)} />
            Split voice + music stems
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={runExtract}
            className="w-full h-12 rounded-rs bg-violet text-white font-bold disabled:opacity-40"
          >
            Extract audio
          </button>
        </div>
      )}

      {tab === "clone" && (
        <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-6 space-y-4">
          <div className="mono text-[10px] text-orange">03 — VOICE CLONE (ELEVENLABS IVC)</div>
          <p className="text-sm text-white/50">
            Upload 30s–3min clean speech. Requires ELEVENLABS_API_KEY in Model Center / .env.
          </p>
          <input
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            placeholder="Voice profile name"
            className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          />
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a"
            onChange={(e) => setCloneSample(e.target.files?.[0] || null)}
            className="w-full text-sm text-white/60"
          />
          <textarea
            value={cloneDesc}
            onChange={(e) => setCloneDesc(e.target.value)}
            placeholder="Optional description"
            className="w-full min-h-[80px] rounded-rs bg-void border border-white/10 p-3 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={runClone}
            className="w-full h-12 rounded-rs bg-orange text-black font-bold disabled:opacity-40"
          >
            Clone voice
          </button>
          {profiles.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <div className="mono text-[9px] text-white/40">LOCAL PROFILES</div>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setVoiceProfileId(p.id)}
                  className="w-full text-left px-3 py-2 rounded-rs border border-white/10 text-sm hover:bg-white/[0.04]"
                >
                  <span className="font-semibold">{p.name}</span>
                  <span className="mono text-[10px] text-white/40 ml-2">{p.status}</span>
                  {p.error && <div className="text-[11px] text-red-400 mt-1">{p.error}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "tts" && (
        <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-6 space-y-4">
          <div className="mono text-[10px] text-violet-soft">04 — VOICE FORGE TTS</div>
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            placeholder="Script lines to speak…"
            className="w-full min-h-[140px] rounded-rs bg-void border border-white/10 p-3 text-sm"
          />
          <select
            value={voiceProfileId}
            onChange={(e) => setVoiceProfileId(e.target.value)}
            className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          >
            <option value="">Cloned profile (optional)</option>
            {profiles
              .filter((p) => p.status === "ready")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <select
            value={stockVoiceId}
            onChange={(e) => setStockVoiceId(e.target.value)}
            className="w-full h-11 rounded-rs bg-void border border-white/10 px-3 text-sm"
          >
            <option value="">Stock ElevenLabs voice (optional)</option>
            {eleven.map((v) => (
              <option key={v.voiceId} value={v.voiceId}>
                {v.name}
                {v.category ? ` · ${v.category}` : ""}
              </option>
            ))}
          </select>
          {elevenErr && <div className="text-[12px] text-orange/90">{elevenErr}</div>}
          <button
            type="button"
            disabled={busy}
            onClick={runTts}
            className="w-full h-12 rounded-rs bg-violet text-white font-bold disabled:opacity-40"
          >
            Generate speech
          </button>
        </div>
      )}

      {tab === "library" && (
        <div className="rounded-rs-xl border border-white/[0.08] bg-panel p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="mono text-[10px] text-white/40">SOUND LIBRARY</div>
            <button type="button" onClick={refresh} className="text-[12px] text-cyan">
              Refresh
            </button>
          </div>
          {library.length === 0 && <div className="text-sm text-white/40">No audio assets yet.</div>}
          {library.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-rs border border-white/10 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {a.type} · {a.labels.filter((l) => l !== "sound-studio").join(" · ") || a.key}
                </div>
                <div className="mono text-[9px] text-white/35 truncate mt-1">{a.id}</div>
                {a.meta?.text && (
                  <div className="text-[11px] text-white/45 mt-1 line-clamp-2">{a.meta.text}</div>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 text-[11px] text-cyan"
                onClick={() => {
                  setAudioAssetId(a.id);
                  setTab("sync");
                  setMsg(`Selected asset ${a.id}`);
                }}
              >
                Use
              </button>
            </div>
          ))}
        </div>
      )}

      {msg && (
        <div className="rounded-rs border border-white/10 bg-void px-4 py-3 text-sm text-white/70 break-all">
          {msg}
        </div>
      )}
    </div>
  );
}
