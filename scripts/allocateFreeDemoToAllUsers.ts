/**
 * Retroactively allocate 1 RTC free demo to users with 0 balance.
 *   npx tsx scripts/allocateFreeDemoToAllUsers.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import { PrismaClient } from "@prisma/client";

const SYSTEM_BANK_ID = "reelstorm-system-bank";
const FREE_DEMO_RTC = 1;
const prisma = new PrismaClient();

async function ensureBank() {
  return prisma.systemBank.upsert({
    where: { id: SYSTEM_BANK_ID },
    create: {
      id: SYSTEM_BANK_ID,
      totalRTC: 4600,
      usedRTC: 0,
      remainingRTC: 4600,
      totalSets: 920,
      rtcPerSet: 5,
      costBasis: 1.93,
    },
    update: {},
  });
}

async function main() {
  await ensureBank();
  const users = await prisma.user.findMany({
    include: { wallet: true },
    orderBy: { createdAt: "asc" },
  });
  let allocated = 0;
  let skipped = 0;

  for (const user of users) {
    if (user.freeDemoGrantedAt) {
      skipped += 1;
      continue;
    }
    const bal = user.wallet?.balanceRtc ?? user.rtcBalance ?? 0;
    if (bal > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { freeDemoGrantedAt: new Date(), freeDemoUsed: false, rtcBalance: bal },
      });
      skipped += 1;
      continue;
    }

    const bank = await prisma.systemBank.findUniqueOrThrow({ where: { id: SYSTEM_BANK_ID } });
    if (bank.remainingRTC < FREE_DEMO_RTC) {
      console.warn("SystemBank exhausted — stopping");
      break;
    }

    await prisma.$transaction(async (tx) => {
      let wallet = await tx.rtcWallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        wallet = await tx.rtcWallet.create({
          data: {
            userId: user.id,
            balanceRtc: FREE_DEMO_RTC,
            lifetimeIn: FREE_DEMO_RTC,
            ledger: {
              create: {
                type: "FREE_DEMO_GRANT",
                amountRtc: FREE_DEMO_RTC,
                balanceAfter: FREE_DEMO_RTC,
                note: "1-min free demo by default (retroactive)",
                refType: "system_bank",
                refId: SYSTEM_BANK_ID,
              },
            },
          },
        });
      } else {
        const next = wallet.balanceRtc + FREE_DEMO_RTC;
        await tx.rtcLedger.create({
          data: {
            walletId: wallet.id,
            type: "FREE_DEMO_GRANT",
            amountRtc: FREE_DEMO_RTC,
            balanceAfter: next,
            note: "1-min free demo by default (retroactive)",
            refType: "system_bank",
            refId: SYSTEM_BANK_ID,
          },
        });
        wallet = await tx.rtcWallet.update({
          where: { id: wallet.id },
          data: { balanceRtc: next, lifetimeIn: wallet.lifetimeIn + FREE_DEMO_RTC },
        });
      }
      await tx.systemBank.update({
        where: { id: SYSTEM_BANK_ID },
        data: { usedRTC: { increment: FREE_DEMO_RTC }, remainingRTC: { decrement: FREE_DEMO_RTC } },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { freeDemoGrantedAt: new Date(), freeDemoUsed: false, rtcBalance: wallet.balanceRtc },
      });
    });
    allocated += 1;
    console.log(`+1 RTC → ${user.email}`);
  }

  const bank = await prisma.systemBank.findUniqueOrThrow({ where: { id: SYSTEM_BANK_ID } });
  console.log(`Allocated 1 RTC free demo to ${allocated} users (${skipped} skipped)`);
  console.log("SystemBank:", { total: bank.totalRTC, used: bank.usedRTC, remaining: bank.remainingRTC });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
