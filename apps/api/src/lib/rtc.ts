import { createHash, randomBytes } from "node:crypto";
import { prisma, type SubTier } from "@reelstorm/db";
import {
  RTC_PER_ARCHIVE5,
  TIER_MONTHLY_RTC,
  rtcForDurationSec,
  type Tier,
} from "@reelstorm/domain";

export function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function mintWhiteLabelKey(): { raw: string; prefix: string; hash: string } {
  const raw = `rs_live_${randomBytes(24).toString("hex")}`;
  return { raw, prefix: raw.slice(0, 16), hash: hashApiKey(raw) };
}

export async function ensureUserWallet(userId: string, tier: Tier = "free") {
  let wallet = await prisma.rtcWallet.findUnique({ where: { userId } });
  if (!wallet) {
    const grant = TIER_MONTHLY_RTC[tier] ?? TIER_MONTHLY_RTC.free;
    wallet = await prisma.rtcWallet.create({
      data: {
        userId,
        balanceRtc: grant,
        lifetimeIn: grant,
        ledger: {
          create: {
            type: "GRANT",
            amountRtc: grant,
            balanceAfter: grant,
            note: `Monthly ${tier} allotment`,
          },
        },
      },
    });
  }
  return wallet;
}

export async function ensureTenantWallet(tenantId: string, tier: Tier = "storm_pro") {
  let wallet = await prisma.rtcWallet.findUnique({ where: { tenantId } });
  if (!wallet) {
    const grant = TIER_MONTHLY_RTC[tier] ?? TIER_MONTHLY_RTC.storm_pro;
    wallet = await prisma.rtcWallet.create({
      data: {
        tenantId,
        balanceRtc: grant,
        lifetimeIn: grant,
        ledger: {
          create: {
            type: "GRANT",
            amountRtc: grant,
            balanceAfter: grant,
            note: `Tenant ${tier} pool`,
          },
        },
      },
    });
  }
  return wallet;
}

export async function creditRtc(opts: {
  walletId: string;
  amount: number;
  type: string;
  note?: string;
  refType?: string;
  refId?: string;
}) {
  if (opts.amount <= 0) throw new Error("credit amount must be > 0");
  return prisma.$transaction(async (tx) => {
    const w = await tx.rtcWallet.findUniqueOrThrow({ where: { id: opts.walletId } });
    const balance = w.balanceRtc + opts.amount;
    await tx.rtcLedger.create({
      data: {
        walletId: opts.walletId,
        type: opts.type,
        amountRtc: opts.amount,
        balanceAfter: balance,
        note: opts.note,
        refType: opts.refType,
        refId: opts.refId,
      },
    });
    return tx.rtcWallet.update({
      where: { id: opts.walletId },
      data: { balanceRtc: balance, lifetimeIn: w.lifetimeIn + opts.amount },
    });
  });
}

export async function debitRtc(opts: {
  walletId: string;
  amount: number;
  type: string;
  note?: string;
  refType?: string;
  refId?: string;
}) {
  if (opts.amount <= 0) throw new Error("debit amount must be > 0");
  return prisma.$transaction(async (tx) => {
    const w = await tx.rtcWallet.findUniqueOrThrow({ where: { id: opts.walletId } });
    if (w.balanceRtc < opts.amount) {
      throw new Error(`Insufficient RTC: need ${opts.amount}, have ${w.balanceRtc}`);
    }
    const balance = w.balanceRtc - opts.amount;
    await tx.rtcLedger.create({
      data: {
        walletId: opts.walletId,
        type: opts.type,
        amountRtc: -opts.amount,
        balanceAfter: balance,
        note: opts.note,
        refType: opts.refType,
        refId: opts.refId,
      },
    });
    return tx.rtcWallet.update({
      where: { id: opts.walletId },
      data: { balanceRtc: balance, lifetimeOut: w.lifetimeOut + opts.amount },
    });
  });
}

export async function debitArchive5(walletId: string, blockId: string, durationSec = 300) {
  const amount = rtcForDurationSec(durationSec);
  return debitRtc({
    walletId,
    amount,
    type: "DEBIT_ARCHIVE5",
    note: `${amount} RTC for ARCHIVE5 (${Math.ceil(durationSec / 300)} × 5-min)`,
    refType: "block",
    refId: blockId,
  });
}

export { RTC_PER_ARCHIVE5 };

export async function resolveWhiteLabelKey(rawKey: string) {
  const hash = hashApiKey(rawKey);
  const key = await prisma.whiteLabelKey.findUnique({
    where: { keyHash: hash },
    include: { tenant: { include: { brand: true, wallet: true } } },
  });
  if (!key || key.revokedAt) return null;
  if (key.tenant.status !== "active") return null;
  await prisma.whiteLabelKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });
  return key;
}

export function toSubTier(tier: Tier): SubTier {
  return tier as SubTier;
}
