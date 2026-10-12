/**
 * RunPod autonomous pod manager — wake on demand, never require dashboard clicks.
 *
 * Modes:
 * - Serverless (RUNPOD_SERVERLESS_URL): always available, scales to 0
 * - On-demand pod: health probe → GraphQL podResume → poll until RUNNING
 * - Fallback: HEYGEN_API_KEY still lands on our R2
 */

export type PodStatus = "RUNNING" | "SLEEPING" | "WAKING" | "FAILED" | "UNKNOWN";

export type PodEngine = "pod" | "serverless" | "heygen" | "failed";

export type PodStatusPayload = {
  status: PodStatus;
  ok: boolean;
  r2_ok: boolean;
  mode: string | null;
  engine: string | null;
  lastChecked: string;
  isServerless: boolean;
  podId: string;
  podUrl: string;
  autoStart: boolean;
  heygenFallback: boolean;
  waking?: boolean;
  error?: string;
};

let wakingUntil = 0;
let lastGpuJobAt = 0;

export function markGpuJobActivity() {
  lastGpuJobAt = Date.now();
}

export function lastGpuJobMs() {
  return lastGpuJobAt;
}

export function podId() {
  return (process.env.RUNPOD_POD_ID || "xuvnute4l51iog").trim();
}

export function podBaseUrl() {
  const explicit = (process.env.RUNPOD_POD_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const saver = (process.env.RUNPOD_SAVER_URL || process.env.SAVER_URL || "").trim();
  if (saver) {
    return saver.replace(/\/$/, "").replace(/\/generate$/i, "");
  }
  const port = (process.env.RUNPOD_SAVER_PORT || "8000").trim();
  return `https://${podId()}-${port}.proxy.runpod.net`;
}

export function saverGenerateUrl() {
  const raw = (process.env.RUNPOD_SAVER_URL || process.env.SAVER_URL || "").trim();
  if (raw) {
    const base = raw.replace(/\/$/, "");
    return base.endsWith("/generate") ? base : `${base}/generate`;
  }
  return `${podBaseUrl()}/generate`;
}

export function isServerlessConfigured() {
  return Boolean((process.env.RUNPOD_SERVERLESS_URL || "").trim());
}

export function isAutoStartEnabled() {
  return process.env.POD_AUTO_START !== "0";
}

function apiKey() {
  return (
    process.env.RUNPOD_API_KEY ||
    process.env.RUNPOD_SERVERLESS_API_KEY ||
    ""
  ).trim();
}

export async function getPodStatus(): Promise<PodStatus> {
  if (isServerlessConfigured()) {
    // Serverless scales from zero — treat as always available for routing
    return "RUNNING";
  }

  if (Date.now() < wakingUntil) return "WAKING";

  const healthUrl = `${podBaseUrl()}/health`;
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return "SLEEPING";
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      r2_ok?: boolean;
      status?: string;
    };
    if (data.ok || data.r2_ok || data.status === "ok") return "RUNNING";
    return "UNKNOWN";
  } catch {
    return "SLEEPING";
  }
}

export async function probePodHealth(): Promise<PodStatusPayload> {
  const isServerless = isServerlessConfigured();
  const lastChecked = new Date().toISOString();
  const base: Omit<PodStatusPayload, "status" | "ok" | "r2_ok" | "mode" | "engine"> = {
    lastChecked,
    isServerless,
    podId: podId(),
    podUrl: podBaseUrl(),
    autoStart: isAutoStartEnabled(),
    heygenFallback: Boolean(process.env.HEYGEN_API_KEY),
  };

  if (isServerless) {
    return {
      ...base,
      status: "RUNNING",
      ok: true,
      r2_ok: true,
      mode: "SERVERLESS",
      engine: "runpod-serverless",
    };
  }

  if (Date.now() < wakingUntil) {
    return {
      ...base,
      status: "WAKING",
      ok: false,
      r2_ok: false,
      mode: null,
      engine: null,
      waking: true,
    };
  }

  try {
    const res = await fetch(`${podBaseUrl()}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      r2_ok?: boolean;
      mode?: string;
      engine?: string;
    };
    if (res.ok && (data.ok || data.r2_ok)) {
      return {
        ...base,
        status: "RUNNING",
        ok: Boolean(data.ok ?? true),
        r2_ok: Boolean(data.r2_ok ?? true),
        mode: data.mode || "REAL",
        engine: data.engine || "saver",
      };
    }
    return {
      ...base,
      status: res.status === 404 ? "SLEEPING" : "UNKNOWN",
      ok: false,
      r2_ok: false,
      mode: data.mode || null,
      engine: data.engine || null,
      error: `health ${res.status}`,
    };
  } catch (e) {
    return {
      ...base,
      status: "SLEEPING",
      ok: false,
      r2_ok: false,
      mode: null,
      engine: null,
      error: (e as Error).message,
    };
  }
}

async function runpodGraphql(query: string) {
  const key = apiKey();
  if (!key) throw new Error("RUNPOD_API_KEY missing — cannot resume pod via API");
  const res = await fetch("https://api.runpod.io/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json: { data?: unknown; errors?: Array<{ message?: string }> } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`RunPod GraphQL non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || json.errors?.length) {
    throw new Error(
      json.errors?.map((e) => e.message).join("; ") || `RunPod GraphQL ${res.status}`,
    );
  }
  return json.data;
}

export async function wakePod(): Promise<boolean> {
  if (isServerlessConfigured()) return true;

  const status = await getPodStatus();
  if (status === "RUNNING") return true;

  if (!isAutoStartEnabled()) return false;

  wakingUntil = Date.now() + Number(process.env.POD_WAKE_TIMEOUT_MS || 90_000);

  try {
    await runpodGraphql(
      `mutation { podResume(input:{podId:"${podId()}"}) { id desiredStatus } }`,
    );
  } catch (err) {
    console.error("[podManager] podResume failed", (err as Error).message);
    // Some accounts use podStart / resumePod naming — try alternate
    try {
      await runpodGraphql(
        `mutation { podStart(input:{podId:"${podId()}"}) { id desiredStatus } }`,
      );
    } catch (err2) {
      console.error("[podManager] podStart failed", (err2 as Error).message);
      wakingUntil = 0;
      return false;
    }
  }

  const timeout = Number(process.env.POD_WAKE_TIMEOUT_MS || 90_000);
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await new Promise((r) => setTimeout(r, 5000));
    if ((await getPodStatus()) === "RUNNING") {
      wakingUntil = 0;
      markGpuJobActivity();
      return true;
    }
  }
  wakingUntil = 0;
  return false;
}

export async function stopPod(): Promise<boolean> {
  if (isServerlessConfigured()) return true; // scales to 0 automatically
  try {
    await runpodGraphql(`mutation { podStop(input:{podId:"${podId()}"}) { id } }`);
    return true;
  } catch (err) {
    console.error("[podManager] podStop failed", (err as Error).message);
    return false;
  }
}

/**
 * Pick engine before any GPU generate work.
 * Returns serverless | pod | heygen | failed.
 */
export async function ensurePodAliveOrFallback(): Promise<PodEngine> {
  const enginePref = (process.env.AVATAR_ENGINE || "auto").toLowerCase();

  if (enginePref === "heygen") {
    return process.env.HEYGEN_API_KEY ? "heygen" : "failed";
  }

  if (isServerlessConfigured()) {
    return "serverless";
  }

  const status = await getPodStatus();
  if (status === "RUNNING") return "pod";

  if (isAutoStartEnabled()) {
    const woke = await wakePod();
    if (woke) return "pod";
  }

  if (process.env.HEYGEN_API_KEY) return "heygen";
  return "failed";
}

/** Call serverless /runsync with saver-shaped input */
export async function callServerlessGenerate(payload: {
  prompt: string;
  duration?: number;
  resolution?: string;
}): Promise<{
  r2_url?: string;
  error?: string;
  engine?: string;
  mock?: boolean;
  real_r2?: boolean;
  note?: string;
}> {
  const url = (process.env.RUNPOD_SERVERLESS_URL || "").trim();
  const key = apiKey();
  if (!url) throw new Error("RUNPOD_SERVERLESS_URL not set");
  if (!key) throw new Error("RUNPOD_API_KEY not set for serverless");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: payload.prompt,
        duration: payload.duration ?? 30,
        resolution: payload.resolution || "720x1280",
      },
    }),
    signal: AbortSignal.timeout(600_000),
  });

  type SaverOut = {
    r2_url?: string;
    error?: string;
    engine?: string;
    mock?: boolean;
    real_r2?: boolean;
    note?: string;
  };
  const json = (await res.json().catch(() => ({}))) as SaverOut & {
    output?: SaverOut;
    status?: string;
  };

  const out: SaverOut = json.output || json;
  if (!res.ok) {
    return { error: json.error || out.error || `serverless ${res.status}` };
  }
  markGpuJobActivity();
  return {
    r2_url: out.r2_url,
    error: out.error,
    engine: out.engine || "runpod-serverless",
    mock: out.mock,
    real_r2: out.real_r2 !== false,
    note: out.note,
  };
}

/** Generate via on-demand pod /generate after ensure */
export async function callPodGenerate(payload: {
  prompt: string;
  duration?: number;
  resolution?: string;
}): Promise<{
  r2_url?: string;
  error?: string;
  engine?: string;
  mock?: boolean;
  real_r2?: boolean;
  note?: string;
}> {
  const url = saverGenerateUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: payload.prompt,
      duration: payload.duration ?? 30,
      resolution: payload.resolution || "720x1280",
    }),
    signal: AbortSignal.timeout(600_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    r2_url?: string;
    error?: string;
    engine?: string;
    mock?: boolean;
    real_r2?: boolean;
    note?: string;
  };
  if (!res.ok || !json.r2_url) {
    return { error: json.error || `pod generate ${res.status}`, ...json };
  }
  markGpuJobActivity();
  return {
    r2_url: json.r2_url,
    engine: json.engine || "runpod-pod",
    mock: Boolean(json.mock),
    real_r2: json.real_r2 !== false,
    note: json.note,
  };
}

/**
 * Unified GPU generate: serverless → pod (auto-wake) → heygen signal.
 * Caller handles heygen rendering when engine === 'heygen'.
 */
export async function generateWithAutonomousPod(payload: {
  prompt: string;
  duration?: number;
  resolution?: string;
}): Promise<{
  engine: PodEngine;
  r2_url?: string;
  mock?: boolean;
  real_r2?: boolean;
  note?: string;
  saverEngine?: string;
  error?: string;
  podStatus?: PodStatus;
}> {
  const engine = await ensurePodAliveOrFallback();
  if (engine === "failed") {
    return {
      engine,
      error:
        "GPU pod sleeping and wake failed, and no HEYGEN_API_KEY fallback. Set RUNPOD_API_KEY or RUNPOD_SERVERLESS_URL.",
      podStatus: await getPodStatus(),
    };
  }
  if (engine === "heygen") {
    return { engine, note: "Use HeyGen bridge — caller uploads result to R2" };
  }
  if (engine === "serverless") {
    const out = await callServerlessGenerate(payload);
    if (!out.r2_url) {
      return { engine, error: out.error || "serverless returned no r2_url", podStatus: "RUNNING" };
    }
    return {
      engine,
      r2_url: out.r2_url,
      mock: out.mock,
      real_r2: out.real_r2,
      note: out.note,
      saverEngine: out.engine,
      podStatus: "RUNNING",
    };
  }
  // pod
  const out = await callPodGenerate(payload);
  if (!out.r2_url) {
    // Last chance heygen
    if (process.env.HEYGEN_API_KEY) {
      return { engine: "heygen", note: `pod generate failed: ${out.error}` };
    }
    return {
      engine: "failed",
      error: out.error || "pod generate failed",
      podStatus: await getPodStatus(),
    };
  }
  return {
    engine: "pod",
    r2_url: out.r2_url,
    mock: out.mock,
    real_r2: out.real_r2,
    note: out.note,
    saverEngine: out.engine,
    podStatus: "RUNNING",
  };
}

/** Idle auto-stop: true if we should stop the on-demand pod */
export function shouldAutoStopIdle(): boolean {
  if (isServerlessConfigured()) return false;
  if (process.env.POD_AUTO_STOP_IDLE_MIN === "0") return false;
  const mins = Number(process.env.POD_AUTO_STOP_IDLE_MIN || 15);
  if (!lastGpuJobAt) return false; // never started a job this process — don't stop
  return Date.now() - lastGpuJobAt > mins * 60_000;
}
