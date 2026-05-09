import { NotificationType, type FeedingLog, type Prisma } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import cron from "node-cron";
import type { Telegraf } from "telegraf";

import { config } from "../config";
import { listWeightLogsForPetsInRange } from "../modules/weight/weight.service";
import { bullmqConnectionFromRedisUrl } from "../utils/redis-url";
import {
  getCurrentMinutesByTimezone,
  getDayRangeByTimezone,
  getLocalNow,
  getWeekRangeByTimezone,
} from "../utils/date";
import {
  CRON_LOCK_FEEDING,
  CRON_LOCK_WEIGHT_WEEKLY,
  runCronWithPgTransactionLock,
} from "./cron-advisory-lock";

const existingKey = (type: NotificationType, key: string) => `${type}:${key}`;

type FeedingDelivery = {
  telegramId: number;
  text: string;
  callbackData?: string;
};

type WeightWeeklyDelivery = {
  telegramId: number;
  text: string;
};

const bullMqPrefixFromSessionPrefix = (raw: string) => {
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const base = safe.slice(0, 48) || "pet-tracker";
  return `{bull:${base}}`;
};

async function flushFeedingDeliveries(bot: Telegraf<any>, deliveries: FeedingDelivery[]) {
  for (const d of deliveries) {
    await bot.telegram.sendMessage(d.telegramId, d.text, {
      reply_markup: d.callbackData
        ? { inline_keyboard: [[{ text: "🍽️ Покормить", callback_data: d.callbackData }]] }
        : undefined,
    });
  }
}

async function flushWeightDeliveries(bot: Telegraf<any>, deliveries: WeightWeeklyDelivery[]) {
  for (const d of deliveries) {
    await bot.telegram.sendMessage(d.telegramId, d.text);
  }
}

async function runFeedingTick(bot: Telegraf<any>): Promise<void> {
  const deliveries = await runCronWithPgTransactionLock(CRON_LOCK_FEEDING, planFeedingNotifications);
  if (!deliveries?.length) return;
  await flushFeedingDeliveries(bot, deliveries);
}

async function runWeightTick(bot: Telegraf<any>): Promise<void> {
  const deliveries = await runCronWithPgTransactionLock(
    CRON_LOCK_WEIGHT_WEEKLY,
    planWeightWeeklyNotifications,
  );
  if (!deliveries?.length) return;
  await flushWeightDeliveries(bot, deliveries);
}

const planFeedingNotifications = async (
  tx: Prisma.TransactionClient,
): Promise<FeedingDelivery[]> => {
  const deliveries: FeedingDelivery[] = [];

  const users = await tx.user.findMany({
    include: {
      pets: {
        include: {
          pet: {
            include: {
              feedingConfig: { include: { scheduleItems: true } },
            },
          },
        },
      },
    },
  });

  for (const user of users) {
    const localNow = getLocalNow(user.timezone);
    const currentMinutes = getCurrentMinutesByTimezone(user.timezone);
    const dayRange = getDayRangeByTimezone(user.timezone);
    const localDayKey = localNow.format("YYYY-MM-DD");

    const existingLogs = await tx.notificationLog.findMany({
      where: {
        userId: user.id,
        sentAt: { gte: dayRange.start, lte: dayRange.end },
      },
    });
    const existingKeys = new Set(existingLogs.map((x) => existingKey(x.type, x.key)));

    const pets = user.pets.filter((acc) => !acc.pet.isDeleted).map((acc) => acc.pet);
    const petIds = pets.map((p) => p.id);

    const logsByPet = new Map<string, FeedingLog[]>();
    if (petIds.length) {
      const allLogs = await tx.feedingLog.findMany({
        where: {
          petId: { in: petIds },
          createdAt: { gte: dayRange.start, lte: dayRange.end },
        },
      });
      for (const log of allLogs) {
        const list = logsByPet.get(log.petId) ?? [];
        list.push(log);
        logsByPet.set(log.petId, list);
      }
    }

    for (const pet of pets) {
      const todayFeedLogs = logsByPet.get(pet.id) ?? [];

      if (!pet.feedingConfig || pet.feedingConfig.scheduleItems.length === 0) {
        const key = `${localDayKey}:${pet.id}:fallback_14_00`;
        if (
          currentMinutes >= 14 * 60 &&
          todayFeedLogs.length === 0 &&
          !existingKeys.has(existingKey(NotificationType.FEEDING_DAILY_FALLBACK, key))
        ) {
          await tx.notificationLog.create({
            data: {
              userId: user.id,
              petId: pet.id,
              type: NotificationType.FEEDING_DAILY_FALLBACK,
              key,
            },
          });
          existingKeys.add(existingKey(NotificationType.FEEDING_DAILY_FALLBACK, key));
          deliveries.push({
            telegramId: Number(user.telegramId),
            text: `Похоже, ${pet.name} сегодня еще не ела. Не пора ли покормить? 🍽️`,
            callbackData: `feed:${pet.id}`,
          });
        }
        continue;
      }

      for (const item of pet.feedingConfig.scheduleItems) {
        const slotKey = `${localDayKey}:${pet.id}:${item.id}`;
        const isTime = currentMinutes >= item.minutesOfDay + 15 && currentMinutes <= item.minutesOfDay + 29;
        if (!isTime) continue;
        const alreadyDone = todayFeedLogs.some((x) => x.feedingScheduleId === item.id);
        if (
          alreadyDone ||
          existingKeys.has(existingKey(NotificationType.FEEDING_SCHEDULE, slotKey))
        ) {
          continue;
        }
        await tx.notificationLog.create({
          data: {
            userId: user.id,
            petId: pet.id,
            type: NotificationType.FEEDING_SCHEDULE,
            key: slotKey,
          },
        });
        existingKeys.add(existingKey(NotificationType.FEEDING_SCHEDULE, slotKey));
        deliveries.push({
          telegramId: Number(user.telegramId),
          text: `Вы уже успели покормить ${pet.name}? План на ${String(Math.floor(item.minutesOfDay / 60)).padStart(2, "0")}:${String(item.minutesOfDay % 60).padStart(2, "0")} еще не отмечен.`,
          callbackData: `feed:${pet.id}`,
        });
      }
    }
  }

  return deliveries;
};

const planWeightWeeklyNotifications = async (
  tx: Prisma.TransactionClient,
): Promise<WeightWeeklyDelivery[]> => {
  const deliveries: WeightWeeklyDelivery[] = [];

  const users = await tx.user.findMany({
    include: {
      pets: {
        include: {
          pet: true,
        },
      },
    },
  });

  for (const user of users) {
    const localNow = getLocalNow(user.timezone);
    if (localNow.day() !== 0 || localNow.hour() !== 19) {
      continue;
    }
    const weekRange = getWeekRangeByTimezone(user.timezone);
    const weeklyKey = `${localNow.format("GGGG-[W]WW")}`;
    const pets = user.pets.filter((acc) => !acc.pet.isDeleted).map((acc) => acc.pet);
    const petIds = pets.map((p) => p.id);

    const weightRows = petIds.length
      ? await listWeightLogsForPetsInRange(petIds, weekRange, tx)
      : [];
    const petsWithWeight = new Set(weightRows.map((r) => r.petId));

    for (const pet of pets) {
      const key = `${weeklyKey}:${pet.id}`;
      if (petsWithWeight.has(pet.id)) continue;
      const alreadySent = await tx.notificationLog.findUnique({
        where: {
          userId_type_key: {
            userId: user.id,
            type: NotificationType.WEIGHT_WEEKLY,
            key,
          },
        },
      });
      if (alreadySent) continue;
      await tx.notificationLog.create({
        data: {
          userId: user.id,
          petId: pet.id,
          type: NotificationType.WEIGHT_WEEKLY,
          key,
        },
      });
      deliveries.push({
        telegramId: Number(user.telegramId),
        text: `Напоминание: взвесьте ${pet.name}, чтобы отследить динамику веса ⚖️`,
      });
    }
  }

  return deliveries;
};

const FEED_QUEUE = "notifications-feed";
const WEIGHT_QUEUE = "notifications-weight";
const JOB_REPEAT_FEED_ID = "pet-tracker-feed-repeat-v1";
const JOB_REPEAT_WEIGHT_ID = "pet-tracker-weight-repeat-v1";

let bullCloser: (() => Promise<void>) | null = null;

const startNotificationsBullMq = async (bot: Telegraf<any>) => {
  const conn = bullmqConnectionFromRedisUrl(config.REDIS_URL!);
  const prefix = bullMqPrefixFromSessionPrefix(config.REDIS_SESSION_PREFIX);

  const feedingQueue = new Queue(FEED_QUEUE, { connection: conn, prefix });
  const weightQueue = new Queue(WEIGHT_QUEUE, { connection: conn, prefix });

  await feedingQueue.add(
    "tick",
    {},
    {
      repeat: { pattern: "*/15 * * * *" },
      jobId: JOB_REPEAT_FEED_ID,
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  );

  await weightQueue.add(
    "tick",
    {},
    {
      repeat: { pattern: "0 * * * *" },
      jobId: JOB_REPEAT_WEIGHT_ID,
      removeOnComplete: 48,
      removeOnFail: 24,
    },
  );

  const feedingWorker = new Worker(
    FEED_QUEUE,
    async () => runFeedingTick(bot),
    { connection: { ...conn }, prefix, concurrency: 1 },
  );

  const weightWorker = new Worker(
    WEIGHT_QUEUE,
    async () => runWeightTick(bot),
    { connection: { ...conn }, prefix, concurrency: 1 },
  );

  feedingWorker.on("failed", (job, err) =>
    console.error(`[notifications][${FEED_QUEUE}] job ${job?.id}`, err),
  );
  weightWorker.on("failed", (job, err) =>
    console.error(`[notifications][${WEIGHT_QUEUE}] job ${job?.id}`, err),
  );

  feedingWorker.on("error", (err) => console.error("[notifications]", FEED_QUEUE, err));
  weightWorker.on("error", (err) => console.error("[notifications]", WEIGHT_QUEUE, err));

  bullCloser = async () => {
    await feedingWorker.close();
    await weightWorker.close();
    await feedingQueue.close();
    await weightQueue.close();
    bullCloser = null;
  };

  console.log("[notifications] BullMQ: feeding */15 + weight hourly (Redis prefix", prefix + ")");
};

const startNotificationsCron = (bot: Telegraf<any>) => {
  cron.schedule("*/15 * * * *", async () => runFeedingTick(bot));

  cron.schedule("0 * * * *", async () => runWeightTick(bot));

  console.log("[notifications] node-cron (Redis не задан, без BullMQ)");
};

export async function startNotifications(bot: Telegraf<any>): Promise<void> {
  if (config.REDIS_URL) {
    await startNotificationsBullMq(bot);
  } else {
    startNotificationsCron(bot);
  }
}

export async function stopNotificationScheduler(): Promise<void> {
  await bullCloser?.();
}
