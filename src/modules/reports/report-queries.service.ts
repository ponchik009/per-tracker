import { prisma } from "../../prisma";

export const loadEventsReportData = async (
  petId: string,
  range: { start: Date; end: Date },
) => {
  const pet = await prisma.pet.findUnique({ where: { id: petId } });
  if (!pet) {
    return null;
  }
  const [weights, events, feedings] = await Promise.all([
    prisma.weightLog.findMany({
      where: { petId, createdAt: { gte: range.start, lte: range.end } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.petEvent.findMany({
      where: { petId, createdAt: { gte: range.start, lte: range.end } },
      include: { customEventType: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.feedingLog.findMany({
      where: { petId, createdAt: { gte: range.start, lte: range.end } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return { pet, weights, events, feedings };
};
