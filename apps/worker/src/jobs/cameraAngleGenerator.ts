/**
 * BullMQ — Camera Angle Prompt Studio full pipeline
 */
import { runCameraOrchestrator } from "@reelstorm/pipeline";
import { trackJob } from "../lib.js";

export async function cameraAngleGeneratorJob(job: {
  id?: string;
  data: { jobId: string; userId?: string };
}) {
  const bullId = String(job.id || `cam-${Date.now()}`);
  await trackJob("cameraAngleGenerator", bullId, "ACTIVE", job.data, { progress: 5 });
  try {
    if (!job.data.jobId) throw new Error("jobId required");
    const result = await runCameraOrchestrator(job.data.jobId);
    await trackJob("cameraAngleGenerator", bullId, "COMPLETED", job.data, {
      progress: 100,
      result: { status: result.status, promptCount: Array.isArray(result.prompts) ? result.prompts.length : 0 },
    });
    return result;
  } catch (err) {
    await trackJob("cameraAngleGenerator", bullId, "FAILED", job.data, {
      error: (err as Error).message,
    });
    throw err;
  }
}
