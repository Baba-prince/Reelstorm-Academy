/** Re-export media video analyzer as a provider surface for workers */
export {
  analyzeVideo,
  extractTemplateFromVideo,
  suggestStylePresetName,
} from "@reelstorm/media";

export type { VideoAnalysis, ProgressFn, StyleDna } from "@reelstorm/media";
