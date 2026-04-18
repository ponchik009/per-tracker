import { Markup } from "telegraf";

export const BACK_TEXT = "⬅️ Назад";

export const backKeyboard = () => Markup.keyboard([[BACK_TEXT]]).resize();

export const sexKeyboard = () => Markup.keyboard([["Девочка", "Мальчик"], [BACK_TEXT]]).resize();

export const yesNoKeyboard = () => Markup.keyboard([["Да", "Нет"], [BACK_TEXT]]).resize();

export const skipKeyboard = () => Markup.keyboard([["Пропустить"]]).resize();
