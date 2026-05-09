import { PetEventKind } from "@prisma/client";

import { getCustomEventTypes, getTodayEventSummary } from "../../../modules/events/event.service";
import { formatDateTimeByTimezone } from "../../../utils/date";
import { eventsMenuInlineKeyboard } from "../../ui/inline/events.inline";
import { eventsPeriodsInlineKeyboard } from "../../ui/inline/reports.inline";
import { PrefixCallbackRoute } from "./callback-route.types";

const eventLabels: Record<PetEventKind, string> = {
  PEE: "Пописала",
  POO: "Покакала",
  PLAY: "Поиграла",
  SYMPTOM: "Симптом",
  CUSTOM: "Другое",
  FEEDING: "Кормление",
};

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
                  : eventLabels[event.kind];
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
    handle: async ({ ctx }, data) => {
      const [, petId, kind] = data.split(":");
      await ctx.scene.enter("EVENT_COMMENT", { petId, kind });
    },
  },
  {
    prefix: "event_new:",
    handle: async ({ ctx }, data) => {
      await ctx.scene.enter("EVENT_NEW", { petId: data.split(":")[1] });
    },
  },
  {
    prefix: "event_pick_custom:",
    handle: async ({ ctx }, data) => {
      const [, petId, customEventKindId] = data.split(":");
      await ctx.scene.enter("EVENT_COMMENT", {
        petId,
        kind: "CUSTOM",
        customEventKindId,
      });
    },
  },
  {
    prefix: "events_report_menu:",
    handle: async ({ ctx }, data) => {
      const petId = data.split(":")[1];
      await ctx.reply("Выбери период для отчета по событиям:", {
        reply_markup: { inline_keyboard: eventsPeriodsInlineKeyboard(petId) },
      });
    },
  },
  {
    prefix: "events_report_custom:",
    handle: async ({ ctx }, data) => {
      const petId = data.split(":")[1];
      await ctx.scene.enter("REPORT_CUSTOM_DATE", { petId, reportKind: "events" });
    },
  },
];
