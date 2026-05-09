import { Markup, Scenes } from "telegraf";

import { addPetAccessByCode } from "../../../modules/pets/pet.service";
import { getOrCreateUser } from "../../../modules/users/user.service";
import { replyHomeMenu } from "../../handlers/home.handler";

export const shareJoinWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "SHARE_JOIN",
  async (ctx) => {
    await ctx.reply("Или отправь мне код, чтобы подключиться к другому питомцу.", {
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "home" }]],
      },
    });
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!ctx.from || !ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Отправь код доступа текстом.");
      return;
    }

    const user = await getOrCreateUser({
      telegramId: BigInt(ctx.from.id),
      username: ctx.from.username ?? undefined,
      firstName: ctx.from.first_name ?? undefined,
    });

    const text = ctx.message.text.trim();
    if (text === "Пропустить") {
      await ctx.scene.leave();
      await replyHomeMenu(ctx);
      return;
    }

    const pet = await addPetAccessByCode(user.id, text);
    if (!pet || pet.isDeleted) {
      await ctx.reply("Код не найден.");
      return;
    }

    await ctx.reply(`Теперь ты тоже можешь вести ${pet.name} 🤝`, Markup.removeKeyboard());
    await ctx.scene.leave();
    await replyHomeMenu(ctx);
  },
);
