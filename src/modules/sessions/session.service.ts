import { Prisma } from "@prisma/client";

import { prisma } from "../../prisma";

export type SessionPayload = Prisma.JsonObject;

export const upsertSession = async (
  userId: string,
  flow: string | null,
  step: string | null,
  payload: SessionPayload = {},
) => {
  return prisma.userSession.upsert({
    where: { userId },
    update: { flow: flow ?? undefined, step: step ?? undefined, payload },
    create: { userId, flow: flow ?? undefined, step: step ?? undefined, payload },
  });
};

export const clearSession = async (userId: string) => {
  await prisma.userSession.upsert({
    where: { userId },
    update: { flow: null, step: null, payload: {} },
    create: { userId, flow: null, step: null, payload: {} },
  });
};
