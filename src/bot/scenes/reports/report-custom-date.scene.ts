import { Input, Markup, Scenes } from "telegraf";
import dayjs from "dayjs";

import { prisma } from "../../../prisma";
import { buildEventsReport, buildWeightReport } from "../../../services/reports";
import { parseDateDDMMYYYY } from "../../../utils/date";
import { assertHasText } from "../../asserts/has-text.assert";
import { ensureTextInput } from "../../guards/ensure-text-input.guard";
import { BACK_TEXT, backKeyboard } from "../../ui/keyboards";

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

    const date = parseDateDDMMYYYY(text);
    if (!date) {
      await ctx.reply("Неверный формат даты. Пример: 15.05.2024");
      return;
    }

    const start = dayjs(date).startOf("day").toDate();
    const end = dayjs(date).endOf("day").toDate();

    if (state.reportKind === "weight") {
      const logs = await prisma.weightLog.findMany({
        where: { petId: state.petId, createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: "asc" },
      });
      const report = buildWeightReport(
        logs.map((x) => ({
          date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"),
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
          where: { petId: state.petId, createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: "asc" },
        }),
        prisma.petEvent.findMany({
          where: { petId: state.petId, createdAt: { gte: start, lte: end } },
          include: { customEventType: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.feedingLog.findMany({
          where: { petId: state.petId, createdAt: { gte: start, lte: end } },
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
      await ctx.replyWithDocument(
        Input.fromBuffer(report, `events_${pet.name}_custom_date.xlsx`),
      );
    }

    await ctx.reply("Отчет готов ✅", Markup.removeKeyboard());
    await ctx.scene.leave();
  },
);
