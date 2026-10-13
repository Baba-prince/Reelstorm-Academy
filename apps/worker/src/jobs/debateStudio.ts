/**
 * BullMQ — AI Podcast Debate Studio full pipeline
 */
import { runDebateOrchestrator } from "@reelstorm/pipeline";
import { trackJob } from "../lib.js";

export async function debateStudioJob(job: {
  id?: string;
  data: { jobId: string; userId?: string };
}) {
  const bullId = String(job.id || `debate-${Date.now()}`);
  await trackJob("debateStudio", bullId, "ACTIVE", job.data, { progress: 5 });
  try {
    if (!job.data.jobId) throw new Error("jobId required");
    const result = await runDebateOrchestrator(job.data.jobId);
    await trackJob("debateStudio", bullId, "COMPLETED", job.data, {
      progress: 100,
      result: {
        status: result.status,
        audioUrl: result.audioUrl,
        videoUrl: result.videoUrl,
      },
    });
    return result;
  } catch (err) {
    await trackJob("debateStudio", bullId, "FAILED", job.data, {
      error: (err as Error).message,
    });
    throw err;
  }
}
