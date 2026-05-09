import { PetEventKind } from "@prisma/client";

import {
  getCustomEventTypeById,
  getCustomEventTypes,
  getTodayEventSummary,
} from "../../../modules/events/event.service";
import { petEventLabelsRu } from "../../../modules/events/event-labels";
import { formatDateTimeByTimezone } from "../../../utils/date";
import { eventsMenuInlineKeyboard } from "../../ui/inline/events.inline";
import { eventsPeriodsInlineKeyboard } from "../../ui/inline/reports.inline";
import { PrefixCallbackRoute } from "./callback-route.types";
import { replyIfNoPetAccess } from "./pet-access.reply";

const defaultEvents: { kind: PetEventKind; label: string }[] = [
  { kind: "PEE", label: "Пописала" },
  { kind: "POO", label: "Покакала" },
  { kind: "PLAY", label: "Игра" },
  { kind: "SYMPTOM", label: "Симптом" },
];

export const eventsPrefixRoutes: PrefixCallbackRoute[] = [
  {
    prefix: "events:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      const [today, customEvents] = await Promise.all([
        getTodayEventSummary(petId, user.timezone),
        getCustomEventTypes(petId),
      ]);
      const eventsText = today.events.length
        ? today.events
            .map((event) => {
              const label =
                event.kind === "CUSTOM"
                  ? (event.customEventType?.label ?? "Другое")
                  : petEventLabelsRu[event.kind];
              return `• ${formatDateTimeByTimezone(event.createdAt, user.timezone, "HH:mm")} — ${label}${event.comment ? ` (${event.comment})` : ""}`;
            })
            .join("\n")
        : "Сегодня событий пока нет.";

      await ctx.reply(`Сводка за сегодня:\nКормления: ${today.feedings}\n${eventsText}`);
      await ctx.reply("Выбери событие или добавь новое:", {
        reply_markup: {
          inline_keyboard: eventsMenuInlineKeyboard(
            petId,
            defaultEvents,
            customEvents.map((x) => ({ id: x.id, label: x.label })),
          ),
        },
      });
    },
  },
  {
    prefix: "event_pick:",
    handle: async ({ ctx, user }, data) => {
      const [, petId, kind] = data.split(":");
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.scene.enter("EVENT_COMMENT", { petId, kind });
    },
  },
  {
    prefix: "event_new:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.scene.enter("EVENT_NEW", { petId });
    },
  },
  {
    prefix: "epc:",
    handle: async ({ ctx, user }, data) => {
      const customEventKindId = data.split(":")[1];
      const customType = await getCustomEventTypeById(customEventKindId);
      if (!customType) {
        await ctx.reply("Не удалось найти тип события. Попробуй снова.");
        return;
      }
      if (!(await replyIfNoPetAccess(ctx, user, customType.petId))) {
        return;
      }
      await ctx.scene.enter("EVENT_COMMENT", {
        petId: customType.petId,
        kind: "CUSTOM",
        customEventKindId: customType.id,
      });
    },
  },
  {
    prefix: "events_report_menu:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.reply("Выбери период для отчета по событиям:", {
        reply_markup: { inline_keyboard: eventsPeriodsInlineKeyboard(petId) },
      });
    },
  },
  {
    prefix: "events_report_custom:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.scene.enter("REPORT_CUSTOM_DATE", { petId, reportKind: "events" });
    },
  },
];
