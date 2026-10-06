import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@reelstorm/db";
import { classifyVideoUrl, videoUrlKindLabel } from "@reelstorm/media";
import { enqueue, redisConnection } from "./queue.js";

const TMP = process.env.UPLOAD_TMP_DIR || path.join(process.cwd(), "../../tmp/uploads");

export type StartReferenceOpts = {
  url: string;
  projectId?: string | null;
  analyze?: boolean;
  log?: { error: (obj: unknown, msg?: string) => void; warn: (msg: string) => void };
};

/**
 * Create a VideoUpload + async yt-dlp fetch for YouTube / social / direct links.
 * Returns immediately with uploadId (HTTP 202 pattern).
 */
export async function startReferenceVideoFetch(opts: StartReferenceOpts) {
  const url = opts.url.trim();
  // eslint-disable-next-line no-new
  new URL(url);
  const kind = classifyVideoUrl(url);
  const autoAnalyze = opts.analyze !== false;
  const uploadId = randomUUID();
  const workDir = path.join(TMP, uploadId, "reference");
  await mkdir(workDir, { recursive: true });

  const pending = await prisma.videoUpload.create({
    data: {
      id: uploadId,
      projectId: opts.projectId || null,
      filename: "reference-pending",
      mimeType: "video/mp4",
      bytes: BigInt(0),
      s3Key: `uploads/video/${uploadId}/reference.mp4`,
      status: "PENDING",
      progressPct: 2,
      progressMsg: `Fetching ${videoUrlKindLabel(kind)} reference…`,
      analysisJson: { sourceUrl: url, sourceKind: kind },
    },
  });

  void (async () => {
    try {
      const { downloadReferenceVideo, uploadFile, publicUrl } = await import("@reelstorm/media");

      const result = await downloadReferenceVideo(url, workDir, async (pct, message) => {
        await prisma.videoUpload.update({
          where: { id: uploadId },
          data: { progressPct: Math.min(40, pct), progressMsg: message, status: "UPLOADED" },
        });
        try {
          await redisConnection().publish(
            `analysis:${uploadId}`,
            JSON.stringify({
              uploadId,
              stage: "uploading",
              percent: Math.min(40, pct),
              message,
            }),
          );
        } catch {
          /* redis optional during download */
        }
      });

      const { stat } = await import("node:fs/promises");
      const st = await stat(result.localPath);
      const safeName = path.basename(result.localPath);
      const s3Key = `uploads/video/${uploadId}/${safeName}`;

      try {
        await uploadFile(s3Key, result.localPath, "video/mp4");
      } catch {
        opts.log?.warn("S3 optional — local reference kept");
      }

      await prisma.videoUpload.update({
        where: { id: uploadId },
        data: {
          filename: safeName,
          bytes: BigInt(st.size),
          s3Key,
          s3Url: publicUrl(s3Key),
          durationSec: result.durationSec,
          status: autoAnalyze ? "ANALYZING" : "UPLOADED",
          progressPct: 45,
          progressMsg: `Downloaded “${result.title}” — ${autoAnalyze ? "queued for analysis" : "ready"}`,
          analysisJson: {
            sourceUrl: result.webpageUrl || url,
            sourceKind: kind,
            title: result.title,
            extractor: result.extractor,
            localPath: result.localPath,
          },
        },
      });

      await prisma.asset.create({
        data: {
          projectId: opts.projectId || null,
          type: "video",
          key: s3Key,
          url: publicUrl(s3Key),
          mimeType: "video/mp4",
          bytes: BigInt(st.size),
          labels: ["upload", "web-reference", kind, result.extractor || "url"],
          meta: {
            uploadId,
            localPath: result.localPath,
            sourceUrl: result.webpageUrl || url,
            title: result.title,
            sourceKind: kind,
          },
        },
      });

      if (autoAnalyze) {
        await enqueue("analyzeVideo", {
          uploadId,
          localPath: result.localPath,
          s3Key,
          projectId: opts.projectId || null,
        });
      }

      try {
        await redisConnection().publish(
          `analysis:${uploadId}`,
          JSON.stringify({
            uploadId,
            stage: autoAnalyze ? "analyzing" : "ready",
            percent: 45,
            message: autoAnalyze
              ? `Downloaded ${videoUrlKindLabel(kind)} — analyzing DNA…`
              : "Reference ready",
          }),
        );
      } catch {
        /* ignore */
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      opts.log?.error({ err }, "reference from-url failed");
      await prisma.videoUpload.update({
        where: { id: uploadId },
        data: {
          status: "FAILED",
          error: message,
          progressMsg: "Web reference failed",
          progressPct: 0,
        },
      });
      try {
        await redisConnection().publish(
          `analysis:${uploadId}`,
          JSON.stringify({ uploadId, stage: "failed", percent: 0, error: message }),
        );
      } catch {
        /* ignore */
      }
    }
  })();

  return {
    uploadId,
    kind,
    kindLabel: videoUrlKindLabel(kind),
    upload: pending,
    wsChannel: `analysis:${uploadId}`,
  };
}
