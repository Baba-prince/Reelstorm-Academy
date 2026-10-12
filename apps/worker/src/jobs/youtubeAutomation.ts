/**
 * BullMQ job — YouTube Automation OS full 7-agent pipeline
 */
import { runOrchestrator } from "@reelstorm/pipeline";
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
  };
}) {
  const jobId = String(job.id || `yt-${Date.now()}`);
  await trackJob("youtubeAutomation", jobId, "ACTIVE", job.data, { progress: 5 });

  try {
    const result = await runOrchestrator({
      channelId: job.data.channelId,
      niche: job.data.niche,
      auto: job.data.auto,
      avatarId: job.data.avatarId,
      variantId: job.data.variantId,
      topicTitle: job.data.topicTitle,
    });
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
