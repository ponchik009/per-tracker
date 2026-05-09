import { Input, Markup, Scenes } from "telegraf";

import { petEventLabelsRu } from "../../../modules/events/event-labels";
import { loadEventsReportData } from "../../../modules/reports/report-queries.service";
import { getUserTimezoneByTelegramId } from "../../../modules/users/user.service";
import { listWeightLogsInRange } from "../../../modules/weight/weight.service";
import { buildEventsReport, buildWeightReport } from "../../../services/reports";
import {
  formatDateTimeByTimezone,
  getDayRangeForDateInTimezone,
} from "../../../utils/date";
import { assertHasText } from "../../asserts/has-text.assert";
import { leaveWizardIfNoPetAccess } from "../../guards/scene-pet-access.guard";
import { ensureTextInput } from "../../guards/ensure-text-input.guard";
import { BACK_TEXT, backKeyboard } from "../../ui/reply/keyboards";

interface ReportCustomDateState {
  petId: string;
  reportKind: "weight" | "events";
}

export const reportCustomDateWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "REPORT_CUSTOM_DATE",
  async (ctx) => {
    const state = ctx.scene.state as Partial<ReportCustomDateState>;
    if (!state.petId || !state.reportKind) {
      await ctx.reply("Сессия отчета устарела.");
      await ctx.scene.leave();
      return;
    }
    if (!(await leaveWizardIfNoPetAccess(ctx, state.petId))) return;
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

    if (!(await leaveWizardIfNoPetAccess(ctx, state.petId))) return;

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

    const timezone = (await getUserTimezoneByTelegramId(BigInt(ctx.from.id))) ?? "UTC";
    const range = getDayRangeForDateInTimezone(text, timezone);
    if (!range) {
      await ctx.reply("Неверный формат даты. Пример: 15.05.2024");
      return;
    }

    const periodLabel = `${formatDateTimeByTimezone(range.start, timezone)} — ${formatDateTimeByTimezone(range.end, timezone)}`;

    if (state.reportKind === "weight") {
      const logs = await listWeightLogsInRange(state.petId, range);
      const report = buildWeightReport(
        logs.map((x) => ({
          date: formatDateTimeByTimezone(x.createdAt, timezone),
          weightKg: x.weightKg,
        })),
      );
      await ctx.replyWithDocument(Input.fromBuffer(report, "weight_custom_date.xlsx"));
    } else {
      const bundle = await loadEventsReportData(state.petId, range);
      if (!bundle) {
        await ctx.scene.leave();
        return;
      }
      const { pet, weights, events, feedings } = bundle;
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
              : petEventLabelsRu[x.kind],
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
