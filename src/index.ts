import { createBot } from "./bot/bot";
import { prisma } from "./prisma";
import { startNotifications, stopNotificationScheduler } from "./services/notifications";

const bootstrap = async () => {
  const bot = createBot();

  await startNotifications(bot);
  await bot.launch();
  console.log("Pet tracker bot is running");

  const shutdown = async (signal: "SIGINT" | "SIGTERM") => {
    await stopNotificationScheduler();
    await prisma.$disconnect();
    bot.stop(signal);
  };

  process.once("SIGINT", async () => {
    await shutdown("SIGINT");
  });
  process.once("SIGTERM", async () => {
    await shutdown("SIGTERM");
  });
};

bootstrap().catch(async (error) => {
  console.error(error);
  await stopNotificationScheduler();
  await prisma.$disconnect();
  process.exit(1);
});
