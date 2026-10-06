import { prisma } from "@reelstorm/db";
import {
  FREE_DEMO_RTC,
  SYSTEM_BANK_COST_PER_RTC,
  SYSTEM_BANK_ID,
  SYSTEM_BANK_RTC_PER_SET,
  SYSTEM_BANK_TOTAL_RTC,
  SYSTEM_BANK_TOTAL_SETS,
} from "@reelstorm/domain";

export async function ensureSystemBank() {
  return prisma.systemBank.upsert({
    where: { id: SYSTEM_BANK_ID },
    create: {
      id: SYSTEM_BANK_ID,
      totalRTC: SYSTEM_BANK_TOTAL_RTC,
      usedRTC: 0,
      remainingRTC: SYSTEM_BANK_TOTAL_RTC,
      totalSets: SYSTEM_BANK_TOTAL_SETS,
      rtcPerSet: SYSTEM_BANK_RTC_PER_SET,
      costBasis: SYSTEM_BANK_COST_PER_RTC,
    },
    update: {
      totalRTC: SYSTEM_BANK_TOTAL_RTC,
      totalSets: SYSTEM_BANK_TOTAL_SETS,
      rtcPerSet: SYSTEM_BANK_RTC_PER_SET,
      costBasis: SYSTEM_BANK_COST_PER_RTC,
    },
  });
}

export function systemBankPublic(bank: {
  totalRTC: number;
  usedRTC: number;
  remainingRTC: number;
  totalSets: number;
  rtcPerSet: number;
  costBasis: number;
}) {
  const costSunk = bank.totalRTC * bank.costBasis;
  return {
    total: bank.totalRTC,
    remaining: bank.remainingRTC,
    used: bank.usedRTC,
    sets: bank.totalSets,
    rtcPerSet: bank.rtcPerSet,
    costBasis: bank.costBasis,
    costSunkUsd: Math.round(costSunk * 100) / 100,
    revenueAt799: Math.round(bank.totalRTC * 7.99 * 100) / 100,
    revenueAt1299: Math.round(bank.totalRTC * 12.99 * 100) / 100,
    funnelHint:
      "4600 free demos → ~10% convert to Premium ($99) ≈ 460 users ≈ $45,540 MRR potential",
  };
}

/**
 * Grant 1 RTC free demo from SystemBank once per user.
 * Idempotent via freeDemoGrantedAt.
 */
export async function grantFreeDemoFromBank(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
  if (!user) throw new Error("User not found");

  if (user.freeDemoGrantedAt) {
    // Keep denormalized balance in sync with wallet
    const bal = user.wallet?.balanceRtc ?? user.rtcBalance;
    if (user.rtcBalance !== bal) {
      await prisma.user.update({ where: { id: userId }, data: { rtcBalance: bal } });
    }
    return { granted: false, reason: "already_granted" as const, userId };
  }

  const bank = await ensureSystemBank();
  if (bank.remainingRTC < FREE_DEMO_RTC) {
    throw new Error("SystemBank exhausted — no free demos left");
  }

  let outcome: "allocated" | "legacy_marked" = "allocated";

  await prisma.$transaction(async (tx) => {
    let wallet = await tx.rtcWallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await tx.rtcWallet.create({
        data: {
          userId,
          balanceRtc: FREE_DEMO_RTC,
          lifetimeIn: FREE_DEMO_RTC,
          ledger: {
            create: {
              type: "FREE_DEMO_GRANT",
              amountRtc: FREE_DEMO_RTC,
              balanceAfter: FREE_DEMO_RTC,
              note: "1-min free demo by default",
              refType: "system_bank",
              refId: SYSTEM_BANK_ID,
            },
          },
        },
      });
    } else if (wallet.balanceRtc <= 0) {
      const balance = wallet.balanceRtc + FREE_DEMO_RTC;
      await tx.rtcLedger.create({
        data: {
          walletId: wallet.id,
          type: "FREE_DEMO_GRANT",
          amountRtc: FREE_DEMO_RTC,
          balanceAfter: balance,
          note: "1-min free demo by default",
          refType: "system_bank",
          refId: SYSTEM_BANK_ID,
        },
      });
      wallet = await tx.rtcWallet.update({
        where: { id: wallet.id },
        data: { balanceRtc: balance, lifetimeIn: wallet.lifetimeIn + FREE_DEMO_RTC },
      });
    } else {
      outcome = "legacy_marked";
      await tx.user.update({
        where: { id: userId },
        data: {
          freeDemoGrantedAt: new Date(),
          freeDemoUsed: false,
          rtcBalance: wallet.balanceRtc,
        },
      });
      return;
    }

    await tx.systemBank.update({
      where: { id: SYSTEM_BANK_ID },
      data: {
        usedRTC: { increment: FREE_DEMO_RTC },
        remainingRTC: { decrement: FREE_DEMO_RTC },
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        freeDemoGrantedAt: new Date(),
        freeDemoUsed: false,
        rtcBalance: wallet.balanceRtc,
      },
    });
  });

  return {
    granted: outcome === "allocated",
    reason: outcome,
    userId,
  };
}

/** Spend the 1-min free demo (debit wallet + flag used). */
export async function consumeFreeDemo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
  if (!user) throw new Error("User not found");
  if (user.tier !== "free") throw new Error("Free demo only applies to Free Test tier");
  if (user.freeDemoUsed) throw new Error("Free demo already used");
  if (!user.wallet || user.wallet.balanceRtc < FREE_DEMO_RTC) {
    throw new Error("Insufficient RTC for free demo");
  }

  const balance = user.wallet.balanceRtc - FREE_DEMO_RTC;
  await prisma.$transaction(async (tx) => {
    await tx.rtcLedger.create({
      data: {
        walletId: user.wallet!.id,
        type: "FREE_DEMO_USED",
        amountRtc: -FREE_DEMO_RTC,
        balanceAfter: balance,
        note: "1-min free demo used (480p watermarked preview)",
        refType: "free_demo",
        refId: userId,
      },
    });
    await tx.rtcWallet.update({
      where: { id: user.wallet!.id },
      data: {
        balanceRtc: balance,
        lifetimeOut: user.wallet!.lifetimeOut + FREE_DEMO_RTC,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { freeDemoUsed: true, rtcBalance: balance },
    });
  });

  return { ok: true, balanceRtc: balance, freeDemoUsed: true };
}
