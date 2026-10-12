/**
 * Auto-stop on-demand RunPod after POD_AUTO_STOP_IDLE_MIN (default 15).
 * Serverless endpoints ignore this (scale to 0 themselves).
 */
import {
  shouldAutoStopIdle,
  stopPod,
  isServerlessConfigured,
  getPodStatus,
  lastGpuJobMs,
} from "@reelstorm/media";

export function startPodIdleWatcher() {
  if (isServerlessConfigured()) {
    console.log("[pod-idle] serverless configured — skip on-demand idle stop");
    return;
  }
  if (process.env.POD_AUTO_STOP_IDLE_MIN === "0") {
    console.log("[pod-idle] disabled (POD_AUTO_STOP_IDLE_MIN=0)");
    return;
  }

  const everyMs = 5 * 60_000;
  console.log(
    `[pod-idle] watching every 5m · stop after ${process.env.POD_AUTO_STOP_IDLE_MIN || 15}m idle`,
  );

  setInterval(async () => {
    try {
      if (!shouldAutoStopIdle()) return;
      const status = await getPodStatus();
      if (status !== "RUNNING") return;
      const idleMin = Math.round((Date.now() - lastGpuJobMs()) / 60_000);
      console.log(`[pod-idle] stopping pod after ${idleMin}m idle`);
      await stopPod();
    } catch (e) {
      console.warn("[pod-idle]", (e as Error).message);
    }
  }, everyMs).unref?.();
}
