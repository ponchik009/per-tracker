import type { RedisOptions } from "ioredis";

/**
 * BullMQ документирует `maxRetriesPerRequest: null` для подключений воркеров (иначе возможны ошибки блокировки).
 */
export function bullmqConnectionFromRedisUrl(url: string): RedisOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 6379,
    password: u.password || undefined,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}
