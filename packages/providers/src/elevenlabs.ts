export type VoiceRequest = {
  text: string;
  voiceId?: string;
  modelId?: string;
};

export async function synthesizeVoice(req: VoiceRequest): Promise<{ audioUrl?: string; audioBase64?: string; error?: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return { error: "ELEVENLABS_API_KEY not set — Voice Forge skipped (native audio preferred)" };
  }
  const voiceId = req.voiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
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
    },
  );
  if (!res.ok) return { error: await res.text() };
  const buf = Buffer.from(await res.arrayBuffer());
  return { audioBase64: buf.toString("base64") };
}
