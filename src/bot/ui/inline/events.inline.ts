import { PetEventKind } from "@prisma/client";

export const eventsMenuInlineKeyboard = (
  petId: string,
  events: Array<{ kind: PetEventKind; label: string }>,
  customEvents: Array<{ id: string; label: string }> = [],
) => [
  ...events.map((item) => [
    { text: item.label, callback_data: `event_pick:${petId}:${item.kind}` },
  ]),
  ...customEvents.map((item) => [
    { text: `🧩 ${item.label}`, callback_data: `event_pick_custom:${petId}:${item.id}` },
  ]),
  [{ text: "➕ Добавить свое событие", callback_data: `event_new:${petId}` }],
  [{ text: "📤 Отчеты (XLSX)", callback_data: `events_report_menu:${petId}` }],
];
