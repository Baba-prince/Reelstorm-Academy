import { z } from "zod";

/** Locked story intent before any pixels move */
export const StoryContractSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  logline: z.string().min(1),
  genre: z.string().default("drama"),
  tone: z.string().default("cinematic"),
  durationMinutes: z.number().min(1).max(120).default(5),
  targetBlocks: z.number().min(1).max(12).default(1),
  script: z.string().min(1),
  language: z.string().default("en"),
  vibeNotes: z.string().optional(),
});
export type StoryContract = z.infer<typeof StoryContractSchema>;

/** Immutable character face identity */
export const SoulIdSchema = z.object({
  id: z.string(),
  name: z.string(),
  faceHash: z.string(),
  angles: z.object({
    front: z.string().url().or(z.string()),
    left: z.string().url().or(z.string()),
    right: z.string().url().or(z.string()),
    threeQuarter: z.string().url().or(z.string()),
  }),
  loraRef: z.string().optional(),
  locked: z.boolean().default(true),
});
export type SoulId = z.infer<typeof SoulIdSchema>;

/** Architectum 4-angle room plates */
export const RoomMemorySchema = z.object({
  id: z.string(),
  name: z.string(),
  plates: z.object({
    wide: z.string(),
    medium: z.string(),
    overShoulder: z.string(),
    close: z.string(),
  }),
  lightingLocked: z.boolean().default(true),
  lut: z.string().optional(),
});
export type RoomMemory = z.infer<typeof RoomMemorySchema>;

export const CameraMoveSchema = z.enum([
  "static",
  "pan",
  "tilt",
  "dolly",
  "zoom",
  "handheld",
  "crane",
  "orbit",
]);
export type CameraMove = z.infer<typeof CameraMoveSchema>;

export const SceneBeatSchema = z.object({
  index: z.number(),
  startSec: z.number(),
  endSec: z.number(),
  cameraMove: CameraMoveSchema.default("static"),
  framing: z.enum(["wide", "medium", "osh", "close"]).default("medium"),
  transition: z.string().default("cut"),
  dialogue: z.string().optional(),
  notes: z.string().optional(),
});
export type SceneBeat = z.infer<typeof SceneBeatSchema>;

/** Extracted reusable video template from uploaded reference video */
export const VideoTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  stylePreset: z.string(), // e.g. "MrBeast Fast Cut" | "A24 Cinematic"
  sourceUploadId: z.string(),
  durationSec: z.number(),
  fps: z.number().default(24),
  aspectRatio: z.string().default("16:9"),
  lut: z.string().optional(),
  colorGrade: z.object({
    contrast: z.number().optional(),
    saturation: z.number().optional(),
    temperature: z.number().optional(),
    shadows: z.string().optional(),
    highlights: z.string().optional(),
  }).optional(),
  scenes: z.array(SceneBeatSchema),
  characterPositions: z.array(z.object({
    soulHint: z.string().optional(),
    frame: z.number(),
    x: z.number(),
    y: z.number(),
  })).default([]),
  cameraMoves: z.array(CameraMoveSchema).default([]),
  audioStems: z.object({
    voice: z.string().optional(),
    music: z.string().optional(),
    sfx: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime().optional(),
});
export type VideoTemplate = z.infer<typeof VideoTemplateSchema>;

export const AssetTypeSchema = z.enum([
  "video",
  "audio",
  "image",
  "script",
  "template",
  "videoTemplate",
  "soulId",
  "roomPlate",
  "archive5",
  "block",
  "master",
]);

export const AssetCenterItemSchema = z.object({
  id: z.string(),
  type: AssetTypeSchema,
  projectId: z.string().optional(),
  key: z.string(), // S3 key
  url: z.string().optional(),
  mimeType: z.string().optional(),
  bytes: z.number().optional(),
  checksum: z.string().optional(),
  labels: z.array(z.string()).default([]),
  meta: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime().optional(),
});
export type AssetCenterItem = z.infer<typeof AssetCenterItemSchema>;

export const Archive5BlockSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  index: z.number(),
  durationSec: z.number().default(300),
  title: z.string(),
  videoAssetId: z.string().optional(),
  jsonAssetId: z.string().optional(),
  soulIds: z.array(z.string()).default([]),
  roomIds: z.array(z.string()).default([]),
  templateId: z.string().optional(),
  status: z.enum(["pending", "rendering", "qc", "archived", "failed"]).default("pending"),
});
export type Archive5Block = z.infer<typeof Archive5BlockSchema>;

export const PipelineStageSchema = z.enum([
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
]);
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const AnalysisProgressSchema = z.object({
  uploadId: z.string(),
  stage: z.enum([
    "queued",
    "uploading",
    "probing",
    "scene_detect",
    "style_dna",
    "faces",
    "rooms",
    "audio",
    "template_extract",
    "block_split",
    "complete",
    "failed",
  ]),
  percent: z.number().min(0).max(100),
  message: z.string().optional(),
  error: z.string().optional(),
});
export type AnalysisProgress = z.infer<typeof AnalysisProgressSchema>;

export const MAX_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
export const MAX_AUDIO_UPLOAD_BYTES = 200 * 1024 * 1024; // 200MB
export const ARCHIVE5_BLOCK_SECONDS = 300; // 5 min
export const ALLOWED_VIDEO_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
] as const;
export const ALLOWED_AUDIO_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
] as const;
export * from "./rtc.js";
export * from "./guide.js";
export * from "./template-room.js";
export * from "./production.js";
export * from "./blueprint.js";
export * from "./intro-catalog.js";
export * from "./cover-art.js";
export * from "./admin.js";
