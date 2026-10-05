import { writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { VideoTemplate, SceneBeat } from "@reelstorm/domain";
import {
  analyzeVideo,
  suggestStylePresetName,
  type ProgressFn,
  type VideoAnalysis,
} from "./video-analyzer.js";

function scenesToBeats(analysis: VideoAnalysis): SceneBeat[] {
  return analysis.scenes.map((s, i) => ({
    index: i,
    startSec: s.startSec,
    endSec: s.endSec,
    cameraMove: analysis.styleDna.cameraMoves[i % analysis.styleDna.cameraMoves.length] || "static",
    framing: analysis.styleDna.framing[i % analysis.styleDna.framing.length] || "medium",
    transition: i === 0 ? "fade" : "cut",
  }));
}

export async function extractTemplateFromVideo(opts: {
  inputPath: string;
  workDir: string;
  sourceUploadId: string;
  name?: string;
  onProgress?: ProgressFn;
}): Promise<{ template: VideoTemplate; analysis: VideoAnalysis; jsonPath: string }> {
  const analysis = await analyzeVideo(opts.inputPath, opts.workDir, opts.onProgress);
  await opts.onProgress?.("template_extract", 97, "Building reusable template JSON");

  const stylePreset = suggestStylePresetName(analysis.styleDna);
  const template: VideoTemplate = {
    id: randomUUID(),
    name: opts.name || `${stylePreset} Template`,
    stylePreset,
    sourceUploadId: opts.sourceUploadId,
    durationSec: analysis.probe.durationSec,
    fps: analysis.probe.fps || 24,
    aspectRatio:
      analysis.probe.width && analysis.probe.height
        ? `${analysis.probe.width}:${analysis.probe.height}`
        : "16:9",
    lut: analysis.styleDna.lutHint,
    colorGrade: analysis.styleDna.colorGrade,
    scenes: scenesToBeats(analysis),
    characterPositions: [],
    cameraMoves: analysis.styleDna.cameraMoves,
    audioStems: {
      voice: analysis.audio.voice,
      music: analysis.audio.music,
      sfx: analysis.audio.sfx,
    },
    metadata: {
      width: analysis.probe.width,
      height: analysis.probe.height,
      cutRatePerMin: analysis.styleDna.cutRatePerMin,
      lighting: analysis.styleDna.lighting,
      faces: analysis.faces,
      rooms: analysis.rooms,
    },
    createdAt: new Date().toISOString(),
  };

  const jsonPath = path.join(opts.workDir, "template.json");
  await writeFile(jsonPath, JSON.stringify(template, null, 2), "utf8");
  return { template, analysis, jsonPath };
}
