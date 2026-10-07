import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma, type SubTier } from "@reelstorm/db";
import { RTC_PER_ARCHIVE5, TIER_MONTHLY_RTC, blocksFromRtc, adminEmail } from "@reelstorm/domain";
import { requireAdmin } from "../lib/admin.js";
import { creditRtc, ensureUserWallet } from "../lib/rtc.js";

const TIERS = new Set(["free", "storm", "storm_pro", "premium_pro", "network"]);

function mintVoucherCode() {
  return `RS-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function adminRoutes(app: FastifyInstance) {
  /** GET /api/admin/me — confirm captain lock */
  app.get("/api/admin/me", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });
    return {
      admin: true,
      email: gate.user.email,
      lockedTo: adminEmail(),
    };
  });

  /** GET /api/admin/overview — system KPIs */
  app.get("/api/admin/overview", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });

    const [
      registeredUsers,
      walletsAgg,
      projects,
      introsCached,
      vouchersOpen,
      vouchersRedeemed,
      recentLedger,
      tierGroups,
      systemBank,
      studioLicenses,
      studioActive,
      studioDevices,
      studioMinutesUsed,
      cloneJobs,
      ytScripts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.rtcWallet.aggregate({
        _sum: { balanceRtc: true, lifetimeIn: true, lifetimeOut: true },
        _count: true,
      }),
      prisma.project.count(),
      prisma.introTemplate.count().catch(() => 0),
      prisma.giftVoucher.count({ where: { redeemedAt: null } }),
      prisma.giftVoucher.count({ where: { redeemedAt: { not: null } } }),
      prisma.rtcLedger.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          wallet: { select: { userId: true, tenantId: true, user: { select: { email: true } } } },
        },
      }),
      prisma.user.groupBy({ by: ["tier"], _count: true }),
      (async () => {
        const { ensureSystemBank, systemBankPublic } = await import("../lib/system-bank.js");
        return systemBankPublic(await ensureSystemBank());
      })(),
      prisma.studioLicense.count().catch(() => 0),
      prisma.studioLicense.count({ where: { status: "active" } }).catch(() => 0),
      prisma.studioDevice.count({ where: { revoked: false } }).catch(() => 0),
      prisma.studioLicense
        .aggregate({ _sum: { usedThisMonth: true } })
        .then((a) => Number(a._sum.usedThisMonth ?? 0))
        .catch(() => 0),
      prisma.cloneJob.count().catch(() => 0),
      prisma.ytScript.count().catch(() => 0),
    ]);

    const systemBalanceRtc = walletsAgg._sum.balanceRtc ?? 0;

    return {
      lockedTo: adminEmail(),
      stats: {
        registeredUsers,
        wallets: walletsAgg._count,
        systemBalanceRtc,
        systemArchive5Remaining: blocksFromRtc(systemBalanceRtc),
        rtcPerArchive5: RTC_PER_ARCHIVE5,
        lifetimeInRtc: walletsAgg._sum.lifetimeIn ?? 0,
        lifetimeOutRtc: walletsAgg._sum.lifetimeOut ?? 0,
        projects,
        introsCached,
        vouchersOpen,
        vouchersRedeemed,
        studioLicenses,
        studioActive,
        studioDevices,
        studioMinutesUsed,
        cloneJobs,
        ytScripts,
      },
      systemBank,
      tiers: Object.fromEntries(tierGroups.map((g) => [g.tier, g._count])),
      recentLedger: recentLedger.map((l) => ({
        id: l.id,
        type: l.type,
        amountRtc: l.amountRtc,
        balanceAfter: l.balanceAfter,
        note: l.note,
        email: l.wallet.user?.email ?? null,
        createdAt: l.createdAt,
      })),
    };
  });

  /** GET /api/admin/studio-licenses */
  app.get("/api/admin/studio-licenses", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });

    const licenses = await prisma.studioLicense.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        user: { select: { email: true, name: true } },
        devices: { where: { revoked: false }, select: { id: true, deviceName: true, lastSeenAt: true } },
      },
    });

    return {
      licenses: licenses.map((l) => ({
        id: l.id,
        email: l.user.email,
        name: l.user.name,
        plan: l.plan,
        status: l.status,
        keyPrefix: l.keyPrefix,
        monthlyLimit: l.monthlyLimit,
        usedThisMonth: Number(l.usedThisMonth),
        remaining: Math.max(0, l.monthlyLimit - Number(l.usedThisMonth)),
        devicesAllowed: l.devicesAllowed,
        devices: l.devices,
        expiresAt: l.expiresAt,
        createdAt: l.createdAt,
      })),
    };
  });

  /** POST /api/admin/studio-licenses/issue */
  app.post("/api/admin/studio-licenses/issue", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });

    const body = (req.body || {}) as { email?: string; plan?: string };
    const email = (body.email || "").trim().toLowerCase();
    const planRaw = (body.plan || "pro").trim();
    const plan =
      planRaw === "free" ||
      planRaw === "starter" ||
      planRaw === "pro" ||
      planRaw === "agency" ||
      planRaw === "unlimited"
        ? planRaw
        : null;
    if (!email || !plan) {
      return reply.code(400).send({ error: "email + plan (free|starter|pro|agency|unlimited) required" });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: email.split("@")[0], tier: "free", rtcBalance: 0 },
      });
    }

    const { issueStudioLicense } = await import("../lib/studio-license.js");
    const { license, plaintextKey } = await issueStudioLicense({ userId: user.id, plan });
    return {
      ok: true,
      license: {
        id: license.id,
        plan: license.plan,
        keyPrefix: license.keyPrefix,
        monthlyLimit: license.monthlyLimit,
        status: license.status,
      },
      plaintextKey,
      warning: "Shown once — copy for the user now",
      email: user.email,
    };
  });

  /** POST /api/admin/studio-licenses/:id/revoke */
  app.post("/api/admin/studio-licenses/:id/revoke", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });
    const { id } = req.params as { id: string };
    const license = await prisma.studioLicense.update({
      where: { id },
      data: { status: "revoked" },
    });
    await prisma.studioDevice.updateMany({
      where: { licenseId: id },
      data: { revoked: true, activatedTokenHash: null },
    });
    return { ok: true, license: { id: license.id, status: license.status } };
  });

  /** POST /api/admin/studio-licenses/:id/regenerate */
  app.post("/api/admin/studio-licenses/:id/regenerate", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });
    const { id } = req.params as { id: string };
    const { regenerateStudioLicense } = await import("../lib/studio-license.js");
    const { license, plaintextKey } = await regenerateStudioLicense(id);
    return {
      ok: true,
      license: { id: license.id, keyPrefix: license.keyPrefix, jwtVersion: license.jwtVersion },
      plaintextKey,
      warning: "Shown once — old keys invalidated",
    };
  });

  /** GET /api/admin/users?q=&limit= */
  app.get("/api/admin/users", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });

    const q = req.query as { q?: string; limit?: string };
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
    const search = (q.q || "").trim();

    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        wallet: { select: { balanceRtc: true, lifetimeIn: true, lifetimeOut: true } },
        _count: { select: { projects: true } },
      },
    });

    return {
      count: users.length,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        tier: u.tier,
        onboardingCompleted: u.onboardingCompleted,
        createdAt: u.createdAt,
        projects: u._count.projects,
        balanceRtc: u.wallet?.balanceRtc ?? 0,
        archive5Remaining: blocksFromRtc(u.wallet?.balanceRtc ?? 0),
        lifetimeIn: u.wallet?.lifetimeIn ?? 0,
        lifetimeOut: u.wallet?.lifetimeOut ?? 0,
      })),
    };
  });

  /** POST /api/admin/gift-credits — allocate RTC to a user by email */
  app.post("/api/admin/gift-credits", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });

    const body = (req.body || {}) as {
      email?: string;
      amountRtc?: number;
      note?: string;
      createIfMissing?: boolean;
    };
    const email = (body.email || "").trim().toLowerCase();
    const amount = Math.floor(Number(body.amountRtc) || 0);
    if (!email || !email.includes("@")) {
      return reply.code(400).send({ error: "Valid email required" });
    }
    if (amount <= 0 || amount > 100_000) {
      return reply.code(400).send({ error: "amountRtc must be 1–100000" });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (body.createIfMissing === false) {
        return reply.code(404).send({ error: "User not found" });
      }
      user = await prisma.user.create({
        data: { email, name: email.split("@")[0], tier: "free" },
      });
    }

    const wallet = await ensureUserWallet(user.id, user.tier as never);
    const updated = await creditRtc({
      walletId: wallet.id,
      amount,
      type: "GIFT",
      note: body.note || `Admin gift from ${gate.user.email}`,
      refType: "admin_gift",
      refId: gate.user.id,
    });

    return {
      ok: true,
      user: { id: user.id, email: user.email, tier: user.tier },
      grantedRtc: amount,
      balanceRtc: updated.balanceRtc,
      archive5Remaining: blocksFromRtc(updated.balanceRtc),
    };
  });

  /** PATCH /api/admin/users/:id — set tier */
  app.patch("/api/admin/users/:id", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });

    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { tier?: string };
    const tier = (body.tier || "").trim();
    if (!TIERS.has(tier)) {
      return reply.code(400).send({ error: "Invalid tier", allowed: [...TIERS] });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { tier: tier as SubTier },
    });
    return { ok: true, user: { id: user.id, email: user.email, tier: user.tier } };
  });

  /** GET /api/admin/vouchers */
  app.get("/api/admin/vouchers", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });

    const vouchers = await prisma.giftVoucher.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { vouchers };
  });

  /** POST /api/admin/vouchers — mint gift voucher code */
  app.post("/api/admin/vouchers", async (req, reply) => {
    const gate = await requireAdmin(req.headers.authorization);
    if (!gate.ok) return reply.code(gate.status).send({ error: gate.error });

    const body = (req.body || {}) as {
      amountRtc?: number;
      note?: string;
      expiresInDays?: number;
      code?: string;
    };
    const amount = Math.floor(Number(body.amountRtc) || 0);
    if (amount <= 0 || amount > 50_000) {
      return reply.code(400).send({ error: "amountRtc must be 1–50000" });
    }

    const code = (body.code || mintVoucherCode()).trim().toUpperCase();
    const expiresAt =
      body.expiresInDays && body.expiresInDays > 0
        ? new Date(Date.now() + body.expiresInDays * 86400000)
        : null;

    try {
      const voucher = await prisma.giftVoucher.create({
        data: {
          code,
          amountRtc: amount,
          note: body.note || null,
          createdBy: gate.user.email,
          expiresAt,
        },
      });
      return { ok: true, voucher };
    } catch {
      return reply.code(409).send({ error: "Voucher code already exists" });
    }
  });

  /** POST /api/billing/redeem-voucher — any authenticated user */
  app.post("/api/billing/redeem-voucher", async (req, reply) => {
    const { resolveUserFromAuthHeader } = await import("./auth.js");
    const user = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    const body = (req.body || {}) as { code?: string };
    const code = (body.code || "").trim().toUpperCase();
    if (!code) return reply.code(400).send({ error: "code required" });

    const voucher = await prisma.giftVoucher.findUnique({ where: { code } });
    if (!voucher) return reply.code(404).send({ error: "Invalid voucher code" });
    if (voucher.redeemedAt) return reply.code(409).send({ error: "Voucher already redeemed" });
    if (voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()) {
      return reply.code(410).send({ error: "Voucher expired" });
    }

    const wallet = await ensureUserWallet(user.id, user.tier as never);
    const updated = await creditRtc({
      walletId: wallet.id,
      amount: voucher.amountRtc,
      type: "VOUCHER",
      note: `Redeemed ${voucher.code}`,
      refType: "gift_voucher",
      refId: voucher.id,
    });

    await prisma.giftVoucher.update({
      where: { id: voucher.id },
      data: { redeemedAt: new Date(), redeemedBy: user.email },
    });

    return {
      ok: true,
      grantedRtc: voucher.amountRtc,
      balanceRtc: updated.balanceRtc,
      archive5Remaining: blocksFromRtc(updated.balanceRtc),
      code: voucher.code,
    };
  });
}
