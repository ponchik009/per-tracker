import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  BOT_USERNAME: z.string().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DEFAULT_TIMEZONE: z.string().default("Europe/Moscow"),
  /** Если задан — сессии wizard/сцен в Redis (нужно для нескольких инстансов). Иначе память процесса. */
  REDIS_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined)),
  /** Префикс ключей сессии в Redis; различай окружения, если несколько ботов делят один Redis. */
  REDIS_SESSION_PREFIX: z.string().default("pet-tracker"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
