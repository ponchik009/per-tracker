import type { PrismaClient } from "@prisma/client";

import { prisma } from "../../prisma";

type WeightLogRepo = Pick<PrismaClient, "weightLog">;

export const listRecentWeightLogsDescending = async (petId: string, take: number) => {
  return prisma.weightLog.findMany({
    where: { petId },
    orderBy: { createdAt: "desc" },
    take,
  });
};

export const listWeightLogsInRange = async (
  petId: string,
  range: { start: Date; end: Date },
) => {
  return prisma.weightLog.findMany({
    where: { petId, createdAt: { gte: range.start, lte: range.end } },
    orderBy: { createdAt: "asc" },
  });
};

export const recordWeightForPet = async (petId: string, weightKg: number) => {
  await prisma.pet.update({
    where: { id: petId },
    data: {
      currentWeightKg: weightKg,
      weightLogs: { create: { weightKg } },
    },
  });
};

export const listWeightLogsForPetsInRange = async (
  petIds: string[],
  range: { start: Date; end: Date },
  db: WeightLogRepo = prisma,
) => {
  if (!petIds.length) return [];
  return db.weightLog.findMany({
    where: { petId: { in: petIds }, createdAt: { gte: range.start, lte: range.end } },
    select: { petId: true },
  });
};
