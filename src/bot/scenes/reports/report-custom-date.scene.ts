import { Input, Markup, Scenes } from "telegraf";

import { prisma } from "../../../prisma";
import { buildEventsReport, buildWeightReport } from "../../../services/reports";
import {
  formatDateTimeByTimezone,
  getDayRangeForDateInTimezone,
} from "../../../utils/date";
import { assertHasText } from "../../asserts/has-text.assert";
import { ensureTextInput } from "../../guards/ensure-text-input.guard";
import { BACK_TEXT, backKeyboard } from "../../ui/reply/keyboards";

interface ReportCustomDateState {
  petId: string;
  reportKind: "weight" | "events";
}

const eventLabels = {
  PEE: "Пописала",
  POO: "Покакала",
  PLAY: "Поиграла",
  SYMPTOM: "Симптом",
  CUSTOM: "Другое",
  FEEDING: "Кормление",
} as const;

export const reportCustomDateWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "REPORT_CUSTOM_DATE",
  async (ctx) => {
    await ctx.reply("Введи дату в формате ДД.ММ.ГГГГ", backKeyboard());
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Введи дату текстом в формате ДД.ММ.ГГГГ."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<ReportCustomDateState>;
    const text = ctx.message.text.trim();

    if (!state.petId || !state.reportKind) {
      await ctx.reply("Сессия отчета устарела.");
      await ctx.scene.leave();
      return;
    }

    if (text === BACK_TEXT) {
      await ctx.reply("Построение отчета отменено.", Markup.removeKeyboard());
      await ctx.scene.leave();
      return;
    }

    if (!ctx.from) {
      await ctx.reply("Не удалось определить пользователя.");
      await ctx.scene.leave();
      return;
    }

    const currentUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
      select: { timezone: true },
    });
    const timezone = currentUser?.timezone ?? "UTC";
    const range = getDayRangeForDateInTimezone(text, timezone);
    if (!range) {
      await ctx.reply("Неверный формат даты. Пример: 15.05.2024");
      return;
    }

    const periodLabel = `${formatDateTimeByTimezone(range.start, timezone)} — ${formatDateTimeByTimezone(range.end, timezone)}`;

    if (state.reportKind === "weight") {
      const logs = await prisma.weightLog.findMany({
        where: { petId: state.petId, createdAt: { gte: range.start, lte: range.end } },
        orderBy: { createdAt: "asc" },
      });
      const report = buildWeightReport(
        logs.map((x) => ({
          date: formatDateTimeByTimezone(x.createdAt, timezone),
          weightKg: x.weightKg,
        })),
      );
      await ctx.replyWithDocument(Input.fromBuffer(report, "weight_custom_date.xlsx"));
    } else {
      const pet = await prisma.pet.findUnique({ where: { id: state.petId } });
      if (!pet) {
        await ctx.scene.leave();
        return;
      }

      const [weights, events, feedings] = await Promise.all([
        prisma.weightLog.findMany({
          where: { petId: state.petId, createdAt: { gte: range.start, lte: range.end } },
          orderBy: { createdAt: "asc" },
        }),
        prisma.petEvent.findMany({
          where: { petId: state.petId, createdAt: { gte: range.start, lte: range.end } },
          include: { customEventType: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.feedingLog.findMany({
          where: { petId: state.petId, createdAt: { gte: range.start, lte: range.end } },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const report = buildEventsReport(
        pet.name,
        weights.map((x) => ({
          date: formatDateTimeByTimezone(x.createdAt, timezone),
          weightKg: x.weightKg,
        })),
        events.map((x) => ({
          date: formatDateTimeByTimezone(x.createdAt, timezone),
          type:
            x.kind === "CUSTOM"
              ? (x.customEventType?.label ?? "Другое")
              : eventLabels[x.kind],
          comment: x.comment ?? "",
        })),
        feedings.map((x) => ({
          date: formatDateTimeByTimezone(x.createdAt, timezone),
          type: "Кормление",
          comment: [x.feedType, x.amount, x.note].filter((v) => v !== null && v !== undefined && v !== "").join(" "),
        })),
        timezone,
        periodLabel,
      );
      await ctx.replyWithDocument(
        Input.fromBuffer(report, `events_${pet.name}_custom_date.xlsx`),
      );
    }

    await ctx.reply("Отчет готов ✅", Markup.removeKeyboard());
    await ctx.scene.leave();
  },
);
