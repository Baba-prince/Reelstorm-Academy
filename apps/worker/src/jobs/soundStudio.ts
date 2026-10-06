import path from "node:path";
import { mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import type { Job } from "bullmq";
import { prisma } from "@reelstorm/db";
import {
  downloadExternalAudio,
  extractAudioStems,
  extractAudioTrack,
  muxAudioOntoVideo,
  normalizeAudio,
  uploadFile,
  publicUrl,
} from "@reelstorm/media";
import { cloneVoice, synthesizeVoiceToFile } from "@reelstorm/providers";
import { trackJob } from "../lib.js";

export type SoundStudioPayload = {
  action: "fromUrl" | "extract" | "sync" | "clone" | "tts";
  soundId?: string;
  voiceProfileId?: string;
  url?: string;
  uploadId?: string | null;
  videoAssetId?: string | null;
  audioAssetId?: string | null;
  localPath?: string | null;
  videoLocalPath?: string;
  audioLocalPath?: string;
  projectId?: string | null;
  format?: "wav" | "mp3" | "m4a";
  stems?: boolean;
  replace?: boolean;
  offsetSec?: number;
  name?: string;
  sampleAssetIds?: string[];
  sampleLocalPaths?: string[];
  description?: string | null;
  text?: string;
  voiceId?: string | null;
};

const TMP = () => process.env.UPLOAD_TMP_DIR || path.join(process.cwd(), "../../tmp/uploads");

async function exists(p?: string | null) {
  if (!p) return false;
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveAssetLocal(assetId?: string | null) {
  if (!assetId) return null;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  const local = (asset?.meta as { localPath?: string } | null)?.localPath;
  return local && (await exists(local)) ? { asset, local } : asset ? { asset, local: null } : null;
}

async function resolveUploadLocal(uploadId?: string | null) {
  if (!uploadId) return null;
  const upload = await prisma.videoUpload.findUnique({ where: { id: uploadId } });
  if (!upload) return null;
  const asset = await prisma.asset.findFirst({ where: { key: upload.s3Key } });
  const local = (asset?.meta as { localPath?: string } | null)?.localPath;
  return { upload, local: local && (await exists(local)) ? local : null };
}

export async function soundStudioJob(job: Job<SoundStudioPayload>) {
  const data = job.data;
  await trackJob("soundStudio", String(job.id), "ACTIVE", data as Record<string, unknown>);

  const outBase = path.join(TMP(), "sound", data.soundId || data.voiceProfileId || String(job.id));
  await mkdir(outBase, { recursive: true });

  try {
    if (data.action === "fromUrl") {
      if (!data.url) throw new Error("url required");
      const dl = await downloadExternalAudio(data.url, outBase, async (pct, msg) => {
        await job.updateProgress(pct);
        console.log(`[sound/fromUrl] ${pct}% ${msg}`);
      });
      const s3Key = `sound/${data.soundId}/${path.basename(dl.localPath)}`;
      try {
        await uploadFile(s3Key, dl.localPath, "audio/mpeg");
      } catch {
        /* local ok */
      }
      const asset = await prisma.asset.create({
        data: {
          projectId: data.projectId || null,
          type: "audio",
          key: s3Key,
          url: publicUrl(s3Key),
          mimeType: "audio/mpeg",
          labels: ["sound-studio", "external", "from-url"],
          meta: {
            localPath: dl.localPath,
            sourceUrl: data.url,
            title: dl.title,
            soundId: data.soundId,
            extractor: dl.extractor,
          },
        },
      });
      const result = { assetId: asset.id, localPath: dl.localPath, title: dl.title };
      await trackJob("soundStudio", String(job.id), "COMPLETED", data as Record<string, unknown>, {
        progress: 100,
        result,
      });
      return result;
    }

    if (data.action === "extract") {
      let input =
        data.localPath && (await exists(data.localPath)) ? data.localPath : null;
      if (!input && data.uploadId) {
        const u = await resolveUploadLocal(data.uploadId);
        input = u?.local || null;
      }
      if (!input && data.videoAssetId) {
        const a = await resolveAssetLocal(data.videoAssetId);
        input = a?.local || null;
      }
      if (!input) throw new Error("Could not resolve video local path for extract");

      const format = data.format || "wav";
      const fullPath = path.join(outBase, `full.${format}`);
      await extractAudioTrack(input, fullPath, format);

      const assets: { label: string; id: string; path: string }[] = [];
      const fullKey = `sound/${data.soundId}/full.${format}`;
      try {
        await uploadFile(fullKey, fullPath, format === "mp3" ? "audio/mpeg" : "audio/wav");
      } catch {
        /* ok */
      }
      const fullAsset = await prisma.asset.create({
        data: {
          projectId: data.projectId || null,
          type: "audio",
          key: fullKey,
          url: publicUrl(fullKey),
          mimeType: format === "mp3" ? "audio/mpeg" : "audio/wav",
          labels: ["sound-studio", "extract", "full"],
          meta: { localPath: fullPath, soundId: data.soundId, source: input },
        },
      });
      assets.push({ label: "full", id: fullAsset.id, path: fullPath });

      if (data.stems !== false) {
        const stems = await extractAudioStems(input, outBase);
        for (const [label, p] of [
          ["voice", stems.voice],
          ["music", stems.music],
        ] as const) {
          if (!p || !(await exists(p))) continue;
          const key = `sound/${data.soundId}/${label}.wav`;
          try {
            await uploadFile(key, p, "audio/wav");
          } catch {
            /* ok */
          }
          const a = await prisma.asset.create({
            data: {
              projectId: data.projectId || null,
              type: "voice_stem",
              key,
              url: publicUrl(key),
              mimeType: "audio/wav",
              labels: ["sound-studio", "stem", label],
              meta: { localPath: p, soundId: data.soundId, stem: label },
            },
          });
          assets.push({ label, id: a.id, path: p });
        }
      }

      const result = { assets, soundId: data.soundId };
      await trackJob("soundStudio", String(job.id), "COMPLETED", data as Record<string, unknown>, {
        progress: 100,
        result,
      });
      return result;
    }

    if (data.action === "sync") {
      let videoPath =
        data.videoLocalPath && (await exists(data.videoLocalPath)) ? data.videoLocalPath : null;
      if (!videoPath && data.uploadId) {
        videoPath = (await resolveUploadLocal(data.uploadId))?.local || null;
      }
      if (!videoPath && data.videoAssetId) {
        videoPath = (await resolveAssetLocal(data.videoAssetId))?.local || null;
      }

      let audioPath =
        data.audioLocalPath && (await exists(data.audioLocalPath)) ? data.audioLocalPath : null;
      if (!audioPath && data.audioAssetId) {
        audioPath = (await resolveAssetLocal(data.audioAssetId))?.local || null;
      }
      if (!videoPath || !audioPath) {
        throw new Error("Need resolvable local video + audio paths for sync");
      }

      const outPath = path.join(outBase, `synced_${Date.now()}.mp4`);
      await muxAudioOntoVideo(videoPath, audioPath, outPath, {
        replace: data.replace !== false,
        offsetSec: data.offsetSec || 0,
      });
      const s3Key = `sound/${data.soundId}/synced.mp4`;
      try {
        await uploadFile(s3Key, outPath, "video/mp4");
      } catch {
        /* ok */
      }
      const asset = await prisma.asset.create({
        data: {
          projectId: data.projectId || null,
          type: "synced_video",
          key: s3Key,
          url: publicUrl(s3Key),
          mimeType: "video/mp4",
          labels: ["sound-studio", "synced"],
          meta: {
            localPath: outPath,
            soundId: data.soundId,
            offsetSec: data.offsetSec || 0,
            replace: data.replace !== false,
          },
        },
      });
      const result = { assetId: asset.id, localPath: outPath };
      await trackJob("soundStudio", String(job.id), "COMPLETED", data as Record<string, unknown>, {
        progress: 100,
        result,
      });
      return result;
    }

    if (data.action === "clone") {
      const paths: string[] = [...(data.sampleLocalPaths || [])];
      for (const id of data.sampleAssetIds || []) {
        const a = await resolveAssetLocal(id);
        if (a?.local) paths.push(a.local);
      }
      if (!paths.length) throw new Error("No sample audio paths resolved for clone");

      // Normalize first sample for cleaner IVC
      const normalized = path.join(outBase, "clone_sample.wav");
      try {
        await normalizeAudio(paths[0], normalized);
        paths[0] = normalized;
      } catch {
        /* use original */
      }

      const cloned = await cloneVoice({
        name: data.name || "ReelStorm Voice",
        samplePaths: paths,
        description: data.description || undefined,
      });

      if (cloned.error || !cloned.voiceId) {
        if (data.voiceProfileId) {
          await prisma.voiceProfile.update({
            where: { id: data.voiceProfileId },
            data: { status: "failed", error: cloned.error || "clone failed" },
          });
        }
        throw new Error(cloned.error || "Voice clone failed");
      }

      const profile = data.voiceProfileId
        ? await prisma.voiceProfile.update({
            where: { id: data.voiceProfileId },
            data: {
              status: "ready",
              providerVoiceId: cloned.voiceId,
              error: null,
            },
          })
        : await prisma.voiceProfile.create({
            data: {
              name: data.name || "ReelStorm Voice",
              projectId: data.projectId || null,
              providerVoiceId: cloned.voiceId,
              sampleAssetIds: data.sampleAssetIds || [],
              status: "ready",
            },
          });

      const result = { voiceProfileId: profile.id, providerVoiceId: cloned.voiceId };
      await trackJob("soundStudio", String(job.id), "COMPLETED", data as Record<string, unknown>, {
        progress: 100,
        result,
      });
      return result;
    }

    if (data.action === "tts") {
      if (!data.text) throw new Error("text required");
      const outPath = path.join(outBase, `tts_${Date.now()}.mp3`);
      const synth = await synthesizeVoiceToFile(
        { text: data.text, voiceId: data.voiceId || undefined },
        outPath,
      );
      if (synth.error || !synth.path) throw new Error(synth.error || "TTS failed");

      const s3Key = `sound/${data.soundId}/tts.mp3`;
      try {
        await uploadFile(s3Key, synth.path, "audio/mpeg");
      } catch {
        /* ok */
      }
      const asset = await prisma.asset.create({
        data: {
          projectId: data.projectId || null,
          type: "tts",
          key: s3Key,
          url: publicUrl(s3Key),
          mimeType: "audio/mpeg",
          labels: ["sound-studio", "tts", "voice-forge"],
          meta: {
            localPath: synth.path,
            soundId: data.soundId,
            voiceId: data.voiceId,
            voiceProfileId: data.voiceProfileId,
            text: data.text.slice(0, 500),
          },
        },
      });
      const result = { assetId: asset.id, localPath: synth.path };
      await trackJob("soundStudio", String(job.id), "COMPLETED", data as Record<string, unknown>, {
        progress: 100,
        result,
      });
      return result;
    }

    throw new Error(`Unknown sound action: ${data.action}`);
  } catch (err) {
    await trackJob("soundStudio", String(job.id), "FAILED", data as Record<string, unknown>, {
      error: (err as Error).message,
    });
    throw err;
  }
}
