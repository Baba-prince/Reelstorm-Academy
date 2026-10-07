import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@reelstorm/db";
import {
  STUDIO_ACTIVATED_TOKEN_TTL_SEC,
  STUDIO_FREE_DEVICE_TRANSFERS,
  STUDIO_LICENSE_PREFIX,
  STUDIO_MIN_FINGERPRINT_LEN,
  STUDIO_PLANS,
  STUDIO_STARTER_DEVICE_TRANSFERS,
  isDeviceLockedPlan,
  type StudioPlanId,
  maskStudioKey,
} from "@reelstorm/domain";

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function secret(): string {
  const s =
    process.env.STUDIO_LICENSE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.STRIPE_SECRET_KEY;
  if (!s) throw new Error("STUDIO_LICENSE_SECRET not configured");
  return s;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function signHs256(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function verifyHs256(data: string, sig: string): boolean {
  const expected = signHs256(data);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type LicenseJwtPayload = {
  typ: "studio_license";
  userId: string;
  plan: StudioPlanId;
  monthlyLimit: number;
  version: number;
  licenseId: string;
  iat: number;
  exp: number;
};

export type ActivatedJwtPayload = {
  typ: "studio_activated";
  licenseId: string;
  deviceId: string;
  fingerprint: string;
  userId: string;
  iat: number;
  exp: number;
};

function encodeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  return `${data}.${signHs256(data)}`;
}

function decodeJwt<T extends Record<string, unknown>>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  if (!verifyHs256(`${h}.${p}`, s)) return null;
  try {
    return JSON.parse(fromB64url(p).toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** Full license key shown once: RSTUDIO-<jwt> */
export function mintLicenseKey(payload: Omit<LicenseJwtPayload, "typ" | "iat" | "exp"> & { ttlDays?: number }) {
  const iat = Math.floor(Date.now() / 1000);
  const ttlDays = payload.ttlDays ?? 45;
  const fullPayload: LicenseJwtPayload = {
    typ: "studio_license",
    userId: payload.userId,
    plan: payload.plan,
    monthlyLimit: payload.monthlyLimit,
    version: payload.version,
    licenseId: payload.licenseId,
    iat,
    exp: iat + ttlDays * 24 * 3600,
  };
  const jwt = encodeJwt(fullPayload as unknown as Record<string, unknown>);
  const key = `${STUDIO_LICENSE_PREFIX}-${jwt}`;
  return { key, keyHash: sha256Hex(key), keyPrefix: maskStudioKey(key), payload: fullPayload };
}

export function parseLicenseKey(raw: string): LicenseJwtPayload | null {
  const trimmed = raw.trim();
  const jwt = trimmed.startsWith(`${STUDIO_LICENSE_PREFIX}-`)
    ? trimmed.slice(STUDIO_LICENSE_PREFIX.length + 1)
    : trimmed.startsWith(`${STUDIO_LICENSE_PREFIX}.`)
      ? trimmed.slice(STUDIO_LICENSE_PREFIX.length + 1)
      : trimmed;
  const payload = decodeJwt<LicenseJwtPayload>(jwt);
  if (!payload || payload.typ !== "studio_license") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function mintActivatedToken(payload: Omit<ActivatedJwtPayload, "typ" | "iat" | "exp">) {
  const iat = Math.floor(Date.now() / 1000);
  const full: ActivatedJwtPayload = {
    typ: "studio_activated",
    ...payload,
    iat,
    exp: iat + STUDIO_ACTIVATED_TOKEN_TTL_SEC,
  };
  const token = encodeJwt(full as unknown as Record<string, unknown>);
  return { token, tokenHash: sha256Hex(token), payload: full };
}

export function parseActivatedToken(raw: string): ActivatedJwtPayload | null {
  const bearer = raw.replace(/^Bearer\s+/i, "").trim();
  const payload = decodeJwt<ActivatedJwtPayload>(bearer);
  if (!payload || payload.typ !== "studio_activated") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function issueStudioLicense(opts: {
  userId: string;
  plan: StudioPlanId;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
}) {
  const def = STUDIO_PLANS[opts.plan];
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 35);

  // Placeholder id then re-mint with real id
  const provisionalId = `pending_${randomBytes(8).toString("hex")}`;
  const draft = mintLicenseKey({
    userId: opts.userId,
    plan: opts.plan,
    monthlyLimit: def.monthlyLimit,
    version: 1,
    licenseId: provisionalId,
  });

  const row = await prisma.studioLicense.create({
    data: {
      userId: opts.userId,
      keyHash: draft.keyHash,
      keyPrefix: draft.keyPrefix,
      plan: opts.plan,
      monthlyLimit: def.monthlyLimit,
      devicesAllowed: def.devicesAllowed,
      stripeSubscriptionId: opts.stripeSubscriptionId || undefined,
      stripePriceId: opts.stripePriceId || undefined,
      status: "active",
      jwtVersion: 1,
      periodStart: new Date(),
      expiresAt,
      usedThisMonth: 0,
    },
  });

  const final = mintLicenseKey({
    userId: opts.userId,
    plan: opts.plan,
    monthlyLimit: def.monthlyLimit,
    version: 1,
    licenseId: row.id,
  });

  await prisma.studioLicense.update({
    where: { id: row.id },
    data: { keyHash: final.keyHash, keyPrefix: final.keyPrefix },
  });

  return { license: { ...row, keyHash: final.keyHash, keyPrefix: final.keyPrefix }, plaintextKey: final.key };
}

export async function regenerateStudioLicense(licenseId: string) {
  const existing = await prisma.studioLicense.findUnique({ where: { id: licenseId } });
  if (!existing) throw new Error("License not found");
  const nextVersion = existing.jwtVersion + 1;
  const def = STUDIO_PLANS[existing.plan as StudioPlanId];
  const minted = mintLicenseKey({
    userId: existing.userId,
    plan: existing.plan as StudioPlanId,
    monthlyLimit: existing.monthlyLimit || def.monthlyLimit,
    version: nextVersion,
    licenseId: existing.id,
  });
  const updated = await prisma.studioLicense.update({
    where: { id: licenseId },
    data: {
      keyHash: minted.keyHash,
      keyPrefix: minted.keyPrefix,
      jwtVersion: nextVersion,
      status: existing.status === "revoked" ? "revoked" : "active",
    },
  });
  // Invalidate device tokens
  await prisma.studioDevice.updateMany({
    where: { licenseId },
    data: { activatedTokenHash: null },
  });
  return { license: updated, plaintextKey: minted.key };
}

export function remainingMinutes(license: { monthlyLimit: number; usedThisMonth: number | { toNumber?: () => number } }) {
  const used =
    typeof license.usedThisMonth === "number"
      ? license.usedThisMonth
      : Number(license.usedThisMonth);
  return Math.max(0, license.monthlyLimit - used);
}

export async function resetBillingPeriodIfNeeded(licenseId: string) {
  const lic = await prisma.studioLicense.findUnique({ where: { id: licenseId } });
  if (!lic?.expiresAt) return lic;
  if (lic.expiresAt.getTime() > Date.now()) return lic;
  const next = new Date();
  next.setDate(next.getDate() + 35);
  return prisma.studioLicense.update({
    where: { id: licenseId },
    data: {
      usedThisMonth: 0,
      periodStart: new Date(),
      expiresAt: next,
      // Starter gets one transfer budget refreshed with the billing period
      deviceTransferCount: lic.plan === "starter" ? 0 : lic.deviceTransferCount,
      status: lic.status === "limit_reached" ? "active" : lic.status,
    },
  });
}

export type DeviceBindError = {
  ok: false;
  status: 400 | 403;
  error: string;
  code:
    | "fingerprint_invalid"
    | "device_change_detected"
    | "device_limit"
    | "free_trial_locked"
    | "transfer_exhausted";
  lockedFingerprint?: string;
};

export type DeviceBindOk = {
  ok: true;
  device: {
    id: string;
    fingerprint: string;
    deviceName: string | null;
    revoked: boolean;
  };
  license: Awaited<ReturnType<typeof prisma.studioLicense.findUniqueOrThrow>>;
  isNewDevice: boolean;
};

function normalizeFingerprint(raw: string): string {
  return raw.trim().toLowerCase();
}

function maxTransfersForPlan(plan: StudioPlanId): number {
  if (isDeviceLockedPlan(plan)) return STUDIO_FREE_DEVICE_TRANSFERS;
  if (plan === "starter") return STUDIO_STARTER_DEVICE_TRANSFERS;
  // pro+ : transfers = devicesAllowed - 1 (can rotate within seat count via deactivate)
  return 99;
}

/**
 * Bind fingerprint to license seat.
 * Free trial: permanently locked to first fingerprint (even after deactivate).
 * Detects device change and refuses to burn minutes on a new machine.
 */
export async function bindOrRejectDevice(opts: {
  licenseId: string;
  fingerprint: string;
  deviceName?: string;
}): Promise<DeviceBindOk | DeviceBindError> {
  const fingerprint = normalizeFingerprint(opts.fingerprint);
  if (!fingerprint || fingerprint.length < STUDIO_MIN_FINGERPRINT_LEN) {
    return {
      ok: false,
      status: 400,
      error: `fingerprint required (min ${STUDIO_MIN_FINGERPRINT_LEN} chars)`,
      code: "fingerprint_invalid",
    };
  }

  let license = await prisma.studioLicense.findUniqueOrThrow({
    where: { id: opts.licenseId },
    include: { devices: true },
  });
  const plan = license.plan as StudioPlanId;

  const sameFp = license.devices.find((d) => d.fingerprint === fingerprint);
  if (sameFp && !sameFp.revoked) {
    return { ok: true, device: sameFp, license, isNewDevice: false };
  }

  // Re-activate previously revoked same fingerprint (same machine) — always OK
  if (sameFp && sameFp.revoked) {
    const device = await prisma.studioDevice.update({
      where: { id: sameFp.id },
      data: {
        revoked: false,
        lastSeenAt: new Date(),
        deviceName: (opts.deviceName || sameFp.deviceName || "Studio").slice(0, 80),
      },
    });
    if (!license.lockedFingerprint) {
      license = await prisma.studioLicense.update({
        where: { id: license.id },
        data: { lockedFingerprint: fingerprint },
        include: { devices: true },
      });
    }
    return { ok: true, device, license, isNewDevice: false };
  }

  // NEW fingerprint
  if (license.lockedFingerprint && license.lockedFingerprint !== fingerprint) {
    if (isDeviceLockedPlan(plan)) {
      return {
        ok: false,
        status: 403,
        error:
          "Device change detected — free trial is locked to the first activated machine. Upgrade Studio to move seats.",
        code: "free_trial_locked",
        lockedFingerprint: license.lockedFingerprint.slice(0, 8) + "…",
      };
    }
    const maxT = maxTransfersForPlan(plan);
    if (license.deviceTransferCount >= maxT) {
      return {
        ok: false,
        status: 403,
        error: "Device transfer limit reached for this billing period — wait for renewal or upgrade",
        code: "transfer_exhausted",
        lockedFingerprint: license.lockedFingerprint.slice(0, 8) + "…",
      };
    }
  }

  // Also lock free if ANY historical device exists with different fingerprint
  if (isDeviceLockedPlan(plan) && license.devices.some((d) => d.fingerprint !== fingerprint)) {
    return {
      ok: false,
      status: 403,
      error:
        "Device change detected — free trial minutes stay on the original device. Upgrade to transfer.",
      code: "device_change_detected",
      lockedFingerprint: (license.lockedFingerprint || license.devices[0]?.fingerprint || "").slice(0, 8) + "…",
    };
  }

  const activeCount = license.devices.filter((d) => !d.revoked).length;
  if (activeCount >= license.devicesAllowed) {
    return {
      ok: false,
      status: 403,
      error: "Device limit reached — deactivate a seat in /settings/studio (free trial cannot add another)",
      code: "device_limit",
    };
  }

  const isTransfer =
    Boolean(license.lockedFingerprint) && license.lockedFingerprint !== fingerprint;

  const device = await prisma.studioDevice.create({
    data: {
      licenseId: license.id,
      fingerprint,
      deviceName: (opts.deviceName || "Studio").slice(0, 80),
    },
  });

  license = await prisma.studioLicense.update({
    where: { id: license.id },
    data: {
      lockedFingerprint: license.lockedFingerprint || fingerprint,
      deviceTransferCount: isTransfer ? license.deviceTransferCount + 1 : license.deviceTransferCount,
    },
    include: { devices: true },
  });

  return { ok: true, device, license, isNewDevice: true };
}

/** Require fingerprint match on every metered action */
export function assertFingerprintMatch(
  expected: string,
  provided: string | undefined,
): DeviceBindError | null {
  if (!provided) {
    return {
      ok: false,
      status: 400,
      error: "fingerprint required — device change cannot be verified",
      code: "fingerprint_invalid",
    };
  }
  if (normalizeFingerprint(provided) !== normalizeFingerprint(expected)) {
    return {
      ok: false,
      status: 403,
      error: "Device change detected — fingerprint mismatch. Re-activate on this machine or upgrade.",
      code: "device_change_detected",
    };
  }
  return null;
}
