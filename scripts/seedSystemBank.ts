/**
 * Seed / upsert the SystemBank singleton (4600 RTC free-demo pool).
 *   npx tsx scripts/seedSystemBank.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import { PrismaClient } from "@prisma/client";

const SYSTEM_BANK_ID = "reelstorm-system-bank";
const prisma = new PrismaClient();

async function main() {
  const bank = await prisma.systemBank.upsert({
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
    update: {
      totalRTC: 4600,
      totalSets: 920,
      rtcPerSet: 5,
      costBasis: 1.93,
    },
  });
  const remaining = Math.max(0, bank.totalRTC - bank.usedRTC);
  const fixed = await prisma.systemBank.update({
    where: { id: SYSTEM_BANK_ID },
    data: { remainingRTC: remaining },
  });
  console.log("SystemBank ready:", fixed);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
