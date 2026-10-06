import type { FastifyInstance } from "fastify";
import { synthesizeVoice, cloneVoice, listVoices, orchestrate } from "@reelstorm/providers";

/** Health + voice endpoints for production gates + BOT Wizard */
export async function aiHealthRoutes(app: FastifyInstance) {
  app.get("/api/health/dashscope", async () => {
    const key = Boolean(process.env.DASHSCOPE_API_KEY);
    if (!key) {
      return {
        ok: false,
        provider: "dashscope",
        fallback: "ollama",
        detail: "DASHSCOPE_API_KEY missing",
      };
    }
    try {
      const text = await orchestrate(
        [{ role: "user", content: "Reply with OK only." }],
        { timeoutMs: 8000 },
      );
      return {
        ok: true,
        provider: "dashscope",
        model: process.env.DASHSCOPE_MODEL || "qwen-plus",
        sample: text.slice(0, 40),
      };
    } catch (e) {
      return { ok: false, provider: "dashscope", error: (e as Error).message };
    }
  });

  app.get("/api/health/elevenlabs", async () => {
    const key = Boolean(process.env.ELEVENLABS_API_KEY);
    if (!key) return { ok: false, detail: "ELEVENLABS_API_KEY missing" };
    const voices = await listVoices();
    return {
      ok: !voices.error,
      voiceCount: voices.voices.length,
      error: voices.error,
      defaultVoice: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
    };
  });

  app.get("/api/health/video", async () => {
    const mock = process.env.MOCK_VIDEO_GEN !== "0" && process.env.MOCK_VIDEO_GEN !== "false";
    const seedance = Boolean(process.env.SEEDANCE_API_KEY || process.env.DASHSCOPE_API_KEY);
    return {
      ok: seedance && !mock,
      mock,
      seedanceConfigured: seedance,
      provider: process.env.VIDEO_PROVIDER || "auto",
    };
  });

  /** POST /api/voice/generate — ElevenLabs TTS for Wizard Step 2 */
  app.post("/api/voice/generate", async (req, reply) => {
    const body = (req.body || {}) as { text?: string; voiceId?: string; modelId?: string };
    if (!body.text?.trim()) return reply.code(400).send({ error: "text required" });
    const result = await synthesizeVoice({
      text: body.text,
      voiceId: body.voiceId || process.env.ELEVENLABS_VOICE_ID,
      modelId: body.modelId,
    });
    if (result.error) return reply.code(503).send(result);
    return result;
  });

  /** POST /api/voice/clone — IVC from sample paths already on disk */
  app.post("/api/voice/clone", async (req, reply) => {
    const body = (req.body || {}) as {
      name?: string;
      samplePaths?: string[];
      description?: string;
    };
    if (!body.name || !body.samplePaths?.length) {
      return reply.code(400).send({ error: "name and samplePaths required" });
    }
    const result = await cloneVoice({
      name: body.name,
      samplePaths: body.samplePaths,
      description: body.description,
    });
    if (result.error) return reply.code(503).send(result);
    return result;
  });
}
