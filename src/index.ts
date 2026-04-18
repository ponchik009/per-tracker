import { createBot } from "./bot/bot";
import { prisma } from "./prisma";
import { startNotifications } from "./services/notifications";

const bootstrap = async () => {
  const bot = createBot();

  startNotifications(bot);
  await bot.launch();
  console.log("Pet tracker bot is running");

  process.once("SIGINT", async () => {
    await prisma.$disconnect();
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", async () => {
    await prisma.$disconnect();
    bot.stop("SIGTERM");
  });
};

bootstrap().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
