import { prisma } from "../../prisma";

export const userHasPetAccess = async (userId: string, petId: string): Promise<boolean> => {
  const row = await prisma.petAccess.findFirst({
    where: {
      userId,
      petId,
      pet: { isDeleted: false },
    },
    select: { id: true },
  });
  return !!row;
};

export const getPetIdForFeedingScheduleId = async (
  scheduleId: string,
): Promise<string | null> => {
  const row = await prisma.feedingSchedule.findUnique({
    where: { id: scheduleId },
    select: { feedingConfig: { select: { petId: true } } },
  });
  return row?.feedingConfig.petId ?? null;
};
