"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bot_1 = require("./bot/bot");
const prisma_1 = require("./prisma");
const notifications_1 = require("./services/notifications");
const bootstrap = async () => {
    const bot = (0, bot_1.createBot)();
    (0, notifications_1.startNotifications)(bot);
    await bot.launch();
    console.log("Pet tracker bot is running");
    process.once("SIGINT", async () => {
        await prisma_1.prisma.$disconnect();
        bot.stop("SIGINT");
    });
    process.once("SIGTERM", async () => {
        await prisma_1.prisma.$disconnect();
        bot.stop("SIGTERM");
    });
};
bootstrap().catch(async (error) => {
    console.error(error);
    await prisma_1.prisma.$disconnect();
    process.exit(1);
});
