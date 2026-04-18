"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayEventSummary = exports.upsertCustomEventType = exports.createPetEvent = void 0;
const prisma_1 = require("../../prisma");
const date_1 = require("../../utils/date");
const createPetEvent = async (params) => {
    await prisma_1.prisma.petEvent.create({
        data: {
            petId: params.petId,
            kind: params.kind,
            comment: params.comment,
            customEventTypeId: params.customEventTypeId ?? null,
        },
    });
};
exports.createPetEvent = createPetEvent;
const upsertCustomEventType = async (petId, label, userId) => {
    return prisma_1.prisma.customEventType.upsert({
        where: { petId_label: { petId, label } },
        update: {},
        create: { petId, label, createdById: userId },
    });
};
exports.upsertCustomEventType = upsertCustomEventType;
const getTodayEventSummary = async (petId, timezone) => {
    const range = (0, date_1.getDayRangeByTimezone)(timezone);
    const [events, feedings] = await Promise.all([
        prisma_1.prisma.petEvent.findMany({
            where: { petId, createdAt: { gte: range.start, lte: range.end } },
            include: { customEventType: true },
            orderBy: { createdAt: "asc" },
        }),
        prisma_1.prisma.feedingLog.count({ where: { petId, createdAt: { gte: range.start, lte: range.end } } }),
    ]);
    return { events, feedings };
};
exports.getTodayEventSummary = getTodayEventSummary;
