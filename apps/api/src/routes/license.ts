import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  STUDIO_OFFLINE_GRACE_HOURS,
  STUDIO_PLANS,
  type StudioPlanId,
  maskStudioKey,
  stripePriceForStudioPlan,
} from "@reelstorm/domain";
import { resolveUserFromAuthHeader } from "./auth.js";
import {
  issueStudioLicense,
  mintActivatedToken,
  parseActivatedToken,
  parseLicenseKey,
  regenerateStudioLicense,
  remainingMinutes,
  resetBillingPeriodIfNeeded,
  sha256Hex,
} from "../lib/studio-license.js";

const activateHits = new Map<string, { n: number; reset: number }>();

function rateLimitActivate(key: string, max = 5, windowMs = 3600_000): boolean {
  const now = Date.now();
  const cur = activateHits.get(key);
  if (!cur || cur.reset < now) {
    activateHits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (cur.n >= max) return false;
  cur.n += 1;
  return true;
}

function publicLicense(lic: {
  id: string;
  plan: string;
  monthlyLimit: number;
  usedThisMonth: number;
  devicesAllowed: number;
  status: string;
  keyPrefix: string;
  expiresAt: Date | null;
  periodStart: Date;
}) {
  return {
    id: lic.id,
    plan: lic.plan,
    monthlyLimit: lic.monthlyLimit,
    usedThisMonth: Number(lic.usedThisMonth),
    remaining: remainingMinutes(lic),
    devicesAllowed: lic.devicesAllowed,
    status: lic.status,
    keyPrefix: lic.keyPrefix,
    maskedKey: maskStudioKey(lic.keyPrefix),
    expiresAt: lic.expiresAt,
    periodStart: lic.periodStart,
    offlineGraceHours: STUDIO_OFFLINE_GRACE_HOURS,
  };
}

export async function licenseRoutes(app: FastifyInstance) {
  /** Public plan catalog */
  app.get("/api/studio/plans", async () => ({
    plans: Object.values(STUDIO_PLANS),
    engine: "SkyReels V2 DF 1.3B-540P (user GPU) · Pixabay intros $0 · central minute meter",
  }));

  /** Authenticated: list my licenses + devices */
  app.get("/api/license/me", async (req, reply) => {
    const user = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: "Sign in required" });
    const licenses = await prisma.studioLicense.findMany({
      where: { userId: user.id },
      include: { devices: { where: { revoked: false }, orderBy: { lastSeenAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return {
      licenses: licenses.map((l) => ({
        ...publicLicense(l),
        devices: l.devices.map((d) => ({
          id: d.id,
          deviceName: d.deviceName,
          fingerprint: d.fingerprint.slice(0, 8) + "…",
          activatedAt: d.activatedAt,
          lastSeenAt: d.lastSeenAt,
        })),
      })),
    };
  });

  /** Start Stripe checkout for a Studio plan */
  app.post("/api/studio/checkout", async (req, reply) => {
    const user = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: "Sign in required" });
    const body = (req.body || {}) as { plan?: string };
    const plan = body.plan as StudioPlanId;
    if (!plan || !STUDIO_PLANS[plan] || plan === "free") {
      return reply.code(400).send({ error: "plan must be starter | pro | agency | unlimited" });
    }
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return reply.code(503).send({ error: "Stripe not configured" });
    const priceId = stripePriceForStudioPlan(plan);
    if (priceId.includes("placeholder") || !priceId) {
      return reply.code(503).send({
        error: `Create Stripe price and set ${STUDIO_PLANS[plan].stripePriceEnv}`,
      });
    }
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secret);
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      allow_promotion_codes: true,
      client_reference_id: user.id,
      subscription_data: {
        metadata: { userId: user.id, product: "studio", studioPlan: plan },
      },
      metadata: { userId: user.id, product: "studio", studioPlan: plan },
      success_url: `${appUrl}/settings/studio?checkout=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/download?cancelled=1`,
    });
    return { url: session.url, sessionId: session.id };
  });

  /**
   * POST /api/license/activate
   * Body: { email, license_key, fingerprint, device_name? }
   */
  app.post("/api/license/activate", async (req, reply) => {
    const body = (req.body || {}) as {
      email?: string;
      license_key?: string;
      fingerprint?: string;
      device_name?: string;
    };
    const email = (body.email || "").trim().toLowerCase();
    const licenseKey = (body.license_key || "").trim();
    const fingerprint = (body.fingerprint || "").trim().toLowerCase();
    if (!email || !licenseKey || !fingerprint || fingerprint.length < 16) {
      return reply.code(400).send({ error: "email, license_key, fingerprint required" });
    }
    if (!rateLimitActivate(sha256Hex(licenseKey))) {
      return reply.code(429).send({ error: "Too many activation attempts — try again later" });
    }

    const payload = parseLicenseKey(licenseKey);
    if (!payload) return reply.code(401).send({ error: "Invalid or expired license key" });

    const keyHash = sha256Hex(licenseKey);
    let license = await prisma.studioLicense.findUnique({
      where: { keyHash },
      include: { user: true, devices: { where: { revoked: false } } },
    });
    if (!license) return reply.code(401).send({ error: "License not found" });
    if (license.user.email.toLowerCase() !== email) {
      return reply.code(403).send({ error: "Email does not match license owner" });
    }
    if (payload.version !== license.jwtVersion) {
      return reply.code(401).send({ error: "License key was regenerated — use the new key from dashboard" });
    }
    if (["revoked", "canceled"].includes(license.status)) {
      return reply.code(403).send({ error: `License ${license.status}` });
    }

    license = (await resetBillingPeriodIfNeeded(license.id)) as typeof license;
    license = await prisma.studioLicense.findUniqueOrThrow({
      where: { id: license.id },
      include: { user: true, devices: { where: { revoked: false } } },
    });

    const existing = license.devices.find((d) => d.fingerprint === fingerprint);
    if (!existing && license.devices.length >= license.devicesAllowed) {
      return reply.code(403).send({
        error: "Device limit reached — deactivate a device in app.reelstorm.uk/settings/studio",
        devicesAllowed: license.devicesAllowed,
      });
    }

    let device =
      existing ||
      (await prisma.studioDevice.create({
        data: {
          licenseId: license.id,
          fingerprint,
          deviceName: (body.device_name || "Studio PC").slice(0, 80),
        },
      }));

    const { token, tokenHash } = mintActivatedToken({
      licenseId: license.id,
      deviceId: device.id,
      fingerprint,
      userId: license.userId,
    });

    device = await prisma.studioDevice.update({
      where: { id: device.id },
      data: {
        activatedTokenHash: tokenHash,
        lastSeenAt: new Date(),
        deviceName: (body.device_name || device.deviceName || "Studio PC").slice(0, 80),
        revoked: false,
      },
    });

    return {
      activated_token: token,
      license: publicLicense(license),
      device: { id: device.id, deviceName: device.deviceName },
      message: "Activated — store activated_token in OS keychain only; full license key is not retained",
    };
  });

  /** Validate remaining allowance (desktop) */
  app.get("/api/license/validate", async (req, reply) => {
    const activated = parseActivatedToken(req.headers.authorization || "");
    if (!activated) return reply.code(401).send({ error: "Invalid activated token" });

    let license = await prisma.studioLicense.findUnique({ where: { id: activated.licenseId } });
    if (!license) return reply.code(401).send({ error: "License missing" });
    license = (await resetBillingPeriodIfNeeded(license.id)) || license;

    const device = await prisma.studioDevice.findFirst({
      where: {
        id: activated.deviceId,
        licenseId: license.id,
        fingerprint: activated.fingerprint,
        revoked: false,
      },
    });
    if (!device) return reply.code(403).send({ error: "Device revoked or unknown" });
    if (device.activatedTokenHash && device.activatedTokenHash !== sha256Hex(req.headers.authorization!.replace(/^Bearer\s+/i, ""))) {
      return reply.code(401).send({ error: "Token superseded — re-activate" });
    }
    if (["revoked", "canceled"].includes(license.status)) {
      return reply.code(403).send({ error: `License ${license.status}`, status: license.status });
    }

    await prisma.studioDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    const rem = remainingMinutes(license);
    return {
      ok: true,
      ...publicLicense({ ...license, usedThisMonth: Number(license.usedThisMonth) }),
      status: rem <= 0 ? "limit_reached" : license.status,
    };
  });

  /** Report minutes after local generation */
  app.post("/api/license/usage", async (req, reply) => {
    const activated = parseActivatedToken(req.headers.authorization || "");
    if (!activated) return reply.code(401).send({ error: "Invalid activated token" });
    const body = (req.body || {}) as {
      minutes?: number;
      videoHash?: string;
      promptHash?: string;
      fingerprint?: string;
      offlineQueued?: boolean;
    };
    const minutes = Number(body.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 120) {
      return reply.code(400).send({ error: "minutes must be 0–120" });
    }
    if (body.fingerprint && body.fingerprint !== activated.fingerprint) {
      return reply.code(403).send({ error: "Fingerprint mismatch" });
    }

    let license = await prisma.studioLicense.findUnique({ where: { id: activated.licenseId } });
    if (!license) return reply.code(401).send({ error: "License missing" });
    if (["revoked", "canceled"].includes(license.status)) {
      return reply.code(403).send({ error: `License ${license.status}` });
    }
    license = (await resetBillingPeriodIfNeeded(license.id)) || license;

    const rem = remainingMinutes(license);
    if (rem <= 0) {
      await prisma.studioLicense.update({
        where: { id: license.id },
        data: { status: "limit_reached" },
      });
      return reply.code(402).send({ error: "Monthly limit reached", remaining: 0 });
    }
    if (minutes > rem + 0.05) {
      return reply.code(402).send({
        error: "Not enough remaining minutes",
        remaining: rem,
      });
    }

    const used = Number(license.usedThisMonth) + minutes;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.studioUsageLog.create({
        data: {
          licenseId: license!.id,
          deviceId: activated.deviceId,
          minutes,
          videoHash: body.videoHash?.slice(0, 128),
          promptHash: body.promptHash?.slice(0, 128),
          offlineQueued: Boolean(body.offlineQueued),
        },
      });
      return tx.studioLicense.update({
        where: { id: license!.id },
        data: {
          usedThisMonth: used,
          status: used >= license!.monthlyLimit ? "limit_reached" : license!.status === "limit_reached" ? "active" : license!.status,
        },
      });
    });

    await prisma.studioDevice.update({
      where: { id: activated.deviceId },
      data: { lastSeenAt: new Date() },
    });

    return {
      ok: true,
      ...publicLicense(updated),
    };
  });

  /** Heartbeat — refresh activated token + sync Stripe-ish status */
  app.post("/api/license/heartbeat", async (req, reply) => {
    const activated = parseActivatedToken(req.headers.authorization || "");
    if (!activated) return reply.code(401).send({ error: "Invalid activated token" });
    const body = (req.body || {}) as { fingerprint?: string; used?: number };

    let license = await prisma.studioLicense.findUnique({ where: { id: activated.licenseId } });
    if (!license) return reply.code(401).send({ error: "License missing" });
    license = (await resetBillingPeriodIfNeeded(license.id)) || license;

    const device = await prisma.studioDevice.findFirst({
      where: {
        id: activated.deviceId,
        licenseId: license.id,
        fingerprint: activated.fingerprint,
        revoked: false,
      },
    });
    if (!device) return reply.code(403).send({ error: "Device revoked" });
    if (body.fingerprint && body.fingerprint !== activated.fingerprint) {
      return reply.code(403).send({ error: "Fingerprint mismatch" });
    }

    // Optional Stripe subscription liveness check
    if (license.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const sub = await stripe.subscriptions.retrieve(license.stripeSubscriptionId);
        if (sub.status === "canceled" || sub.status === "unpaid") {
          license = await prisma.studioLicense.update({
            where: { id: license.id },
            data: { status: "canceled" },
          });
        } else if (sub.status === "past_due") {
          license = await prisma.studioLicense.update({
            where: { id: license.id },
            data: { status: "past_due" },
          });
        } else if (["active", "trialing"].includes(sub.status) && license.status === "canceled") {
          license = await prisma.studioLicense.update({
            where: { id: license.id },
            data: { status: "active" },
          });
        }
      } catch {
        /* non-fatal — keep last known status */
      }
    }

    if (["revoked", "canceled"].includes(license.status)) {
      return reply.code(403).send({
        error: "Subscription inactive — renew in dashboard",
        status: license.status,
        license: publicLicense(license),
      });
    }

    const { token, tokenHash } = mintActivatedToken({
      licenseId: license.id,
      deviceId: device.id,
      fingerprint: activated.fingerprint,
      userId: license.userId,
    });
    await prisma.studioDevice.update({
      where: { id: device.id },
      data: { activatedTokenHash: tokenHash, lastSeenAt: new Date() },
    });

    return {
      status: license.status,
      new_activated_token: token,
      license: publicLicense(license),
      offlineGraceHours: STUDIO_OFFLINE_GRACE_HOURS,
      serverUsed: Number(license.usedThisMonth),
      clientReportedUsed: body.used,
    };
  });

  /** Deactivate a device (frees slot) */
  app.post("/api/license/devices/:id/deactivate", async (req, reply) => {
    const user = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: "Sign in required" });
    const { id } = req.params as { id: string };
    const device = await prisma.studioDevice.findUnique({
      where: { id },
      include: { license: true },
    });
    if (!device || device.license.userId !== user.id) {
      return reply.code(404).send({ error: "Device not found" });
    }
    await prisma.studioDevice.update({
      where: { id },
      data: { revoked: true, activatedTokenHash: null },
    });
    return { ok: true };
  });

  /** Regenerate license key (invalidates old JWT version) */
  app.post("/api/license/regenerate", async (req, reply) => {
    const user = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: "Sign in required" });
    const body = (req.body || {}) as { licenseId?: string };
    const license = body.licenseId
      ? await prisma.studioLicense.findFirst({ where: { id: body.licenseId, userId: user.id } })
      : await prisma.studioLicense.findFirst({
          where: { userId: user.id, status: { in: ["active", "past_due", "limit_reached"] } },
          orderBy: { createdAt: "desc" },
        });
    if (!license) return reply.code(404).send({ error: "No license" });
    const { license: updated, plaintextKey } = await regenerateStudioLicense(license.id);
    return {
      license: publicLicense(updated),
      plaintextKey,
      warning: "Shown once — store securely. Old devices must re-activate.",
    };
  });

  /** Dev/admin: issue free Studio Free license for testing */
  app.post("/api/license/issue-free", async (req, reply) => {
    const user = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: "Sign in required" });
    const existing = await prisma.studioLicense.findFirst({
      where: { userId: user.id, plan: "free" },
    });
    if (existing) {
      return reply.code(409).send({
        error: "Free Studio license already issued",
        license: publicLicense(existing),
      });
    }
    const { license, plaintextKey } = await issueStudioLicense({ userId: user.id, plan: "free" });
    return {
      license: publicLicense(license),
      plaintextKey,
      warning: "Shown once — activate in ReelStorm Studio desktop app",
    };
  });
}

/** Called from Stripe webhook when product=studio */
export async function handleStudioStripeCheckout(opts: {
  userId: string;
  plan: StudioPlanId;
  subscriptionId?: string | null;
  priceId?: string | null;
}) {
  const { license, plaintextKey } = await issueStudioLicense({
    userId: opts.userId,
    plan: opts.plan,
    stripeSubscriptionId: opts.subscriptionId,
    stripePriceId: opts.priceId,
  });
  return { license, plaintextKey };
}

export async function handleStudioSubscriptionUpdate(opts: {
  subscriptionId: string;
  status: string;
  userId?: string;
}) {
  const license = await prisma.studioLicense.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: opts.subscriptionId },
        ...(opts.userId ? [{ userId: opts.userId, stripeSubscriptionId: { not: null } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!license) return null;

  if (opts.status === "canceled" || opts.status === "unpaid") {
    return prisma.studioLicense.update({
      where: { id: license.id },
      data: { status: "canceled" },
    });
  }
  if (opts.status === "past_due") {
    return prisma.studioLicense.update({
      where: { id: license.id },
      data: { status: "past_due" },
    });
  }
  if (["active", "trialing"].includes(opts.status)) {
    const next = new Date();
    next.setDate(next.getDate() + 35);
    return prisma.studioLicense.update({
      where: { id: license.id },
      data: {
        status: "active",
        usedThisMonth: 0,
        periodStart: new Date(),
        expiresAt: next,
      },
    });
  }
  return license;
}
