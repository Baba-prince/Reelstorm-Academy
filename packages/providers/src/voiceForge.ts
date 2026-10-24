/**
 * Self-hosted Voice Forge client — replaces ElevenLabs on the critical path.
 * Talks to tools/voice-forge (XTTS on RunPod / local piper|espeak fallback).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type VoiceRequest = {
  text: string;
  voiceId?: string;
  modelId?: string;
};

export type VoiceCloneRequest = {
  name: string;
  samplePaths: string[];
  description?: string;
};

export type ForgeVoice = {
  voiceId: string;
  name: string;
  category?: string;
  previewUrl?: string;
  status?: string;
  engine?: string;
};

function forgeBase(): string {
  const raw =
    process.env.VOICE_FORGE_URL ||
    process.env.VOICE_ENGINE_URL ||
    "http://127.0.0.1:8090";
  return raw.replace(/\/$/, "");
}

export async function listVoices(): Promise<{ voices: ForgeVoice[]; error?: string }> {
  try {
    const res = await fetch(`${forgeBase()}/voice/voices`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { voices: [], error: await res.text() };
    const data = (await res.json()) as {
      voices?: Array<{
        voice_id?: string;
        voiceId?: string;
        name?: string;
        status?: string;
        engine?: string;
      }>;
    };
    return {
      voices: (data.voices || []).map((v) => ({
        voiceId: v.voice_id || v.voiceId || "",
        name: v.name || "voice",
        category: "voice-forge",
        status: v.status,
        engine: v.engine,
      })),
    };
  } catch (e) {
    return { voices: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function synthesizeVoice(
  req: VoiceRequest,
): Promise<{ audioUrl?: string; audioBase64?: string; error?: string; engine?: string }> {
  try {
    const res = await fetch(`${forgeBase()}/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: req.text,
        voice_id: req.voiceId || process.env.VOICE_FORGE_DEFAULT_ID || undefined,
        format: "mp3",
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) return { error: await res.text() };
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      audioBase64: buf.toString("base64"),
      engine: res.headers.get("X-Voice-Engine") || "voice-forge",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Instant voice clone — upload sample to self-hosted forge */
export async function cloneVoice(
  req: VoiceCloneRequest,
): Promise<{ voiceId?: string; name?: string; error?: string }> {
  if (!req.samplePaths.length) return { error: "At least one sample audio file required" };
  try {
    const sample = req.samplePaths[0];
    const buf = await readFile(sample);
    const filename = sample.split(/[/\\]/).pop() || "sample.wav";
    const form = new FormData();
    form.append("name", req.name);
    if (req.description) form.append("description", req.description);
    form.append("file", new Blob([buf], { type: "audio/wav" }), filename);

    const res = await fetch(`${forgeBase()}/voice/clone`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) return { error: await res.text() };
    const data = (await res.json()) as { voice_id?: string; name?: string };
    if (!data.voice_id) return { error: "Clone response missing voice_id" };
    return { voiceId: data.voice_id, name: data.name || req.name };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function synthesizeVoiceToFile(
  req: VoiceRequest,
  outputPath: string,
): Promise<{ path?: string; error?: string; engine?: string }> {
  const result = await synthesizeVoice(req);
  if (result.error || !result.audioBase64) return { error: result.error || "No audio" };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(result.audioBase64, "base64"));
  return { path: outputPath, engine: result.engine };
}

/** Health probe for Voice Forge */
export async function voiceForgeHealth(): Promise<{ ok: boolean; detail?: unknown }> {
  try {
    const res = await fetch(`${forgeBase()}/voice/health`, { signal: AbortSignal.timeout(10_000) });
    const detail = await res.json().catch(() => ({}));
    return { ok: res.ok, detail };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}
