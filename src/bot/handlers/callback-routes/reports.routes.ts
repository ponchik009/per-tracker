import { Input } from "telegraf";

import { petEventLabelsRu } from "../../../modules/events/event-labels";
import { loadEventsReportData } from "../../../modules/reports/report-queries.service";
import { listWeightLogsInRange } from "../../../modules/weight/weight.service";
import { buildEventsReport, buildWeightReport } from "../../../services/reports";
import { formatDateTimeByTimezone, getPastRangeByTimezone } from "../../../utils/date";
import { weightPeriodsInlineKeyboard } from "../../ui/inline/reports.inline";
import { PrefixCallbackRoute } from "./callback-route.types";
import { replyIfNoPetAccess } from "./pet-access.reply";

type Period = "week" | "month" | "year";

export const reportsPrefixRoutes: PrefixCallbackRoute[] = [
  {
    prefix: "weight_history:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.reply("Выбери период для отчета по весу:", {
        reply_markup: { inline_keyboard: weightPeriodsInlineKeyboard(petId) },
      });
    },
  },
  {
    prefix: "weight_report:",
    handle: async ({ ctx, user }, data) => {
      const [, petId, periodRaw] = data.split(":");
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      const period = periodRaw as Period;
      const range = getPastRangeByTimezone(user.timezone, period);
      const logs = await listWeightLogsInRange(petId, range);
      const report = buildWeightReport(
        logs.map((x) => ({
          date: formatDateTimeByTimezone(x.createdAt, user.timezone),
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
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.scene.enter("REPORT_CUSTOM_DATE", { petId, reportKind: "weight" });
    },
  },
  {
    prefix: "events_report:",
    handle: async ({ ctx, user }, data) => {
      const [, petId, periodRaw] = data.split(":");
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      const period = periodRaw as Period;
      const range = getPastRangeByTimezone(user.timezone, period);
      const bundle = await loadEventsReportData(petId, range);
      if (!bundle) {
        return;
      }
      const { pet, weights, events, feedings } = bundle;
      const periodLabel = `${formatDateTimeByTimezone(range.start, user.timezone)} — ${formatDateTimeByTimezone(range.end, user.timezone)}`;

      const report = buildEventsReport(
        pet.name,
        weights.map((x) => ({
          date: formatDateTimeByTimezone(x.createdAt, user.timezone),
          weightKg: x.weightKg,
        })),
        events.map((x) => ({
          date: formatDateTimeByTimezone(x.createdAt, user.timezone),
          type:
            x.kind === "CUSTOM"
              ? (x.customEventType?.label ?? "Другое")
              : petEventLabelsRu[x.kind],
          comment: x.comment ?? "",
        })),
        feedings.map((x) => ({
          date: formatDateTimeByTimezone(x.createdAt, user.timezone),
          type: "Кормление",
          comment: [x.feedType, x.amount, x.note].filter((v) => v !== null && v !== undefined && v !== "").join(" "),
        })),
        user.timezone,
        periodLabel,
      );
      await ctx.replyWithDocument(Input.fromBuffer(report, `events_${pet.name}_${period}.xlsx`));
    },
  },
];
