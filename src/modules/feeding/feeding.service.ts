import { prisma } from "../../prisma";
import { getDayRangeByTimezone } from "../../utils/date";

export const updateDailyNorm = async (petId: string, dryFoodDailyGrams: number, wetFoodDailyPacks: number) => {
  await prisma.feedingConfig.upsert({
    where: { petId },
    update: { dryFoodDailyGrams, wetFoodDailyPacks },
    create: { petId, dryFoodDailyGrams, wetFoodDailyPacks },
  });
};

export const quickFeed = async (petId: string) => {
  await prisma.feedingLog.create({ data: { petId, note: "manual quick log" } });
  await prisma.petEvent.create({ data: { petId, kind: "FEEDING", comment: "Быстрое кормление" } });
};

export const getPendingScheduleItemsForToday = async (petId: string, timezone: string) => {
  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    include: { feedingConfig: { include: { scheduleItems: true } } },
  });
  if (!pet) return null;

  const schedule = pet.feedingConfig?.scheduleItems ?? [];
  if (!schedule.length) {
    return { pet, pending: [] };
  }

  const dayRange = getDayRangeByTimezone(timezone);
  const trackedToday = await prisma.feedingLog.findMany({
    where: { petId, createdAt: { gte: dayRange.start, lte: dayRange.end }, feedingScheduleId: { not: null } },
  });
  const doneIds = new Set(trackedToday.map((x) => x.feedingScheduleId));
  const pending = schedule.filter((x) => !doneIds.has(x.id));
  return { pet, pending };
};

export const logScheduledFeeding = async (scheduleId: string) => {
  const schedule = await prisma.feedingSchedule.findUnique({ where: { id: scheduleId }, include: { feedingConfig: true } });
  if (!schedule) return null;

  await prisma.feedingLog.create({
    data: {
      petId: schedule.feedingConfig.petId,
      feedingScheduleId: schedule.id,
      amount: schedule.amount,
      feedType: schedule.feedType,
    },
  });
  await prisma.petEvent.create({
    data: {
      petId: schedule.feedingConfig.petId,
      kind: "FEEDING",
      comment: `${schedule.amount} ${schedule.feedType}`,
    },
  });
  return schedule;
};

export const getFeedingConfigWithSchedule = async (petId: string) => {
  return prisma.feedingConfig.findUnique({
    where: { petId },
    include: { scheduleItems: { orderBy: { minutesOfDay: "asc" } } },
  });
};

export const addScheduleItem = async (petId: string, minutesOfDay: number, feedType: "WET" | "DRY", amount: number) => {
  const config = await prisma.feedingConfig.upsert({
    where: { petId },
    update: {},
    create: { petId },
  });
  return prisma.feedingSchedule.create({
    data: {
      feedingConfigId: config.id,
      minutesOfDay,
      feedType,
      amount,
    },
  });
};

export const deleteScheduleItem = async (scheduleItemId: string) => {
  await prisma.feedingSchedule.delete({ where: { id: scheduleItemId } });
};
