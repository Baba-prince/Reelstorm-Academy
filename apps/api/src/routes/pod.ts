/**
 * Pod autonomy APIs — status + wake (no RunPod dashboard needed)
 */
import type { FastifyInstance } from "fastify";
import {
  probePodHealth,
  wakePod,
  stopPod,
  getPodStatus,
  getLastWakeError,
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
      const detail = getLastWakeError();
      return reply.code(503).send({
        ...after,
        ok: false,
        error:
          detail ||
          "Wake failed — check RUNPOD_API_KEY + RUNPOD_POD_ID, or set RUNPOD_SERVERLESS_URL / HEYGEN_API_KEY",
        hint: detail?.includes("not enough free GPUs")
          ? "Host machine is full (balance OK). Retry Wake later, deploy a new pod on another host in RunPod console, or Avatar Generate will use photo+TTS fallback. Optional: RUNPOD_SERVERLESS_URL / HEYGEN_API_KEY."
          : detail?.toLowerCase().includes("balance") || detail?.toLowerCase().includes("credit")
            ? "Top up RunPod balance, then retry POST /api/pod/wake"
            : undefined,
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
