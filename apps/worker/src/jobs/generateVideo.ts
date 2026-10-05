import type { Job } from "bullmq";
import { prisma } from "@reelstorm/db";
import { generateVideoRouted, orchestrate } from "@reelstorm/providers";
import { trackJob } from "../lib.js";

export type GenerateVideoPayload = {
  projectId: string;
  templateId?: string;
  script?: string | null;
  vibe?: string;
};

export async function generateVideoJob(job: Job<GenerateVideoPayload>) {
  const { projectId, templateId, vibe } = job.data;
  await trackJob("generateVideo", String(job.id), "ACTIVE", job.data);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { template: true, soulIds: true, rooms: true, storyboards: true },
  });
  if (!project) throw new Error("Project not found");

  const template =
    (templateId
      ? await prisma.videoTemplate.findUnique({ where: { id: templateId } })
      : project.template) || null;

  const script = job.data.script || project.script || "";
  const style = template?.stylePreset || "STORM Signature";

  const promptPlan = await orchestrate([
    {
      role: "system",
      content:
        "You are STORM Engine. Given a script and a style template, produce a concise video generation prompt. Keep Soul ID and room consistency.",
    },
    {
      role: "user",
      content: JSON.stringify({
        script,
        vibe,
        stylePreset: style,
        template: template?.templateJson,
        soulIds: project.soulIds.map((s) => s.name),
        rooms: project.rooms.map((r) => r.name),
      }),
    },
  ]).catch(() => `Generate ${style} video for: ${script.slice(0, 500)}`);

  const result = await generateVideoRouted({
    prompt: promptPlan,
    templateId: template?.id,
    soulIdRef: project.soulIds[0]?.faceHash,
    roomRef: project.rooms[0]?.id,
    durationSec: 5,
  });

  // Create a placeholder block for the generation
  const index =
    ((await prisma.block.aggregate({ where: { projectId }, _max: { index: true } }))._max.index ||
      0) + 1;

  const block = await prisma.block.create({
    data: {
      projectId,
      index,
      title: `ARCHIVE5::BLOCK_${String(index).padStart(3, "0")}`,
      durationSec: 300,
      status: result.status === "failed" ? "FAILED" : "RENDERING",
      templateId: template?.id,
      archive5Json: {
        provider: result.provider,
        jobId: result.jobId,
        prompt: promptPlan,
        stylePreset: style,
        videoUrl: result.videoUrl,
      },
    },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: result.status === "failed" ? "FAILED" : "GENERATING" },
  });

  await trackJob("generateVideo", String(job.id), result.status === "failed" ? "FAILED" : "COMPLETED", job.data, {
    progress: 100,
    result: { blockId: block.id, ...result },
    error: result.error,
  });

  return { block, result };
}
