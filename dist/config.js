"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    TELEGRAM_BOT_TOKEN: zod_1.z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
    BOT_USERNAME: zod_1.z.string().optional(),
    DATABASE_URL: zod_1.z.string().min(1, "DATABASE_URL is required"),
    DEFAULT_TIMEZONE: zod_1.z.string().default("Europe/Moscow"),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.config = parsed.data;
