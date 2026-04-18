import cron from "node-cron";

import { Telegraf } from "telegraf";
import { NotificationType } from "@prisma/client";
import { getCurrentMinutesByTimezone, getDayRangeByTimezone, getLocalNow, getWeekRangeByTimezone } from "../utils/date";
import { prisma } from "../prisma";

export const startNotifications = (bot: Telegraf) => {
  cron.schedule("*/15 * * * *", async () => {
    const users = await prisma.user.findMany({
      include: { pets: { include: { pet: { include: { feedingConfig: { include: { scheduleItems: true } } } } } } },
    });
    for (const user of users) {
      const localNow = getLocalNow(user.timezone);
      const currentMinutes = getCurrentMinutesByTimezone(user.timezone);
      const dayRange = getDayRangeByTimezone(user.timezone);
      const localDayKey = localNow.format("YYYY-MM-DD");

      const existingLogs = await prisma.notificationLog.findMany({
        where: {
          userId: user.id,
          sentAt: { gte: dayRange.start, lte: dayRange.end },
        },
      });
      const existingKeys = new Set(existingLogs.map((x) => `${x.type}:${x.key}`));

      for (const acc of user.pets) {
        if (acc.pet.isDeleted) continue;
        const pet = acc.pet;
        const todayFeedLogs = await prisma.feedingLog.findMany({
          where: { petId: pet.id, createdAt: { gte: dayRange.start, lte: dayRange.end } },
        });
        if (!pet.feedingConfig || pet.feedingConfig.scheduleItems.length === 0) {
          const key = `${localDayKey}:${pet.id}:fallback_14_00`;
          if (currentMinutes >= 14 * 60 && todayFeedLogs.length === 0 && !existingKeys.has(`${NotificationType.FEEDING_DAILY_FALLBACK}:${key}`)) {
            await bot.telegram.sendMessage(Number(user.telegramId), `Похоже, ${pet.name} сегодня еще не ела. Не пора ли покормить? 🍽️`, {
              reply_markup: { inline_keyboard: [[{ text: "🍽️ Покормить", callback_data: `feed:${pet.id}` }]] },
            });
            await prisma.notificationLog.create({
              data: {
                userId: user.id,
                petId: pet.id,
                type: NotificationType.FEEDING_DAILY_FALLBACK,
                key,
              },
            });
          }
          continue;
        }

        for (const item of pet.feedingConfig.scheduleItems) {
          const slotKey = `${localDayKey}:${pet.id}:${item.id}`;
          const isTime = currentMinutes >= item.minutesOfDay + 15 && currentMinutes <= item.minutesOfDay + 29;
          if (!isTime) continue;
          const alreadyDone = todayFeedLogs.some((x) => x.feedingScheduleId === item.id);
          if (!alreadyDone && !existingKeys.has(`${NotificationType.FEEDING_SCHEDULE}:${slotKey}`)) {
            await bot.telegram.sendMessage(
              Number(user.telegramId),
              `Вы уже успели покормить ${pet.name}? План на ${String(Math.floor(item.minutesOfDay / 60)).padStart(2, "0")}:${String(item.minutesOfDay % 60).padStart(2, "0")} еще не отмечен.`,
              {
                reply_markup: { inline_keyboard: [[{ text: "🍽️ Покормить", callback_data: `feed:${pet.id}` }]] },
              },
            );
            await prisma.notificationLog.create({
              data: {
                userId: user.id,
                petId: pet.id,
                type: NotificationType.FEEDING_SCHEDULE,
                key: slotKey,
              },
            });
          }
        }
      }
    }
  });

  cron.schedule("0 * * * *", async () => {
    const users = await prisma.user.findMany({ include: { pets: { include: { pet: true } } } });
    for (const user of users) {
      const localNow = getLocalNow(user.timezone);
      if (localNow.day() !== 0 || localNow.hour() !== 19) {
        continue;
      }
      const weekRange = getWeekRangeByTimezone(user.timezone);
      const weeklyKey = `${localNow.format("GGGG-[W]WW")}`;
      for (const acc of user.pets) {
        if (acc.pet.isDeleted) continue;
        const hasWeight = await prisma.weightLog.findFirst({
          where: { petId: acc.pet.id, createdAt: { gte: weekRange.start, lte: weekRange.end } },
        });
        const alreadySent = await prisma.notificationLog.findUnique({
          where: {
            userId_type_key: {
              userId: user.id,
              type: NotificationType.WEIGHT_WEEKLY,
              key: `${weeklyKey}:${acc.pet.id}`,
            },
          },
        });
        if (!hasWeight && !alreadySent) {
          await bot.telegram.sendMessage(Number(user.telegramId), `Напоминание: взвесьте ${acc.pet.name}, чтобы отследить динамику веса ⚖️`);
          await prisma.notificationLog.create({
            data: {
              userId: user.id,
              petId: acc.pet.id,
              type: NotificationType.WEIGHT_WEEKLY,
              key: `${weeklyKey}:${acc.pet.id}`,
            },
          });
        }
      }
    }
  });
};
