import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  BOT_USERNAME: z.string().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DEFAULT_TIMEZONE: z.string().default("Europe/Moscow"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
