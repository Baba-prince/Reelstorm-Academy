import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "@reelstorm/db";
import {
  RTC_PER_ARCHIVE5,
  RTC_PACKS,
  TIER_ALIAS,
  TIER_DISPLAY_NAME,
  TIER_DISPLAY_PRICE,
  TIER_FEATURES,
  TIER_MAX_RESOLUTION,
  TIER_MONTHLY_RTC,
  TIER_MONTHLY_SETS,
  blocksFromRtc,
  isPaidTier,
  stripePriceForTier,
} from "@reelstorm/domain";
import {
  debitArchive5,
  ensureTenantWallet,
  mintWhiteLabelKey,
  resolveWhiteLabelKey,
} from "../lib/rtc.js";
import { enqueue } from "../lib/queue.js";

async function wlAuth(req: FastifyRequest) {
  const header = req.headers.authorization;
  const key =
    (header?.startsWith("Bearer ") ? header.slice(7) : null) ||
    (req.headers["x-api-key"] as string | undefined);
  if (!key?.startsWith("rs_live_")) return null;
  return resolveWhiteLabelKey(key);
}

/**
 * White-label REST API for Academy studios branding ReelStorm as their own.
 * Base: /v1/wl/*
 */
export async function whiteLabelRoutes(app: FastifyInstance) {
  app.get("/v1/wl/health", async () => ({
    ok: true,
    product: "reelstorm-whitelabel",
    version: "1.0.0",
    unit: { rtcPerArchive5: RTC_PER_ARCHIVE5, archive5Seconds: 300 },
  }));

  /** Create a tenant + brand + first API key (owner bootstrap) */
  app.post("/v1/wl/tenants", async (req, reply) => {
    const body = (req.body || {}) as {
      ownerEmail?: string;
      name?: string;
      slug?: string;
      brand?: {
        productName?: string;
        monogram?: string;
        primaryHex?: string;
        accentHex?: string;
        ctaHex?: string;
        bgHex?: string;
        logoUrl?: string;
        hideReelstorm?: boolean;
      };
    };
    if (!body.ownerEmail || !body.name || !body.slug) {
      return reply.code(400).send({ error: "ownerEmail, name, slug required" });
    }
    const slug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const owner = await prisma.user.upsert({
      where: { email: body.ownerEmail },
      create: { email: body.ownerEmail, name: body.name, tier: "storm_pro" },
      update: { tier: "storm_pro" },
    });

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return reply.code(409).send({ error: "slug taken" });

    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name: body.name,
        ownerId: owner.id,
        tier: "storm_pro",
        brand: {
          create: {
            productName: body.brand?.productName || body.name,
            monogram: body.brand?.monogram || "RS",
            primaryHex: body.brand?.primaryHex || "#7C3AED",
            accentHex: body.brand?.accentHex || "#00D9FF",
            ctaHex: body.brand?.ctaHex || "#FF7A00",
            bgHex: body.brand?.bgHex || "#080808",
            logoUrl: body.brand?.logoUrl,
            hideReelstorm: body.brand?.hideReelstorm ?? true,
          },
        },
      },
      include: { brand: true },
    });

    await ensureTenantWallet(tenant.id, "storm_pro");
    const minted = mintWhiteLabelKey();
    await prisma.whiteLabelKey.create({
      data: {
        tenantId: tenant.id,
        label: "default",
        keyPrefix: minted.prefix,
        keyHash: minted.hash,
      },
    });

    return reply.code(201).send({
      tenant,
      apiKey: minted.raw,
      warning: "Store apiKey now — it will not be shown again.",
      docs: "/developers",
    });
  });

  app.get("/v1/wl/me", async (req, reply) => {
    const auth = await wlAuth(req);
    if (!auth) return reply.code(401).send({ error: "Invalid API key" });
    const wallet = await ensureTenantWallet(auth.tenantId, auth.tenant.tier as never);
    return {
      tenant: {
        id: auth.tenant.id,
        slug: auth.tenant.slug,
        name: auth.tenant.name,
        tier: auth.tenant.tier,
      },
      brand: auth.tenant.brand,
      wallet: {
        balanceRtc: wallet.balanceRtc,
        archive5Remaining: blocksFromRtc(wallet.balanceRtc),
        rtcPerArchive5: RTC_PER_ARCHIVE5,
      },
      scopes: auth.scopes,
    };
  });

  app.patch("/v1/wl/brand", async (req, reply) => {
    const auth = await wlAuth(req);
    if (!auth) return reply.code(401).send({ error: "Invalid API key" });
    const body = (req.body || {}) as Record<string, string | boolean | undefined>;
    const brand = await prisma.tenantBrand.update({
      where: { tenantId: auth.tenantId },
      data: {
        productName: (body.productName as string) || undefined,
        monogram: (body.monogram as string) || undefined,
        primaryHex: (body.primaryHex as string) || undefined,
        accentHex: (body.accentHex as string) || undefined,
        ctaHex: (body.ctaHex as string) || undefined,
        bgHex: (body.bgHex as string) || undefined,
        logoUrl: (body.logoUrl as string) || undefined,
        supportEmail: (body.supportEmail as string) || undefined,
        hideReelstorm:
          typeof body.hideReelstorm === "boolean" ? body.hideReelstorm : undefined,
      },
    });
    return { brand };
  });

  app.get("/v1/wl/templates", async (req, reply) => {
    const auth = await wlAuth(req);
    if (!auth) return reply.code(401).send({ error: "Invalid API key" });
    const templates = await prisma.videoTemplate.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        stylePreset: true,
        durationSec: true,
        aspectRatio: true,
        lut: true,
        createdAt: true,
      },
    });
    return { templates, brand: auth.tenant.brand?.productName };
  });

  /** Generate under tenant brand — debits RTC for planned ARCHIVE5 length */
  app.post("/v1/wl/generate", async (req, reply) => {
    const auth = await wlAuth(req);
    if (!auth) return reply.code(401).send({ error: "Invalid API key" });
    const body = (req.body || {}) as {
      script?: string;
      title?: string;
      templateId?: string;
      durationSec?: number;
    };
    if (!body.script) return reply.code(400).send({ error: "script required" });

    const durationSec = body.durationSec || 300;
    const wallet = await ensureTenantWallet(auth.tenantId, auth.tenant.tier as never);

    const project = await prisma.project.create({
      data: {
        title: body.title || `${auth.tenant.brand?.productName || auth.tenant.name} · Job`,
        script: body.script,
        templateId: body.templateId || undefined,
        ownerId: auth.tenant.ownerId,
        status: "GENERATING",
      },
    });

    const block = await prisma.block.create({
      data: {
        projectId: project.id,
        index: 1,
        title: "ARCHIVE5::BLOCK_001",
        durationSec,
        status: "RENDERING",
        templateId: body.templateId,
      },
    });

    try {
      await debitArchive5(wallet.id, block.id, durationSec);
    } catch (e) {
      await prisma.block.update({ where: { id: block.id }, data: { status: "FAILED" } });
      return reply.code(402).send({
        error: (e as Error).message,
        rtcPerArchive5: RTC_PER_ARCHIVE5,
        balanceRtc: wallet.balanceRtc,
      });
    }

    const job = await enqueue("generateVideo", {
      projectId: project.id,
      templateId: body.templateId,
      script: body.script,
      vibe: `white-label:${auth.tenant.slug}`,
    });

    return reply.code(202).send({
      projectId: project.id,
      blockId: block.id,
      jobId: job.id,
      billedRtc: Math.ceil(durationSec / 300) * RTC_PER_ARCHIVE5,
      brand: auth.tenant.brand,
    });
  });

  app.post("/v1/wl/from-url", async (req, reply) => {
    const auth = await wlAuth(req);
    if (!auth) return reply.code(401).send({ error: "Invalid API key" });
    const body = (req.body || {}) as { url?: string; analyze?: boolean };
    if (!body.url) return reply.code(400).send({ error: "url required" });

    // Proxy into existing upload pipeline
    const res = await app.inject({
      method: "POST",
      url: "/api/upload/video/from-url",
      payload: { url: body.url, analyze: body.analyze !== false },
    });
    return reply.code(res.statusCode).headers(res.headers).send(res.json());
  });

  app.get("/v1/wl/wallet", async (req, reply) => {
    const auth = await wlAuth(req);
    if (!auth) return reply.code(401).send({ error: "Invalid API key" });
    const wallet = await ensureTenantWallet(auth.tenantId, auth.tenant.tier as never);
    const ledger = await prisma.rtcLedger.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return {
      balanceRtc: wallet.balanceRtc,
      archive5Remaining: blocksFromRtc(wallet.balanceRtc),
      rtcPerArchive5: RTC_PER_ARCHIVE5,
      ledger,
    };
  });

  app.post("/v1/wl/keys", async (req, reply) => {
    const auth = await wlAuth(req);
    if (!auth) return reply.code(401).send({ error: "Invalid API key" });
    const body = (req.body || {}) as { label?: string };
    const minted = mintWhiteLabelKey();
    await prisma.whiteLabelKey.create({
      data: {
        tenantId: auth.tenantId,
        label: body.label || "secondary",
        keyPrefix: minted.prefix,
        keyHash: minted.hash,
      },
    });
    return reply.code(201).send({
      apiKey: minted.raw,
      prefix: minted.prefix,
      warning: "Store apiKey now — it will not be shown again.",
    });
  });
}

export async function billingRoutes(app: FastifyInstance) {
  app.get("/api/billing/tiers", async () => {
    const ids = ["free", "storm", "storm_pro", "premium_pro", "network"] as const;
    const tiers = ids.map((id) => ({
      id,
      name: TIER_DISPLAY_NAME[id],
      price: TIER_DISPLAY_PRICE[id],
      monthlyRtc: TIER_MONTHLY_RTC[id],
      monthlySets: TIER_MONTHLY_SETS[id],
      archive5Blocks: blocksFromRtc(TIER_MONTHLY_RTC[id]),
      maxResolution: TIER_MAX_RESOLUTION[id],
      features: TIER_FEATURES[id],
      alias: TIER_ALIAS[id],
      featured: id === "storm_pro",
      stripePriceId: isPaidTier(id) ? stripePriceForTier(id) : null,
    }));
    return {
      currency: "RTC",
      rtcPerMinute: 1,
      rtcPerArchive5: RTC_PER_ARCHIVE5,
      unit: "1 RTC = 1 minute of final master (720p) · 1 set = 5 RTC",
      note: "Sell SETS. Meter minutes. Basic locked to 720p. Premium is the YouTuber hero.",
      packs: RTC_PACKS,
      stripeReady: Boolean(process.env.STRIPE_SECRET_KEY),
      tiers,
    };
  });

  app.get("/api/billing/wallet", async (req, reply) => {
    const { resolveUserFromAuthHeader } = await import("./auth.js");
    const authed = await resolveUserFromAuthHeader(req.headers.authorization);
    const email =
      authed?.email ||
      ((req.query as { email?: string }).email) ||
      "producer@reelstorm.academy";
    const user =
      authed ||
      (await prisma.user.upsert({
        where: { email },
        create: { email, name: "Producer", tier: "free", rtcBalance: 1 },
        update: {},
      }));
    const { ensureUserWallet } = await import("../lib/rtc.js");
    const {
      ensureSystemBank,
      systemBankPublic,
      grantFreeDemoFromBank,
    } = await import("../lib/system-bank.js");
    try {
      await grantFreeDemoFromBank(user.id);
    } catch {
      /* bank may be empty */
    }
    const wallet = await ensureUserWallet(user.id, user.tier as never);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const bank = await ensureSystemBank();
    const rtcBalance = wallet.balanceRtc;
    return {
      user: {
        id: fresh.id,
        email: fresh.email,
        tier: fresh.tier,
        onboardingCompleted: fresh.onboardingCompleted,
        freeDemoUsed: fresh.freeDemoUsed,
        freeDemoGrantedAt: fresh.freeDemoGrantedAt,
      },
      rtcBalance,
      freeDemo: {
        granted: Boolean(fresh.freeDemoGrantedAt),
        used: fresh.freeDemoUsed,
        amountRtc: 1,
        expiresAt: null,
      },
      systemBank: systemBankPublic(bank),
      canGenerate: rtcBalance >= 1,
      wallet: {
        balanceRtc: rtcBalance,
        archive5Remaining: blocksFromRtc(rtcBalance),
        rtcPerArchive5: RTC_PER_ARCHIVE5,
      },
    };
  });

  /** Alias for deliverable path — same payload as /api/billing/wallet */
  app.get("/api/user/wallet", async (req, reply) => {
    const { resolveUserFromAuthHeader } = await import("./auth.js");
    const authed = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!authed) return reply.code(401).send({ error: "Unauthorized" });
    const { ensureUserWallet } = await import("../lib/rtc.js");
    const {
      ensureSystemBank,
      systemBankPublic,
      grantFreeDemoFromBank,
    } = await import("../lib/system-bank.js");
    try {
      await grantFreeDemoFromBank(authed.id);
    } catch {
      /* ignore */
    }
    const wallet = await ensureUserWallet(authed.id, authed.tier as never);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: authed.id } });
    const bank = await ensureSystemBank();
    return {
      rtcBalance: wallet.balanceRtc,
      freeDemo: {
        granted: Boolean(fresh.freeDemoGrantedAt),
        used: fresh.freeDemoUsed,
        amountRtc: 1,
        expiresAt: null,
      },
      systemBank: systemBankPublic(bank),
      canGenerate: wallet.balanceRtc >= 1,
      user: {
        id: fresh.id,
        email: fresh.email,
        tier: fresh.tier,
      },
      wallet: {
        balanceRtc: wallet.balanceRtc,
        archive5Remaining: blocksFromRtc(wallet.balanceRtc),
        rtcPerArchive5: RTC_PER_ARCHIVE5,
      },
    };
  });

  /** POST /api/billing/use-free-demo — spend 1 RTC free demo */
  app.post("/api/billing/use-free-demo", async (req, reply) => {
    const { resolveUserFromAuthHeader } = await import("./auth.js");
    const user = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    try {
      const { consumeFreeDemo } = await import("../lib/system-bank.js");
      const result = await consumeFreeDemo(user.id);
      return {
        ...result,
        upgrade: {
          headline: "Free demo used! Unlock Archive5 + download",
          basic: { tier: "storm", price: "$49", rtc: 15 },
          premium: { tier: "storm_pro", price: "$99", rtc: 25 },
        },
      };
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  /** GET /api/billing/system-bank — public funnel stats */
  app.get("/api/billing/system-bank", async () => {
    const { ensureSystemBank, systemBankPublic } = await import("../lib/system-bank.js");
    const bank = await ensureSystemBank();
    return { systemBank: systemBankPublic(bank) };
  });

  app.post("/api/billing/grant-monthly", async (req, reply) => {
    const { requireAdmin } = await import("../lib/admin.js");
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });

    const body = (req.body || {}) as { email?: string; tier?: string };
    const email = body.email || "producer@reelstorm.academy";
    const tier = (body.tier || "storm") as "free" | "storm" | "storm_pro" | "premium_pro" | "network";
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, tier },
      update: { tier },
    });
    const { ensureUserWallet, creditRtc } = await import("../lib/rtc.js");
    let wallet = await ensureUserWallet(user.id, tier);
    const amount = TIER_MONTHLY_RTC[tier];
    wallet = await creditRtc({
      walletId: wallet.id,
      amount,
      type: "GRANT",
      note: `Monthly grant ${tier} by ${gate.user.email}`,
    });
    return { user, wallet, grantedRtc: amount };
  });

  /** POST /api/billing/checkout — Stripe Checkout for Basic / Premium / Premium Pro */
  app.post("/api/billing/checkout", async (req, reply) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return reply.code(503).send({ error: "STRIPE_SECRET_KEY not configured" });

    const { resolveUserFromAuthHeader } = await import("./auth.js");
    const user = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: "Sign in required" });

    const body = (req.body || {}) as { tier?: string };
    if (!isPaidTier(body.tier || "")) {
      return reply.code(400).send({ error: "tier must be storm | storm_pro | premium_pro" });
    }
    const tier = body.tier as "storm" | "storm_pro" | "premium_pro";

    const { stripePriceForTier } = await import("@reelstorm/domain");
    const priceId = stripePriceForTier(tier);
    if (priceId.includes("placeholder")) {
      return reply.code(503).send({
        error: `Stripe price missing for ${tier} — set STRIPE_PRICE_* in .env`,
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
        metadata: { userId: user.id, reelstormTier: tier },
      },
      metadata: { userId: user.id, reelstormTier: tier },
      success_url: `${appUrl}/wallet?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/wallet?cancelled=1`,
    });

    return { url: session.url, sessionId: session.id };
  });

  /** POST /api/billing/stripe-webhook — sync subscription → Prisma tier + RTC grant */
  app.post("/api/billing/stripe-webhook", { config: { rawBody: true } }, async (req, reply) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    const whsec = process.env.STRIPE_TIER_WEBHOOK_SECRET;
    if (!secret || !whsec) return reply.code(503).send({ error: "Stripe webhook not configured" });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(secret);
    const sig = req.headers["stripe-signature"] as string | undefined;
    const raw =
      (req as { rawBody?: Buffer }).rawBody ||
      Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));

    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig || "", whsec);
    } catch (err) {
      return reply.code(400).send({ error: `Webhook Error: ${(err as Error).message}` });
    }

    const handled = new Set([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "checkout.session.completed",
    ]);
    if (!handled.has(event.type)) return { received: true, ignored: event.type };

    const { tierForStripePrice, TIER_MONTHLY_RTC: monthly } = await import("@reelstorm/domain");
    const { ensureUserWallet, creditRtc } = await import("../lib/rtc.js");

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        metadata?: {
          userId?: string;
          reelstormTier?: string;
          product?: string;
          studioPlan?: string;
        };
        client_reference_id?: string | null;
        subscription?: string | null;
        customer?: string | null;
      };
      const userId = session.metadata?.userId || session.client_reference_id;
      if (!userId) return { received: true, skipped: "no_user_id" };

      // ReelStorm Studio desktop subscription
      if (session.metadata?.product === "studio") {
        const planRaw = session.metadata.studioPlan || "pro";
        const plan =
          planRaw === "starter" ||
          planRaw === "pro" ||
          planRaw === "agency" ||
          planRaw === "unlimited"
            ? planRaw
            : "pro";
        const { handleStudioStripeCheckout } = await import("./license.js");
        const issued = await handleStudioStripeCheckout({
          userId,
          plan,
          subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
        });
        // Plaintext key is issued once — client should fetch via regenerate or email hook later
        return {
          received: true,
          product: "studio",
          userId,
          plan,
          licenseId: issued.license.id,
          keyPrefix: issued.license.keyPrefix,
          // Do not put plaintextKey in webhook response logs long-term; available for email worker
          plaintextKey: issued.plaintextKey,
        };
      }

      const tierRaw = session.metadata?.reelstormTier;
      const tier =
        tierRaw === "premium_pro" || tierRaw === "storm_pro" || tierRaw === "storm"
          ? tierRaw
          : null;
      if (!tier) return { received: true, skipped: "no_tier" };
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          tier,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
          stripeSubscriptionId:
            typeof session.subscription === "string" ? session.subscription : undefined,
        },
      });
      let wallet = await ensureUserWallet(user.id, tier);
      wallet = await creditRtc({
        walletId: wallet.id,
        amount: monthly[tier],
        type: "GRANT",
        note: `Stripe checkout ${tier}`,
      });
      return { received: true, userId, tier, balanceRtc: wallet.balanceRtc };
    }

    const subscription = event.data.object as {
      id: string;
      status: string;
      metadata?: { userId?: string; product?: string; studioPlan?: string };
      customer?: string;
      items?: { data?: Array<{ price?: { id?: string } }> };
    };
    const userId = subscription.metadata?.userId;
    if (!userId) return { received: true, skipped: "no_user_id" };

    if (subscription.metadata?.product === "studio") {
      const { handleStudioSubscriptionUpdate } = await import("./license.js");
      const lic = await handleStudioSubscriptionUpdate({
        subscriptionId: subscription.id,
        status: subscription.status,
        userId,
      });
      return { received: true, product: "studio", userId, licenseId: lic?.id, status: lic?.status };
    }

    if (event.type === "customer.subscription.deleted" || !["active", "trialing"].includes(subscription.status)) {
      await prisma.user.update({
        where: { id: userId },
        data: { tier: "free", stripeSubscriptionId: null },
      });
      // Also cancel any Studio licenses on this subscription id
      const { handleStudioSubscriptionUpdate } = await import("./license.js");
      await handleStudioSubscriptionUpdate({
        subscriptionId: subscription.id,
        status: "canceled",
        userId,
      });
      return { received: true, userId, tier: "free" };
    }

    const priceId = subscription.items?.data?.[0]?.price?.id || "";
    const paid = tierForStripePrice(priceId);
    if (!paid) return { received: true, skipped: "unrecognized_price", priceId };

    await prisma.user.update({
      where: { id: userId },
      data: {
        tier: paid,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : undefined,
      },
    });
    return { received: true, userId, tier: paid };
  });
}
