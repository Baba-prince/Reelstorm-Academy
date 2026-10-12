/**
 * Pod autonomy APIs — status + wake (no RunPod dashboard needed)
 */
import type { FastifyInstance } from "fastify";
import {
  probePodHealth,
  wakePod,
  stopPod,
  getPodStatus,
  isServerlessConfigured,
  markGpuJobActivity,
} from "@reelstorm/media";

export async function podRoutes(app: FastifyInstance) {
  app.get("/api/pod/status", async () => {
    const payload = await probePodHealth();
    return payload;
  });

  app.post("/api/pod/wake", async (_req, reply) => {
    if (isServerlessConfigured()) {
      return {
        ok: true,
        status: "RUNNING",
        message: "Serverless endpoint configured — no resume needed",
        isServerless: true,
      };
    }
    const before = await getPodStatus();
    if (before === "RUNNING") {
      markGpuJobActivity();
      return { ok: true, status: "RUNNING", message: "Already running" };
    }
    const woke = await wakePod();
    const after = await probePodHealth();
    if (!woke) {
      return reply.code(503).send({
        ...after,
        ok: false,
        error:
          "Wake failed — check RUNPOD_API_KEY + RUNPOD_POD_ID, or set RUNPOD_SERVERLESS_URL / HEYGEN_API_KEY",
      });
    }
    return { ...after, ok: true };
  });

  /** Manual stop (optional) — serverless ignores */
  app.post("/api/pod/stop", async () => {
    const ok = await stopPod();
    return { ok, status: await getPodStatus(), isServerless: isServerlessConfigured() };
  });
}
