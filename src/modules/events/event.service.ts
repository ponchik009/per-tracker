import { PetEventKind } from "@prisma/client";
import { prisma } from "../../prisma";
import { getDayRangeByTimezone } from "../../utils/date";

export const createPetEvent = async (params: {
  petId: string;
  kind: PetEventKind;
  comment: string;
  customEventTypeId?: string;
}) => {
  await prisma.petEvent.create({
    data: {
      petId: params.petId,
      kind: params.kind,
      comment: params.comment,
      customEventTypeId: params.customEventTypeId ?? null,
    },
  });
};

export const upsertCustomEventType = async (petId: string, label: string, userId: string) => {
  return prisma.customEventType.upsert({
    where: { petId_label: { petId, label } },
    update: {},
    create: { petId, label, createdById: userId },
  });
};

export const getTodayEventSummary = async (petId: string, timezone: string) => {
  const range = getDayRangeByTimezone(timezone);
  const [events, feedings] = await Promise.all([
    prisma.petEvent.findMany({
      where: { petId, createdAt: { gte: range.start, lte: range.end } },
      include: { customEventType: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.feedingLog.count({ where: { petId, createdAt: { gte: range.start, lte: range.end } } }),
  ]);
  return { events, feedings };
};
