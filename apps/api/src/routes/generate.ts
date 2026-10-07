/**
 * Studio / dual-saver generate — VPS control plane.
 *
 * Reads from process.env (never hardcode):
 *   RUNPOD_SAVER_URL  — https://xuvnute4l51iog-8000.proxy.runpod.net/generate
 *   RUNPOD_POD_ID     — xuvnute4l51iog
 *
 * Flow: validate RSTUDIO license + minutes → POST saver (600s) → StudioUsageLog → {r2_url, remaining}
 *
 * Factory project enqueue still lives in factory.ts on the same `/api/generate` when `projectId` is set.
 */
export {
  handleStudioGenerate,
  studioGenerateRoutes,
  isStudioGenerateBody,
} from "./studio-generate.js";
