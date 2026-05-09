import { Input } from "telegraf";
import dayjs from "dayjs";
import { PetEventKind } from "@prisma/client";

import { prisma } from "../../../prisma";
import { clearSession } from "../../../modules/sessions/session.service";
import { buildEventsReport, buildWeightReport } from "../../../services/reports";
import { weightPeriodsInlineKeyboard } from "../../ui/inline/reports.inline";
import { PrefixCallbackRoute } from "./callback-route.types";

type Period = "week" | "month" | "year";

const getRangeByPeriod = (period: Period) => {
  if (period === "week") {
    const from = dayjs().subtract(1, "week").toDate();
    return { start: from, end: new Date() };
  }
  if (period === "year") {
    const from = dayjs().subtract(1, "year").toDate();
    return { start: from, end: new Date() };
  }
  const from = dayjs().subtract(1, "month").toDate();
  return { start: from, end: new Date() };
};

const eventLabels: Record<PetEventKind, string> = {
  PEE: "Пописала",
  POO: "Покакала",
  PLAY: "Поиграла",
  SYMPTOM: "Симптом",
  CUSTOM: "Другое",
  FEEDING: "Кормление",
};

export const reportsPrefixRoutes: PrefixCallbackRoute[] = [
  {
    prefix: "weight_history:",
    handle: async ({ ctx }, data) => {
      const petId = data.split(":")[1];
      await ctx.reply("Выбери период для отчета по весу:", {
        reply_markup: { inline_keyboard: weightPeriodsInlineKeyboard(petId) },
      });
    },
  },
  {
    prefix: "weight_report:",
    handle: async ({ ctx }, data) => {
      const [, petId, periodRaw] = data.split(":");
      const period = periodRaw as Period;
      const range = getRangeByPeriod(period);
      const logs = await prisma.weightLog.findMany({
        where: { petId, createdAt: { gte: range.start, lte: range.end } },
        orderBy: { createdAt: "asc" },
      });
      const report = buildWeightReport(
        logs.map((x) => ({
          date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"),
          weightKg: x.weightKg,
        })),
      );
      await ctx.replyWithDocument(Input.fromBuffer(report, `weight_${period}.xlsx`));
    },
  },
  {
    prefix: "weight_report_custom:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      await clearSession(user.id);
      await ctx.scene.enter("REPORT_CUSTOM_DATE", { petId, reportKind: "weight" });
    },
  },
  {
    prefix: "events_report:",
    handle: async ({ ctx }, data) => {
      const [, petId, periodRaw] = data.split(":");
      const period = periodRaw as Period;
      const pet = await prisma.pet.findUnique({ where: { id: petId } });
      if (!pet) {
        return;
      }

      const range = getRangeByPeriod(period);
      const [weights, events, feedings] = await Promise.all([
        prisma.weightLog.findMany({
          where: { petId, createdAt: { gte: range.start, lte: range.end } },
          orderBy: { createdAt: "asc" },
        }),
        prisma.petEvent.findMany({
          where: { petId, createdAt: { gte: range.start, lte: range.end } },
          include: { customEventType: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.feedingLog.findMany({
          where: { petId, createdAt: { gte: range.start, lte: range.end } },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const report = buildEventsReport(
        pet.name,
        weights.map((x) => ({
          date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"),
          weightKg: x.weightKg,
        })),
        events.map((x) => ({
          date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"),
          type:
            x.kind === "CUSTOM"
              ? (x.customEventType?.label ?? "Другое")
              : eventLabels[x.kind],
          comment: x.comment ?? "",
        })),
        feedings.map((x) => ({
          date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"),
          type: "Кормление",
          comment: [x.feedType, x.amount].filter(Boolean).join(" "),
        })),
      );
      await ctx.replyWithDocument(Input.fromBuffer(report, `events_${pet.name}_${period}.xlsx`));
    },
  },
];
