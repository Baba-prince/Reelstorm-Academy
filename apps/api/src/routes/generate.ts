/**
 * Studio / dual-saver generate — VPS control plane.
 *
 * Reads from process.env (never hardcode):
 *   RUNPOD_SAVER_URL  — https://xuvnute41511og-8000.proxy.runpod.net/generate
 *   RUNPOD_POD_ID     — xuvnute41511og
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
