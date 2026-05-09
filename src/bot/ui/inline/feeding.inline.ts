import { formatMinutesToHHMM } from "../../../utils/date";
import { bottomNavInlineKeyboard } from "./navigation.inline";

export const feedingMenuInlineKeyboard = (petId: string) => [
  [{ text: "✏️ Редактировать норму питания", callback_data: `nut_norm:${petId}` }],
  [{ text: "🕒 Редактировать расписание", callback_data: `nut_sch:${petId}` }],
  [{ text: "⬅️ Назад", callback_data: `pet_info:${petId}` }],
  ...bottomNavInlineKeyboard(petId),
];

export const feedingScheduleInlineKeyboard = (
  petId: string,
  scheduleItems: Array<{ id: string; minutesOfDay: number; amount: number; feedType: "WET" | "DRY" }>,
) => {
  const scheduleButtons = scheduleItems.map((item) => [
    {
      text: `🗑️ ${formatMinutesToHHMM(item.minutesOfDay)} • ${item.amount} ${item.feedType === "WET" ? "пач" : "гр"}`,
      callback_data: `nsd:${item.id}`,
    },
  ]);

  return [
    ...scheduleButtons,
    [{ text: "➕ Добавить слот", callback_data: `nut_sch_add:${petId}` }],
    [{ text: "⬅️ Назад", callback_data: `nut:${petId}` }],
    ...bottomNavInlineKeyboard(petId),
  ];
};

export const openScheduleInlineKeyboard = (petId: string) => [
  [{ text: "🕒 Открыть расписание", callback_data: `nut_sch:${petId}` }],
  ...bottomNavInlineKeyboard(petId),
];

export const quickFeedInlineKeyboard = (petId: string) => [
  [{ text: "🍽️ Перейти в питание", callback_data: `nut:${petId}` }],
  ...bottomNavInlineKeyboard(petId),
];
