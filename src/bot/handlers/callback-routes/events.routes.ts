import dayjs from "dayjs";
import { PetEventKind } from "@prisma/client";

import { clearSession } from "../../../modules/sessions/session.service";
import { getTodayEventSummary } from "../../../modules/events/event.service";
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
      const today = await getTodayEventSummary(petId, user.timezone);
      const eventsText = today.events.length
        ? today.events
            .map((event) => {
              const label =
                event.kind === "CUSTOM"
                  ? (event.customEventType?.label ?? "Другое")
                  : eventLabels[event.kind];
              return `• ${dayjs(event.createdAt).format("HH:mm")} — ${label}${event.comment ? ` (${event.comment})` : ""}`;
            })
            .join("\n")
        : "Сегодня событий пока нет.";

      await ctx.reply(`Сводка за сегодня:\nКормления: ${today.feedings}\n${eventsText}`);
      await ctx.reply("Выбери событие или добавь новое:", {
        reply_markup: { inline_keyboard: eventsMenuInlineKeyboard(petId, defaultEvents) },
      });
    },
  },
  {
    prefix: "event_pick:",
    handle: async ({ ctx, user }, data) => {
      const [, petId, kind] = data.split(":");
      await clearSession(user.id);
      await ctx.scene.enter("EVENT_COMMENT", { petId, kind });
    },
  },
  {
    prefix: "event_new:",
    handle: async ({ ctx, user }, data) => {
      await clearSession(user.id);
      await ctx.scene.enter("EVENT_NEW", { petId: data.split(":")[1] });
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
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      await clearSession(user.id);
      await ctx.scene.enter("REPORT_CUSTOM_DATE", { petId, reportKind: "events" });
    },
  },
];
