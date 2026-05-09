import { Scenes, Telegraf } from "telegraf";

import { addPetAccessByCode } from "../../modules/pets/pet.service";
import { clearSession } from "../../modules/sessions/session.service";
import { sendHomeMenu } from "./home.handler";

export const handleOnboardingRefText = async (
  bot: Telegraf<any>,
  ctx: Scenes.WizardContext,
  user: { id: string; telegramId: bigint },
  text: string,
) => {
  if (text !== "Пропустить") {
    const pet = await addPetAccessByCode(user.id, text);
    if (pet) {
      await ctx.reply("Готово! Подключил тебя к питомцу ✅");
      if (ctx.chat) {
        await sendHomeMenu(bot, user.telegramId, ctx.chat.id);
      }
      return;
    }

    await ctx.reply("Не нашел такой код. Можно продолжить без него.");
  }

  await clearSession(user.id);
  await ctx.scene.enter("CREATE_PET");
};
