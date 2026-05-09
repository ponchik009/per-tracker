import { bottomNavInlineKeyboard } from "./navigation.inline";

export const weightActionsInlineKeyboard = (petId: string) => [
  [{ text: "✏️ Изменить вес", callback_data: `weight_edit:${petId}` }],
  [{ text: "📤 История (XLSX)", callback_data: `weight_history:${petId}` }],
  [{ text: "⬅️ Назад", callback_data: `pet_info:${petId}` }],
  ...bottomNavInlineKeyboard(petId),
];

export const weightPeriodsInlineKeyboard = (petId: string) => [
  [{ text: "За неделю", callback_data: `weight_report:${petId}:week` }],
  [{ text: "За месяц", callback_data: `weight_report:${petId}:month` }],
  [{ text: "За год", callback_data: `weight_report:${petId}:year` }],
  [{ text: "За произвольную дату", callback_data: `weight_report_custom:${petId}` }],
  ...bottomNavInlineKeyboard(petId),
];

export const eventsPeriodsInlineKeyboard = (petId: string) => [
  [{ text: "За неделю", callback_data: `events_report:${petId}:week` }],
  [{ text: "За месяц", callback_data: `events_report:${petId}:month` }],
  [{ text: "За год", callback_data: `events_report:${petId}:year` }],
  [{ text: "За произвольную дату", callback_data: `events_report_custom:${petId}` }],
  ...bottomNavInlineKeyboard(petId),
];
