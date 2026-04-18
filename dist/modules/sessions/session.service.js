"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearSession = exports.upsertSession = void 0;
const prisma_1 = require("../../prisma");
const upsertSession = async (userId, flow, step, payload = {}) => {
    return prisma_1.prisma.userSession.upsert({
        where: { userId },
        update: { flow: flow ?? undefined, step: step ?? undefined, payload },
        create: { userId, flow: flow ?? undefined, step: step ?? undefined, payload },
    });
};
exports.upsertSession = upsertSession;
const clearSession = async (userId) => {
    await prisma_1.prisma.userSession.upsert({
        where: { userId },
        update: { flow: null, step: null, payload: {} },
        create: { userId, flow: null, step: null, payload: {} },
    });
};
exports.clearSession = clearSession;
