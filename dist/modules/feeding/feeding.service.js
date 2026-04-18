"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteScheduleItem = exports.addScheduleItem = exports.getFeedingConfigWithSchedule = exports.logScheduledFeeding = exports.getPendingScheduleItemsForToday = exports.quickFeed = exports.updateDailyNorm = void 0;
const prisma_1 = require("../../prisma");
const date_1 = require("../../utils/date");
const updateDailyNorm = async (petId, dryFoodDailyGrams, wetFoodDailyPacks) => {
    await prisma_1.prisma.feedingConfig.upsert({
        where: { petId },
        update: { dryFoodDailyGrams, wetFoodDailyPacks },
        create: { petId, dryFoodDailyGrams, wetFoodDailyPacks },
    });
};
exports.updateDailyNorm = updateDailyNorm;
const quickFeed = async (petId) => {
    await prisma_1.prisma.feedingLog.create({ data: { petId, note: "manual quick log" } });
    await prisma_1.prisma.petEvent.create({ data: { petId, kind: "FEEDING", comment: "Быстрое кормление" } });
};
exports.quickFeed = quickFeed;
const getPendingScheduleItemsForToday = async (petId, timezone) => {
    const pet = await prisma_1.prisma.pet.findUnique({
        where: { id: petId },
        include: { feedingConfig: { include: { scheduleItems: true } } },
    });
    if (!pet)
        return null;
    const schedule = pet.feedingConfig?.scheduleItems ?? [];
    if (!schedule.length) {
        return { pet, pending: [] };
    }
    const dayRange = (0, date_1.getDayRangeByTimezone)(timezone);
    const trackedToday = await prisma_1.prisma.feedingLog.findMany({
        where: { petId, createdAt: { gte: dayRange.start, lte: dayRange.end }, feedingScheduleId: { not: null } },
    });
    const doneIds = new Set(trackedToday.map((x) => x.feedingScheduleId));
    const pending = schedule.filter((x) => !doneIds.has(x.id));
    return { pet, pending };
};
exports.getPendingScheduleItemsForToday = getPendingScheduleItemsForToday;
const logScheduledFeeding = async (scheduleId) => {
    const schedule = await prisma_1.prisma.feedingSchedule.findUnique({ where: { id: scheduleId }, include: { feedingConfig: true } });
    if (!schedule)
        return null;
    await prisma_1.prisma.feedingLog.create({
        data: {
            petId: schedule.feedingConfig.petId,
            feedingScheduleId: schedule.id,
            amount: schedule.amount,
            feedType: schedule.feedType,
        },
    });
    await prisma_1.prisma.petEvent.create({
        data: {
            petId: schedule.feedingConfig.petId,
            kind: "FEEDING",
            comment: `${schedule.amount} ${schedule.feedType}`,
        },
    });
    return schedule;
};
exports.logScheduledFeeding = logScheduledFeeding;
const getFeedingConfigWithSchedule = async (petId) => {
    return prisma_1.prisma.feedingConfig.findUnique({
        where: { petId },
        include: { scheduleItems: { orderBy: { minutesOfDay: "asc" } } },
    });
};
exports.getFeedingConfigWithSchedule = getFeedingConfigWithSchedule;
const addScheduleItem = async (petId, minutesOfDay, feedType, amount) => {
    const config = await prisma_1.prisma.feedingConfig.upsert({
        where: { petId },
        update: {},
        create: { petId },
    });
    return prisma_1.prisma.feedingSchedule.create({
        data: {
            feedingConfigId: config.id,
            minutesOfDay,
            feedType,
            amount,
        },
    });
};
exports.addScheduleItem = addScheduleItem;
const deleteScheduleItem = async (scheduleItemId) => {
    await prisma_1.prisma.feedingSchedule.delete({ where: { id: scheduleItemId } });
};
exports.deleteScheduleItem = deleteScheduleItem;
