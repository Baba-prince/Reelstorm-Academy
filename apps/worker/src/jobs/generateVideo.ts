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
    include: {
      template: true,
      soulIds: true,
      rooms: true,
      storyboards: true,
      studioSets: {
        where: { status: "applied" },
        orderBy: { appliedAt: "desc" },
        take: 1,
        include: { rooms: true, artists: true, imagery: true },
      },
    },
  });
  if (!project) throw new Error("Project not found");

  const template =
    (templateId
      ? await prisma.videoTemplate.findUnique({ where: { id: templateId } })
      : project.template) || null;

  const studioSet = project.studioSets[0] || null;
  const script = job.data.script || project.script || "";
  const style =
    studioSet?.imagery[0]?.stylePreset ||
    template?.stylePreset ||
    "STORM Signature";
  const imageryPrompt =
    studioSet?.imagery[0]?.customizedPrompt ||
    studioSet?.imagery[0]?.prompt ||
    studioSet?.rooms[0]?.promptDna ||
    "";

  const promptPlan = await orchestrate([
    {
      role: "system",
      content:
        "You are STORM Engine. Given a script, Full Studio Set (room plates + artist souls + imagery), and a style template, produce a concise video generation prompt. Keep Soul ID and room/set consistency across angles.",
    },
    {
      role: "user",
      content: JSON.stringify({
        script,
        vibe,
        stylePreset: style,
        imageryPrompt,
        template: template?.templateJson,
        studioSet: studioSet
          ? {
              id: studioSet.id,
              rooms: studioSet.rooms.map((r) => ({
                name: r.name,
                plates: r.platesJson,
                promptDna: r.promptDna,
              })),
              artists: studioSet.artists.map((a) => ({
                name: a.name,
                role: a.role,
                plates: a.platesJson,
                soulId: a.soulId,
              })),
            }
          : null,
        soulIds: project.soulIds.map((s) => ({
          name: s.name,
          faceHash: s.faceHash,
          front: s.frontKey,
          left: s.leftKey,
          right: s.rightKey,
          threeQ: s.threeQKey,
        })),
        rooms: project.rooms.map((r) => ({
          id: r.id,
          name: r.name,
          wide: r.wideKey,
          medium: r.mediumKey,
          osh: r.oshKey,
          close: r.closeKey,
        })),
      }),
    },
  ]).catch(
    () =>
      `Generate ${style} video for: ${script.slice(0, 400)}${imageryPrompt ? ` · set: ${imageryPrompt.slice(0, 200)}` : ""}`,
  );

  const appliedSoulId = studioSet?.artists.find((a) => a.soulId)?.soulId;
  const lockedSoul =
    (appliedSoulId &&
      project.soulIds.find((s) => s.id === appliedSoulId)?.faceHash) ||
    project.soulIds[0]?.faceHash;
  const lockedRoom =
    studioSet?.rooms[0]?.roomPlateId || project.rooms[0]?.id;

  const result = await generateVideoRouted({
    prompt: promptPlan,
    templateId: template?.id,
    soulIdRef: lockedSoul,
    roomRef: lockedRoom,
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
