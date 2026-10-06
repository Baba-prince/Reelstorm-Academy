export type VoiceRequest = {
  text: string;
  voiceId?: string;
  modelId?: string;
};

export type VoiceCloneRequest = {
  name: string;
  /** Local paths to sample WAVs/MP3s (30s–3min recommended) */
  samplePaths: string[];
  description?: string;
};

export type ElevenVoice = {
  voiceId: string;
  name: string;
  category?: string;
  previewUrl?: string;
};

function apiKey() {
  return process.env.ELEVENLABS_API_KEY;
}

export async function listVoices(): Promise<{ voices: ElevenVoice[]; error?: string }> {
  const key = apiKey();
  if (!key) return { voices: [], error: "ELEVENLABS_API_KEY not set" };
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  if (!res.ok) return { voices: [], error: await res.text() };
  const data = (await res.json()) as {
    voices?: Array<{ voice_id: string; name: string; category?: string; preview_url?: string }>;
  };
  return {
    voices: (data.voices || []).map((v) => ({
      voiceId: v.voice_id,
      name: v.name,
      category: v.category,
      previewUrl: v.preview_url,
    })),
  };
}

export async function synthesizeVoice(
  req: VoiceRequest,
): Promise<{ audioUrl?: string; audioBase64?: string; error?: string }> {
  const key = apiKey();
  if (!key) {
    return { error: "ELEVENLABS_API_KEY not set — Voice Forge skipped (native audio preferred)" };
  }
  const voiceId = req.voiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: req.text,
      model_id: req.modelId || process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
    }),
  });
  if (!res.ok) return { error: await res.text() };
  const buf = Buffer.from(await res.arrayBuffer());
  return { audioBase64: buf.toString("base64") };
}

/** Instant voice clone from sample files (ElevenLabs IVC) */
export async function cloneVoice(
  req: VoiceCloneRequest,
): Promise<{ voiceId?: string; name?: string; error?: string }> {
  const key = apiKey();
  if (!key) return { error: "ELEVENLABS_API_KEY not set — cannot clone voice" };
  if (!req.samplePaths.length) return { error: "At least one sample audio file required" };

  const { readFile } = await import("node:fs/promises");
  const form = new FormData();
  form.append("name", req.name);
  if (req.description) form.append("description", req.description);
  form.append("labels", JSON.stringify({ source: "reelstorm-sound-studio" }));

  for (const sample of req.samplePaths) {
    const buf = await readFile(sample);
    const name = sample.split(/[/\\]/).pop() || "sample.wav";
    const mime = name.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
    form.append("files", new Blob([buf], { type: mime }), name);
  }

  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
  });
  if (!res.ok) return { error: await res.text() };
  const data = (await res.json()) as { voice_id?: string };
  if (!data.voice_id) return { error: "Clone response missing voice_id" };
  return { voiceId: data.voice_id, name: req.name };
}

/** Write synthesizeVoice base64 output to a local mp3 path */
export async function synthesizeVoiceToFile(
  req: VoiceRequest,
  outputPath: string,
): Promise<{ path?: string; error?: string }> {
  const result = await synthesizeVoice(req);
  if (result.error || !result.audioBase64) return { error: result.error || "No audio" };
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(result.audioBase64, "base64"));
  return { path: outputPath };
}
