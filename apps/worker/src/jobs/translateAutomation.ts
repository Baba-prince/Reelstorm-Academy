/**
 * BullMQ — Language Studio full translate pipeline
 */
import { runTranslateOrchestrator } from "@reelstorm/pipeline";
import { markGpuJobActivity } from "@reelstorm/media";
import { trackJob } from "../lib.js";

export async function translateAutomationJob(job: {
  id?: string;
  data: { jobId: string; userId?: string };
}) {
  const bullId = String(job.id || `tr-${Date.now()}`);
  await trackJob("translateAutomation", bullId, "ACTIVE", job.data, { progress: 5 });
  try {
    if (!job.data.jobId) throw new Error("jobId required");
    const result = await runTranslateOrchestrator(job.data.jobId);
    markGpuJobActivity();
    await trackJob("translateAutomation", bullId, "COMPLETED", job.data, {
      progress: 100,
      result: { status: result.status, finalVideos: result.finalVideos },
    });
    return result;
  } catch (err) {
    await trackJob("translateAutomation", bullId, "FAILED", job.data, {
      error: (err as Error).message,
    });
    throw err;
  }
}
