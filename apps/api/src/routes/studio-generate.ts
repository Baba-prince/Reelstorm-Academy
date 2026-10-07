import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  assertFingerprintMatch,
  bindOrRejectDevice,
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
  // Canonical: RUNPOD_SAVER_URL. Alias: SAVER_URL (common nano mistake).
  let fromEnv = (process.env.RUNPOD_SAVER_URL || process.env.SAVER_URL || "").trim();
  if (!fromEnv) {
    const pod = (process.env.RUNPOD_POD_ID || "xuvnute41511og").trim();
    const port = (process.env.RUNPOD_SAVER_PORT || "8000").trim();
    return `https://${pod}-${port}.proxy.runpod.net/generate`;
  }
  fromEnv = fromEnv.replace(/\/$/, "");
  // Allow base URL without /generate
  if (!fromEnv.endsWith("/generate")) fromEnv = `${fromEnv}/generate`;
  return fromEnv;
}

/**
 * Resolve Studio license + bind device seat (free trial locked to first fingerprint).
 * 1) activated Bearer token (desktop)
 * 2) RSTUDIO- license_key + fingerprint
 * 3) signed-in user + browser fingerprint (web 0MB)
 */
async function resolveStudioLicense(req: FastifyRequest, body: GenBody) {
  const fingerprint = (body.fingerprint || "").trim().toLowerCase();
  const activated = parseActivatedToken(req.headers.authorization || "");

  if (activated) {
    if (fingerprint) {
      const err = assertFingerprintMatch(activated.fingerprint, fingerprint);
      if (err) return { error: err.error, status: err.status as 403, code: err.code };
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
    if (!device) {
      return {
        error: "Device revoked or unknown — free trial cannot burn on a new machine",
        status: 403 as const,
        code: "device_change_detected",
      };
    }
    // Re-assert lock (covers admin unlock edge cases)
    if (license.lockedFingerprint && license.lockedFingerprint !== activated.fingerprint) {
      return {
        error: "Device change detected — license locked to another machine",
        status: 403 as const,
        code: "free_trial_locked",
      };
    }
    return { license, deviceId: device.id, fingerprint: activated.fingerprint };
  }

  if (!fingerprint || fingerprint.length < 16) {
    return {
      error: "Stable device fingerprint required (min 16 chars) — regenerating browser storage won't unlock a new free trial",
      status: 400 as const,
      code: "fingerprint_invalid",
    };
  }

  const licenseKey = (body.license_key || "").trim();
  if (licenseKey) {
    const payload = parseLicenseKey(licenseKey);
    if (!payload) return { error: "Invalid or expired license key", status: 401 as const };
    let license = await prisma.studioLicense.findUnique({ where: { keyHash: sha256Hex(licenseKey) } });
    if (!license) return { error: "License not found", status: 401 as const };
    if (payload.version !== license.jwtVersion) {
      return { error: "License key was regenerated", status: 401 as const };
    }
    license = (await resetBillingPeriodIfNeeded(license.id)) || license;
    const bound = await bindOrRejectDevice({
      licenseId: license.id,
      fingerprint,
      deviceName: "Web / thin client",
    });
    if (!bound.ok) {
      return { error: bound.error, status: bound.status, code: bound.code };
    }
    return { license: bound.license, deviceId: bound.device.id, fingerprint };
  }

  // Web session: bind browser fingerprint to seat (same free-trial lock)
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
    const bound = await bindOrRejectDevice({
      licenseId: license.id,
      fingerprint,
      deviceName: "Web browser",
    });
    if (!bound.ok) {
      return { error: bound.error, status: bound.status, code: bound.code };
    }
    return { license: bound.license, deviceId: bound.device.id, fingerprint };
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
    const pod = (process.env.RUNPOD_POD_ID || "xuvnute41511og").trim();
    try {
      const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(12_000) });
      const text = await r.text();
      let health: unknown = {};
      try {
        health = JSON.parse(text);
      } catch {
        health = { raw: text.slice(0, 200) };
      }
      if (!r.ok) {
        return {
          ok: false,
          saver: base,
          httpStatus: r.status,
          health,
          hint:
            r.status === 404
              ? `RunPod proxy 404 — pod must be RUNNING and this HTTP port must appear under Connect → HTTP services (proxy URL port must match). Local curl on the pod is not enough. Pod=${pod}`
              : "Saver returned non-OK status",
        };
      }
      return { ok: true, saver: base, httpStatus: r.status, health };
    } catch (e) {
      return reply.code(502).send({
        ok: false,
        saver: base,
        error: (e as Error).message,
        hint: `Cannot reach RunPod proxy. Confirm pod ${pod} is up and the HTTP port in RUNPOD_SAVER_URL is exposed. Do not run pm2 on the pod — pm2 is VPS-only.`,
      });
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
