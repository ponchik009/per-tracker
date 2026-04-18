"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserWithPets = exports.getUserWithSession = exports.getOrCreateUser = void 0;
const config_1 = require("../../config");
const prisma_1 = require("../../prisma");
const getOrCreateUser = async (params) => {
    return prisma_1.prisma.user.upsert({
        where: { telegramId: params.telegramId },
        update: { username: params.username ?? null, firstName: params.firstName ?? null },
        create: {
            telegramId: params.telegramId,
            username: params.username ?? null,
            firstName: params.firstName ?? null,
            timezone: config_1.config.DEFAULT_TIMEZONE,
        },
    });
};
exports.getOrCreateUser = getOrCreateUser;
const getUserWithSession = async (telegramId) => {
    return prisma_1.prisma.user.findUnique({
        where: { telegramId },
        include: { sessions: true },
    });
};
exports.getUserWithSession = getUserWithSession;
const getUserWithPets = async (telegramId) => {
    return prisma_1.prisma.user.findUnique({
        where: { telegramId },
        include: { pets: { include: { pet: true } }, sessions: true },
    });
};
exports.getUserWithPets = getUserWithPets;
