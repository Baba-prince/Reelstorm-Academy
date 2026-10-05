export type VideoGenRequest = {
  prompt: string;
  firstFrameUrl?: string;
  durationSec?: number;
  aspectRatio?: string;
  soulIdRef?: string;
  roomRef?: string;
  templateId?: string;
};

export type VideoGenResult = {
  provider: "seedance" | "kling" | "veo";
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  videoUrl?: string;
  error?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateWithSeedance(req: VideoGenRequest): Promise<VideoGenResult> {
  const key = process.env.SEEDANCE_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!key) {
    return mockResult("seedance", req);
  }
  // DashScope Seedance-compatible task create (adapter)
  const res = await fetch(
    process.env.SEEDANCE_API_URL ||
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: process.env.SEEDANCE_MODEL || "seedance-v1",
        input: {
          prompt: req.prompt,
          img_url: req.firstFrameUrl,
        },
        parameters: {
          duration: req.durationSec || 5,
          aspect_ratio: req.aspectRatio || "16:9",
        },
      }),
    },
  );
  if (!res.ok) {
    return { provider: "seedance", jobId: "err", status: "failed", error: await res.text() };
  }
  const data = (await res.json()) as { output?: { task_id?: string }; request_id?: string };
  return {
    provider: "seedance",
    jobId: data.output?.task_id || data.request_id || "unknown",
    status: "queued",
  };
}

export async function generateWithKling(req: VideoGenRequest): Promise<VideoGenResult> {
  const key = process.env.KLING_API_KEY;
  if (!key) return mockResult("kling", req);
  const res = await fetch(process.env.KLING_API_URL || "https://api.klingai.com/v1/videos/text2video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.KLING_MODEL || "kling-v3",
      prompt: req.prompt,
      duration: String(req.durationSec || 5),
      aspect_ratio: req.aspectRatio || "16:9",
      image: req.firstFrameUrl,
    }),
  });
  if (!res.ok) {
    return { provider: "kling", jobId: "err", status: "failed", error: await res.text() };
  }
  const data = (await res.json()) as { data?: { task_id?: string }; task_id?: string };
  return {
    provider: "kling",
    jobId: data.data?.task_id || data.task_id || "unknown",
    status: "queued",
  };
}

export async function generateWithVeo(req: VideoGenRequest): Promise<VideoGenResult> {
  const key = process.env.VEO_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return mockResult("veo", req);
  const res = await fetch(
    process.env.VEO_API_URL ||
      "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1:predictLongRunning",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        instances: [{ prompt: req.prompt }],
        parameters: {
          aspectRatio: req.aspectRatio || "16:9",
          durationSeconds: req.durationSec || 8,
        },
      }),
    },
  );
  if (!res.ok) {
    return { provider: "veo", jobId: "err", status: "failed", error: await res.text() };
  }
  const data = (await res.json()) as { name?: string };
  return { provider: "veo", jobId: data.name || "unknown", status: "queued" };
}

/** Route: Veo dialogue → Seedance music sync → Kling action fallback */
export async function generateVideoRouted(req: VideoGenRequest): Promise<VideoGenResult> {
  const preference = (process.env.VIDEO_PROVIDER || "auto").toLowerCase();
  if (preference === "seedance") return generateWithSeedance(req);
  if (preference === "kling") return generateWithKling(req);
  if (preference === "veo") return generateWithVeo(req);

  // auto: try veo → seedance → kling
  for (const fn of [generateWithVeo, generateWithSeedance, generateWithKling]) {
    const result = await fn(req);
    if (result.status !== "failed") return result;
    await sleep(200);
  }
  return mockResult("seedance", req);
}

function mockResult(
  provider: VideoGenResult["provider"],
  req: VideoGenRequest,
): VideoGenResult {
  return {
    provider,
    jobId: `mock_${provider}_${Date.now()}`,
    status: process.env.MOCK_VIDEO_GEN === "0" ? "failed" : "succeeded",
    videoUrl: process.env.MOCK_VIDEO_URL,
    error:
      process.env.MOCK_VIDEO_GEN === "0"
        ? `No API key for ${provider}. Prompt was: ${req.prompt.slice(0, 80)}`
        : undefined,
  };
}
