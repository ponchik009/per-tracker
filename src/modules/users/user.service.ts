import { User } from "@prisma/client";

import { config } from "../../config";
import { prisma } from "../../prisma";

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

export const getUserWithSession = async (telegramId: bigint) => {
  return prisma.user.findUnique({
    where: { telegramId },
    include: { sessions: true },
  });
};

export const getUserWithPets = async (telegramId: bigint) => {
  return prisma.user.findUnique({
    where: { telegramId },
    include: { pets: { include: { pet: true } }, sessions: true },
  });
};
