/**
 * BullMQ job — YouTube Automation OS full 7-agent pipeline (+ production-only wake retry)
 */
import {
  runOrchestrator,
  agentProduction,
} from "@reelstorm/pipeline";
import {
  ensurePodAliveOrFallback,
  getPodStatus,
  wakePod,
  markGpuJobActivity,
} from "@reelstorm/media";
import { trackJob } from "../lib.js";

export async function youtubeAutomationJob(job: {
  id?: string;
  data: {
    channelId: string;
    niche?: string;
    auto?: boolean;
    avatarId?: string;
    variantId?: string;
    topicTitle?: string;
    userId?: string;
    productionOnly?: boolean;
    videoId?: string;
  };
  opts?: { attemptsMade?: number };
}) {
  const jobId = String(job.id || `yt-${Date.now()}`);
  await trackJob("youtubeAutomation", jobId, "ACTIVE", job.data, { progress: 5 });

  try {
    // Production-only retry after pod wake (from /api/youtube/production/assemble)
    if (job.data.productionOnly && job.data.videoId) {
      const engine = await ensurePodAliveOrFallback();
      if (engine === "failed") {
        const status = await getPodStatus();
        if (status === "SLEEPING" || status === "WAKING") {
          await wakePod();
          // Throw so BullMQ retries with backoff (enqueue already set delay/attempts)
          throw new Error(`Pod ${status} — waking; will retry`);
        }
      }
      const result = await agentProduction({
        videoId: job.data.videoId,
        avatarId: job.data.avatarId,
        variantId: job.data.variantId,
      });
      markGpuJobActivity();
      await trackJob("youtubeAutomation", jobId, "COMPLETED", job.data, {
        progress: 100,
        result,
      });
      return result;
    }

    if (!job.data.channelId || job.data.channelId === "deferred") {
      throw new Error("channelId required for full orchestrator");
    }

    const result = await runOrchestrator({
      channelId: job.data.channelId,
      niche: job.data.niche,
      auto: job.data.auto,
      avatarId: job.data.avatarId,
      variantId: job.data.variantId,
      topicTitle: job.data.topicTitle,
    });
    markGpuJobActivity();
    await trackJob("youtubeAutomation", jobId, "COMPLETED", job.data, {
      progress: 100,
      result,
    });
    return result;
  } catch (err) {
    await trackJob("youtubeAutomation", jobId, "FAILED", job.data, {
      error: (err as Error).message,
    });
    throw err;
  }
}
