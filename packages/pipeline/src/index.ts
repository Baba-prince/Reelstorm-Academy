import type { PipelineStage } from "@reelstorm/domain";

/**
 * STORM OS factory pipeline
 * videoUpload → analyze → template → generate  (NEW path)
 * script → worldBuilder → storyboard → generate → compose → archive → merge
 */
export const STORM_PIPELINE: PipelineStage[] = [
  "script",
  "videoUpload",
  "analyze",
  "template",
  "worldBuilder",
  "storyboard",
  "generate",
  "compose",
  "archive",
  "merge",
];

export const VIDEO_TEMPLATE_PATH: PipelineStage[] = [
  "videoUpload",
  "analyze",
  "template",
  "generate",
  "archive",
  "merge",
];

export const SCRIPT_PATH: PipelineStage[] = [
  "script",
  "worldBuilder",
  "storyboard",
  "generate",
  "compose",
  "archive",
  "merge",
];

export type PipelineJobName =
  | "analyzeVideo"
  | "extractTemplate"
  | "generateVideo"
  | "archiveBlock"
  | "mergeMaster";

export function nextStage(current: PipelineStage, path: PipelineStage[] = STORM_PIPELINE): PipelineStage | null {
  const i = path.indexOf(current);
  if (i < 0 || i >= path.length - 1) return null;
  return path[i + 1];
}

export function queueForStage(stage: PipelineStage): PipelineJobName | null {
  switch (stage) {
    case "analyze":
      return "analyzeVideo";
    case "template":
      return "extractTemplate";
    case "generate":
      return "generateVideo";
    case "archive":
      return "archiveBlock";
    case "merge":
      return "mergeMaster";
    default:
      return null;
  }
}
