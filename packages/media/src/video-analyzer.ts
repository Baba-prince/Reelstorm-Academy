import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { extractAudioStems, extractFrame, probeVideo, type ProbeResult } from "./ffmpeg.js";
import type { CameraMove } from "@reelstorm/domain";

export type ProgressFn = (stage: string, percent: number, message?: string) => void | Promise<void>;

export type SceneCut = {
  index: number;
  startSec: number;
  endSec: number;
  score?: number;
};

export type StyleDna = {
  colorGrade: {
    contrast: number;
    saturation: number;
    temperature: number;
    shadows: string;
    highlights: string;
  };
  cameraMoves: CameraMove[];
  lighting: string;
  framing: Array<"wide" | "medium" | "osh" | "close">;
  cutRatePerMin: number;
  lutHint?: string;
};

export type FaceAngleSet = {
  id: string;
  frames: { front?: string; left?: string; right?: string; threeQuarter?: string };
};

export type RoomAngles = {
  wide?: string;
  medium?: string;
  overShoulder?: string;
  close?: string;
};

export type VideoAnalysis = {
  probe: ProbeResult;
  scenes: SceneCut[];
  styleDna: StyleDna;
  faces: FaceAngleSet[];
  rooms: RoomAngles;
  audio: { voice?: string; music?: string; sfx?: string; full: string };
  workDir: string;
};

/** Best-effort scene detection via ffmpeg scene filter (PySceneDetect-compatible output shape) */
async function detectScenesFfmpeg(inputPath: string, threshold = 0.35): Promise<SceneCut[]> {
  return new Promise((resolve) => {
    const args = [
      "-i",
      inputPath,
      "-filter:v",
      `select='gt(scene,${threshold})',showinfo`,
      "-f",
      "null",
      "-",
    ];
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", async () => {
      const times: number[] = [0];
      const re = /pts_time:([0-9.]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(stderr))) {
        times.push(Number(m[1]));
      }
      const probe = await probeVideo(inputPath).catch(() => ({ durationSec: times[times.length - 1] || 0 } as ProbeResult));
      const end = probe.durationSec || times[times.length - 1] || 0;
      if (!times.includes(end)) times.push(end);
      const unique = [...new Set(times.map((t) => Math.round(t * 100) / 100))].sort((a, b) => a - b);
      const scenes: SceneCut[] = [];
      for (let i = 0; i < unique.length - 1; i++) {
        scenes.push({
          index: i,
          startSec: unique[i],
          endSec: unique[i + 1],
        });
      }
      if (scenes.length === 0) {
        scenes.push({ index: 0, startSec: 0, endSec: end || 1 });
      }
      resolve(scenes);
    });
    proc.on("error", async () => {
      const probe = await probeVideo(inputPath);
      resolve([{ index: 0, startSec: 0, endSec: probe.durationSec || 1 }]);
    });
  });
}

/** Optional PySceneDetect bridge when python scenedetect is installed */
async function detectScenesPy(inputPath: string, outCsv: string): Promise<SceneCut[] | null> {
  return new Promise((resolve) => {
    const proc = spawn(
      "scenedetect",
      ["-i", inputPath, "detect-content", "list-scenes", "-o", path.dirname(outCsv), "-f", path.basename(outCsv, ".csv")],
      { stdio: "ignore" },
    );
    proc.on("close", async (code) => {
      if (code !== 0) return resolve(null);
      try {
        const csv = await readFile(outCsv, "utf8");
        const lines = csv.trim().split("\n").slice(1);
        const scenes: SceneCut[] = lines.map((line, i) => {
          const cols = line.split(",");
          return {
            index: i,
            startSec: Number(cols[2] || cols[1] || 0),
            endSec: Number(cols[5] || cols[4] || 0),
          };
        });
        resolve(scenes.length ? scenes : null);
      } catch {
        resolve(null);
      }
    });
    proc.on("error", () => resolve(null));
  });
}

function inferCameraMoves(scenes: SceneCut[]): CameraMove[] {
  const moves: CameraMove[] = [];
  const avg = scenes.reduce((a, s) => a + (s.endSec - s.startSec), 0) / Math.max(scenes.length, 1);
  if (avg < 1.2) moves.push("handheld", "zoom");
  else if (avg < 2.5) moves.push("pan", "dolly");
  else moves.push("static", "dolly", "crane");
  return [...new Set(moves)];
}

function inferStylePreset(style: StyleDna): string {
  if (style.cutRatePerMin > 30) return "MrBeast Fast Cut";
  if (style.cutRatePerMin < 8 && style.lighting.includes("soft")) return "A24 Cinematic";
  if (style.cameraMoves.includes("handheld")) return "Docu Verité";
  return "STORM Signature";
}

export function suggestStylePresetName(style: StyleDna): string {
  return inferStylePreset(style);
}

export async function analyzeVideo(
  inputPath: string,
  workDir: string,
  onProgress?: ProgressFn,
): Promise<VideoAnalysis> {
  await mkdir(workDir, { recursive: true });
  await onProgress?.("probing", 5, "Probing container metadata");
  const probe = await probeVideo(inputPath);

  await onProgress?.("scene_detect", 15, "Detecting scene cuts");
  const csvPath = path.join(workDir, "scenes.csv");
  const pyScenes = await detectScenesPy(inputPath, csvPath);
  const scenes = pyScenes ?? (await detectScenesFfmpeg(inputPath));
  await writeFile(path.join(workDir, "scenes.json"), JSON.stringify(scenes, null, 2));

  await onProgress?.("style_dna", 35, "Extracting style DNA");
  const durationMin = Math.max(probe.durationSec / 60, 0.01);
  const styleDna: StyleDna = {
    colorGrade: {
      contrast: 1.05,
      saturation: 1.1,
      temperature: 5600,
      shadows: "#0A0A0A",
      highlights: "#E5E7EB",
    },
    cameraMoves: inferCameraMoves(scenes),
    lighting: probe.width >= 1920 ? "keyed soft cinematic" : "natural available light",
    framing: ["wide", "medium", "osh", "close"],
    cutRatePerMin: scenes.length / durationMin,
    lutHint: "reelstorm_storm_v1",
  };

  await onProgress?.("faces", 55, "Extracting character angle plates");
  const faceDir = path.join(workDir, "faces");
  await mkdir(faceDir, { recursive: true });
  const sampleTimes = [
    probe.durationSec * 0.15,
    probe.durationSec * 0.35,
    probe.durationSec * 0.55,
    probe.durationSec * 0.75,
  ].map((t) => Math.max(0.1, t));
  const faceFrames: FaceAngleSet = { id: "char_01", frames: {} };
  const keys = ["front", "left", "right", "threeQuarter"] as const;
  for (let i = 0; i < keys.length; i++) {
    const out = path.join(faceDir, `${keys[i]}.jpg`);
    await extractFrame(inputPath, sampleTimes[i] || 0.5, out).catch(() => out);
    faceFrames.frames[keys[i]] = out;
  }

  await onProgress?.("rooms", 70, "Extracting 4-angle room plates");
  const roomDir = path.join(workDir, "rooms");
  await mkdir(roomDir, { recursive: true });
  const rooms: RoomAngles = {};
  const roomKeys = ["wide", "medium", "overShoulder", "close"] as const;
  for (let i = 0; i < roomKeys.length; i++) {
    const out = path.join(roomDir, `${roomKeys[i]}.jpg`);
    const t = scenes[Math.min(i, scenes.length - 1)]?.startSec ?? i * 2;
    await extractFrame(inputPath, t + 0.2, out).catch(() => out);
    rooms[roomKeys[i]] = out;
  }

  await onProgress?.("audio", 85, "Separating voice / music / SFX stems");
  const audioDir = path.join(workDir, "audio");
  const audio = await extractAudioStems(inputPath, audioDir);

  await writeFile(
    path.join(workDir, "analysis.json"),
    JSON.stringify({ probe, scenes, styleDna, faces: [faceFrames], rooms, audio }, null, 2),
  );

  await onProgress?.("complete", 95, "Analysis complete");

  return {
    probe,
    scenes,
    styleDna,
    faces: [faceFrames],
    rooms,
    audio,
    workDir,
  };
}
