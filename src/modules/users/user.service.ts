import { User } from "@prisma/client";

import { config } from "../../config";
import { prisma } from "../../prisma";
import type { CallbackUser } from "../../types/callback-user";

export const getOrCreateUser = async (params: {
  telegramId: bigint;
  username?: string;
  firstName?: string;
}): Promise<User> => {
  return prisma.user.upsert({
    where: { telegramId: params.telegramId },
    update: {
      username: params.username ?? null,
      firstName: params.firstName ?? null,
    },
    create: {
      telegramId: params.telegramId,
      username: params.username ?? null,
      firstName: params.firstName ?? null,
      timezone: config.DEFAULT_TIMEZONE,
    },
  });
};

export const isUserExists = async (telegramId: bigint) =>
  prisma.user
    .count({ where: { telegramId } })
    .then((numberOfUsers) => numberOfUsers > 0);

export const getUserTimezoneByTelegramId = async (telegramId: bigint) => {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { timezone: true },
  });
  return user?.timezone ?? null;
};

export const getUserWithPets = async (
  telegramId: bigint,
): Promise<CallbackUser | null> => {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    include: { pets: { include: { pet: true } } },
  });
  return user as CallbackUser | null;
};
