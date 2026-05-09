import { Redis } from "@telegraf/session/redis";
import { Scenes, session, type SessionStore } from "telegraf";

import { config } from "../config";

export const createBotSessionMiddleware = () => {
  const redisKeyPrefix = `${config.REDIS_SESSION_PREFIX.trim() || "pet-tracker"}:`;
  const store = config.REDIS_URL
    ? Redis({
        url: config.REDIS_URL,
        prefix: redisKeyPrefix,
      })
    : undefined;

  const mode = store ? `Redis (${redisKeyPrefix}*)` : "in-memory";
  console.log("[session]", mode);

  return session<Scenes.WizardSession, Scenes.WizardContext>({
    store: store as SessionStore<Scenes.WizardSession> | undefined,
  });
};
