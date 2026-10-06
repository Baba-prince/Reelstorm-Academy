/**
 * Production API gates for ~1000 users.
 * Used by /api/readiness and scripts/check-production-apis.
 */

export type ProdCheckStatus = "pass" | "partial" | "fail";

export type ProdCheck = {
  id: string;
  tier: "A" | "B" | "C" | "infra";
  label: string;
  status: ProdCheckStatus;
  detail: string;
  weight: number;
};

function present(v: string | undefined | null): boolean {
  return Boolean(v && String(v).trim().length > 0);
}

function isLocalHost(url: string): boolean {
  return /127\.0\.0\.1|localhost|0\.0\.0\.0/i.test(url);
}

/** Whether object storage is production-grade (not broken / unconfigured). */
export function isProductionObjectStorage(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  const endpoint =
    env.S3_ENDPOINT ||
    env.R2_ENDPOINT ||
    (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");
  const access = env.S3_ACCESS_KEY_ID || env.R2_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || "";
  const secret =
    env.S3_SECRET_ACCESS_KEY || env.R2_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || "";
  if (env.STORAGE_PROVIDER === "R2" && present(env.R2_ACCESS_KEY_ID) && present(env.R2_SECRET_ACCESS_KEY)) {
    return true;
  }
  if (!present(access) || !present(secret)) {
    return env.S3_LOCAL_OK === "1";
  }
  if (access === "minio" && secret === "minio123") {
    return env.S3_LOCAL_OK === "1";
  }
  if (endpoint && isLocalHost(endpoint)) return env.S3_LOCAL_OK === "1";
  if (!endpoint) return present(env.S3_BUCKET) || present(env.R2_BUCKET) || present(env.AWS_ACCESS_KEY_ID);
  return /^https:\/\//i.test(endpoint);
}

export function evaluateProductionApis(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): ProdCheck[] {
  const checks: ProdCheck[] = [];

  // —— Tier A: platform ——
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  checks.push({
    id: "supabase",
    tier: "A",
    label: "Supabase Auth + Postgres",
    status: present(supabaseUrl) ? "pass" : "fail",
    detail: present(supabaseUrl)
      ? "URL configured — use Pro plan for ~1000 users"
      : "Set SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL",
    weight: 10,
  });

  const google = present(env.GOOGLE_CLIENT_ID) || present(env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  checks.push({
    id: "google_oauth",
    tier: "A",
    label: "Google OAuth",
    status: google ? "pass" : "fail",
    detail: google
      ? "Client ID present — ensure enabled in Supabase Auth → Providers"
      : "Set GOOGLE_CLIENT_ID (+ secret in Supabase)",
    weight: 8,
  });

  const stripeSecret = env.STRIPE_SECRET_KEY || "";
  const stripeLive = stripeSecret.startsWith("sk_live_");
  const stripeTest = stripeSecret.startsWith("sk_test_");
  const stripeWh = present(env.STRIPE_TIER_WEBHOOK_SECRET);
  const stripePk = present(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  let stripeStatus: ProdCheckStatus = "fail";
  let stripeDetail = "Set STRIPE_SECRET_KEY (sk_live_…) + webhook + publishable key";
  if (stripeLive && stripeWh) {
    stripeStatus = stripePk ? "pass" : "partial";
    stripeDetail = stripePk
      ? "Live Stripe + webhook ready"
      : "Live secret OK — add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_)";
  } else if (stripeTest && stripeWh) {
    stripeStatus = "partial";
    stripeDetail = "Test mode only — upgrade to sk_live_ / pk_live_ for real charges";
  } else if (present(stripeSecret)) {
    stripeStatus = "partial";
    stripeDetail = "Secret present but webhook or mode incomplete";
  }
  checks.push({
    id: "stripe",
    tier: "A",
    label: "Stripe live billing",
    status: stripeStatus,
    detail: stripeDetail,
    weight: 10,
  });

  const redis = env.REDIS_URL || "";
  checks.push({
    id: "redis_config",
    tier: "A",
    label: "Redis / BullMQ",
    status: present(redis) ? "pass" : "fail",
    detail: present(redis) ? redis.replace(/\/\/.*@/, "//***@") : "Set REDIS_URL",
    weight: 6,
  });

  checks.push({
    id: "object_storage",
    tier: "A",
    label: "Object storage (S3 / R2)",
    status: isProductionObjectStorage(env)
      ? env.S3_LOCAL_OK === "1" || isLocalHost(env.S3_ENDPOINT || "")
        ? "partial"
        : "pass"
      : "fail",
    detail: isProductionObjectStorage(env)
      ? env.S3_LOCAL_OK === "1" || isLocalHost(env.S3_ENDPOINT || "")
        ? `VPS MinIO staging (${env.S3_BUCKET || "reelstorm"}) — migrate to Cloudflare R2 for 1k scale`
        : `Bucket ${env.S3_BUCKET || "reelstorm"} via ${env.S3_ENDPOINT || "AWS"}`
      : "Point S3_* at Cloudflare R2 or AWS S3 (or S3_LOCAL_OK=1 with working MinIO)",
    weight: 10,
  });

  // —— Tier B: AI ——
  const dash = present(env.DASHSCOPE_API_KEY);
  const seedance = present(env.SEEDANCE_API_KEY) || dash;
  checks.push({
    id: "dashscope",
    tier: "B",
    label: "DashScope LLM (qwen)",
    status: dash ? "pass" : "partial",
    detail: dash
      ? `model=${env.DASHSCOPE_MODEL || "qwen-plus"}`
      : "Optional for MVP — set DASHSCOPE_API_KEY (Ollama fallback for guide/orchestrate)",
    weight: 9,
  });

  const mockOff = env.MOCK_VIDEO_GEN === "0" || env.MOCK_VIDEO_GEN === "false";
  let videoStatus: ProdCheckStatus = "fail";
  let videoDetail = "Set DASHSCOPE_API_KEY or SEEDANCE_API_KEY and MOCK_VIDEO_GEN=0";
  if (seedance && mockOff) {
    videoStatus = "pass";
    videoDetail = "Seedance path live (MOCK_VIDEO_GEN=0)";
  } else if (seedance && !mockOff) {
    videoStatus = "partial";
    videoDetail = "Key present but MOCK_VIDEO_GEN is on — set MOCK_VIDEO_GEN=0";
  } else if (!mockOff) {
    videoStatus = "partial";
    videoDetail = "Demo mock video path — add DashScope/Seedance key + MOCK_VIDEO_GEN=0 for real renders";
  } else {
    videoStatus = "fail";
    videoDetail = "MOCK_VIDEO_GEN=0 but no Seedance/DashScope key — generates will fail";
  }
  checks.push({
    id: "video_gen",
    tier: "B",
    label: "Seedance video gen",
    status: videoStatus,
    detail: videoDetail,
    weight: 12,
  });

  const eleven = present(env.ELEVENLABS_API_KEY);
  checks.push({
    id: "elevenlabs",
    tier: "B",
    label: "ElevenLabs Voice Forge",
    status: eleven ? "pass" : "partial",
    detail: eleven
      ? `model=${env.ELEVENLABS_MODEL || "eleven_multilingual_v2"}`
      : "Optional until Sound Studio — set ELEVENLABS_API_KEY (Creator/Pro) for voice",
    weight: 8,
  });

  // —— Infra scale ——
  const conc = Number(env.WORKER_CONCURRENCY || 2);
  checks.push({
    id: "worker_concurrency",
    tier: "infra",
    label: "Worker concurrency",
    status: conc >= 8 ? "pass" : conc >= 4 ? "partial" : "fail",
    detail: `WORKER_CONCURRENCY=${conc} (target ≥8 for ~1000 users)`,
    weight: 6,
  });

  // —— Tier C optional ——
  checks.push({
    id: "kling",
    tier: "C",
    label: "Kling fallback (optional)",
    status: present(env.KLING_API_KEY) ? "pass" : "partial",
    detail: present(env.KLING_API_KEY) ? "Configured" : "Optional — add KLING_API_KEY later",
    weight: 2,
  });
  checks.push({
    id: "veo",
    tier: "C",
    label: "Veo premium (optional)",
    status: present(env.VEO_API_KEY) || present(env.GOOGLE_API_KEY) ? "pass" : "partial",
    detail:
      present(env.VEO_API_KEY) || present(env.GOOGLE_API_KEY)
        ? "Configured"
        : "Optional — enable for Storm Pro only",
    weight: 2,
  });

  return checks;
}

export function scoreProductionChecks(checks: ProdCheck[]): {
  pct: number;
  grade: string;
  readyFor1k: boolean;
  blocking: string[];
} {
  let earned = 0;
  let total = 0;
  const blocking: string[] = [];
  for (const c of checks) {
    if (c.tier === "C") continue; // optional — don't block grade hard
    total += c.weight;
    if (c.status === "pass") earned += c.weight;
    else if (c.status === "partial") earned += c.weight * 0.5;
    if ((c.tier === "A" || c.tier === "B" || c.tier === "infra") && c.status === "fail") {
      blocking.push(c.id);
    }
  }
  const pct = total ? Math.round((earned / total) * 100) : 0;
  const grade = pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 60 ? "C" : pct >= 40 ? "D" : "F";
  const readyFor1k =
    blocking.length === 0 &&
    checks.some((c) => c.id === "stripe" && c.status !== "fail") &&
    checks.some((c) => c.id === "video_gen" && c.status !== "fail") &&
    checks.some((c) => c.id === "object_storage" && c.status !== "fail");
  return { pct, grade, readyFor1k, blocking };
}

/** Env keys operators must set for production 1k launch */
export const PRODUCTION_1K_ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_TIER_WEBHOOK_SECRET",
  "STRIPE_PRICE_STORM",
  "STRIPE_PRICE_STORM_PRO",
  "DASHSCOPE_API_KEY",
  "ELEVENLABS_API_KEY",
  "MOCK_VIDEO_GEN",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_PUBLIC_URL",
  "S3_REGION",
  "REDIS_URL",
  "WORKER_CONCURRENCY",
  "VIDEO_PROVIDER",
] as const;
