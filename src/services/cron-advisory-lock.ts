import type { Prisma } from "@prisma/client";

import { prisma } from "../prisma";

export const CRON_LOCK_FEEDING = 6_917_058_472_834_591n;

export const CRON_LOCK_WEIGHT_WEEKLY = 2_847_591_058_736_482n;

/** Блокировка + работа только с БД на одном соединении; не вызывайте здесь Telegram API — держится короткая транзакция. */
export const runCronWithPgTransactionLock = async <T>(
  lockKey: bigint,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T | undefined> => {
  let out: T | undefined;
  await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ ok: boolean }[]>`
        SELECT pg_try_advisory_lock(${lockKey}) AS ok
      `;
      if (!rows[0]?.ok) {
        return;
      }
      out = await fn(tx);
    },
    { maxWait: 10_000, timeout: 120_000 },
  );
  return out;
};
