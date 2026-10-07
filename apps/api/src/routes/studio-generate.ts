import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  parseActivatedToken,
  parseLicenseKey,
  remainingMinutes,
  resetBillingPeriodIfNeeded,
  sha256Hex,
} from "../lib/studio-license.js";
import { resolveUserFromAuthHeader } from "./auth.js";

type GenBody = {
  prompt?: string;
  duration?: number;
  license_key?: string;
  fingerprint?: string;
  /** true when request is studio/saver (vs factory projectId) */
  engine?: string;
};

function hashPrompt(prompt: string) {
  return createHash("sha256").update(prompt).digest("hex");
}

function saverUrl(): string {
  const fromEnv = (process.env.RUNPOD_SAVER_URL || "").trim();
  if (!fromEnv) {
    const pod = (process.env.RUNPOD_POD_ID || "xuvnute41511og").trim();
    return `https://${pod}-8000.proxy.runpod.net/generate`;
  }
  return fromEnv.replace(/\/$/, "");
}

/**
 * Resolve Studio license from:
 * 1) activated Bearer token (desktop)
 * 2) RSTUDIO- license_key + fingerprint
 * 3) signed-in user with an active Studio license (web 0MB)
 */
async function resolveStudioLicense(req: FastifyRequest, body: GenBody) {
  const fingerprint = (body.fingerprint || "").trim().toLowerCase();
  const activated = parseActivatedToken(req.headers.authorization || "");

  if (activated) {
    if (fingerprint && fingerprint !== activated.fingerprint) {
      return { error: "Fingerprint mismatch", status: 403 as const };
    }
    let license = await prisma.studioLicense.findUnique({ where: { id: activated.licenseId } });
    if (!license) return { error: "License missing", status: 401 as const };
    license = (await resetBillingPeriodIfNeeded(license.id)) || license;
    const device = await prisma.studioDevice.findFirst({
      where: {
        id: activated.deviceId,
        licenseId: license.id,
        fingerprint: activated.fingerprint,
        revoked: false,
      },
    });
    if (!device) return { error: "Device revoked or unknown", status: 403 as const };
    return { license, deviceId: device.id, fingerprint: activated.fingerprint };
  }

  const licenseKey = (body.license_key || "").trim();
  if (licenseKey) {
    if (!fingerprint || fingerprint.length < 8) {
      return { error: "fingerprint required with license_key", status: 400 as const };
    }
    const payload = parseLicenseKey(licenseKey);
    if (!payload) return { error: "Invalid or expired license key", status: 401 as const };
    let license = await prisma.studioLicense.findUnique({ where: { keyHash: sha256Hex(licenseKey) } });
    if (!license) return { error: "License not found", status: 401 as const };
    if (payload.version !== license.jwtVersion) {
      return { error: "License key was regenerated", status: 401 as const };
    }
    license = (await resetBillingPeriodIfNeeded(license.id)) || license;
    return { license, deviceId: null as string | null, fingerprint };
  }

  // Web session: use first active license for signed-in user
  const user = await resolveUserFromAuthHeader(req.headers.authorization);
  if (user) {
    let license = await prisma.studioLicense.findFirst({
      where: { userId: user.id, status: { in: ["active", "limit_reached", "past_due"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!license) {
      return {
        error: "No Studio license — issue free or subscribe at /download",
        status: 402 as const,
      };
    }
    license = (await resetBillingPeriodIfNeeded(license.id)) || license;
    return {
      license,
      deviceId: null as string | null,
      fingerprint: fingerprint || `web:${user.id}`,
    };
  }

  return { error: "license_key + fingerprint, activated token, or sign-in required", status: 401 as const };
}

export async function handleStudioGenerate(req: FastifyRequest, reply: FastifyReply) {
  const body = (req.body || {}) as GenBody;
  const prompt = (body.prompt || "").trim();
  const durationSec = Math.min(180, Math.max(5, Number(body.duration) || 60));
  if (!prompt) return reply.code(400).send({ error: "prompt required" });

  const resolved = await resolveStudioLicense(req, body);
  if ("error" in resolved && resolved.error) {
    return reply.code(resolved.status).send({ error: resolved.error });
  }
  const { license, deviceId, fingerprint } = resolved as {
    license: NonNullable<Awaited<ReturnType<typeof prisma.studioLicense.findUnique>>>;
    deviceId: string | null;
    fingerprint: string;
  };

  if (["revoked", "canceled"].includes(license.status)) {
    return reply.code(403).send({ error: `License ${license.status}` });
  }

  const minutes = durationSec / 60;
  const rem = remainingMinutes(license);
  if (rem <= 0 || minutes > rem + 0.05) {
    if (rem <= 0) {
      await prisma.studioLicense.update({
        where: { id: license.id },
        data: { status: "limit_reached" },
      });
    }
    return reply.code(402).send({
      error: "Monthly minute limit reached",
      remaining: rem,
      monthlyLimit: license.monthlyLimit,
    });
  }

  const url = saverUrl();
  if (!url || url.includes("YOUR-")) {
    return reply.code(503).send({ error: "RUNPOD_SAVER_URL not configured" });
  }

  let saverRes: Response;
  try {
    saverRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, duration: durationSec }),
      signal: AbortSignal.timeout(600_000),
    });
  } catch (e) {
    return reply.code(502).send({
      error: "GPU saver unreachable",
      detail: (e as Error).message,
      saver: url.replace(/https?:\/\//, "").split("/")[0],
    });
  }

  const saverJson = (await saverRes.json().catch(() => ({}))) as {
    r2_url?: string;
    error?: string;
    duration?: number;
    engine?: string;
    cost_usd_est?: number;
    note?: string;
  };
  if (!saverRes.ok || !saverJson.r2_url) {
    return reply.code(502).send({
      error: saverJson.error || "Saver generate failed",
      status: saverRes.status,
    });
  }

  const promptHash = hashPrompt(prompt);
  const videoHash = sha256Hex(saverJson.r2_url);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.studioUsageLog.create({
      data: {
        licenseId: license.id,
        deviceId: deviceId || undefined,
        minutes,
        videoHash,
        promptHash,
        outputUrl: saverJson.r2_url,
        offlineQueued: false,
      },
    });
    const used = Number(license.usedThisMonth) + minutes;
    return tx.studioLicense.update({
      where: { id: license.id },
      data: {
        usedThisMonth: used,
        status: used >= license.monthlyLimit ? "limit_reached" : license.status,
      },
    });
  });

  const remaining = remainingMinutes(updated);
  return {
    r2_url: saverJson.r2_url,
    duration: saverJson.duration ?? durationSec,
    minutes,
    remaining,
    monthlyLimit: updated.monthlyLimit,
    usedThisMonth: Number(updated.usedThisMonth),
    engine: saverJson.engine || "SkyReels-V2-DF-1.3B-540P",
    cost_usd_est: saverJson.cost_usd_est,
    note: saverJson.note,
    fingerprint: fingerprint.slice(0, 8) + "…",
    message: "Generated on saver — 0 MB engine download",
  };
}

/** Studio saver generate — canonical path */
export async function studioGenerateRoutes(app: FastifyInstance) {
  app.post("/api/studio/generate", handleStudioGenerate);
  /** Health of saver proxy (no license) */
  app.get("/api/studio/saver-health", async (_req, reply) => {
    const base = saverUrl().replace(/\/generate$/, "");
    try {
      const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8_000) });
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, saver: base, health: j };
    } catch (e) {
      return reply.code(502).send({ ok: false, saver: base, error: (e as Error).message });
    }
  });
}

/** True when body is Studio/saver generate (not factory project enqueue) */
export function isStudioGenerateBody(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as GenBody & { projectId?: string };
  if (b.projectId) return false;
  return Boolean(b.prompt && (b.license_key || b.fingerprint || b.engine === "studio"));
}
