import { Markup, Scenes, Telegraf } from "telegraf";

import { listActivePetsByTelegramId } from "../../modules/pets/pet.service";
import { buildHomeInlineKeyboard } from "../ui/inline/main-menu.inline";

const homeText = (hasPets: boolean) =>
  hasPets ? "Выбери питомца из списка 👇" : "Питомцев пока нет. Добавим первого? 🐱";

export const sendHomeMenu = async (
  bot: Telegraf<any>,
  telegramId: bigint,
  chatId: number,
) => {
  const pets = await listActivePetsByTelegramId(telegramId);
  await bot.telegram.sendMessage(chatId, homeText(pets.length > 0), {
    reply_markup: { inline_keyboard: buildHomeInlineKeyboard(pets) },
  });
};

export const replyHomeMenu = async (ctx: Scenes.WizardContext) => {
  if (!ctx.from || !ctx.chat) {
    return;
  }

  const pets = await listActivePetsByTelegramId(BigInt(ctx.from.id));
  await ctx.reply(
    homeText(pets.length > 0),
    Markup.inlineKeyboard(buildHomeInlineKeyboard(pets)),
  );
};
