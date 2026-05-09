import { Markup } from "telegraf";

export const skipInlineKeyboard = () =>
  Markup.inlineKeyboard([
    Markup.button.callback("Пропустить", "skip"),
  ]);
