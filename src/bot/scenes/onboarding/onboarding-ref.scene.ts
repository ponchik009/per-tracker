import { Scenes } from "telegraf";

import { addPetAccessByCode } from "../../../modules/pets/pet.service";
import { getOrCreateUser } from "../../../modules/users/user.service";
import { ensureTextInput } from "../../guards/ensure-text-input.guard";
import { replyHomeMenu } from "../../handlers/home.handler";
import { skipKeyboard } from "../../ui/reply/keyboards";

export const onboardingRefWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "ONBOARDING_REF",
  async (ctx) => {
    await ctx.reply(
      "Привет! Я помогу отслеживать питание, туалет и другие события кошки 🐾",
    );
    await ctx.reply(
      "Если у тебя есть код для совместного доступа, отправь его сейчас. Или нажми «Пропустить».",
      skipKeyboard(),
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (
      !(await ensureTextInput(
        ctx,
        "Отправь код текстом или нажми «Пропустить».",
      ))
    ) {
      return;
    }

    if (!ctx.from || !ctx.message || !("text" in ctx.message)) {
      return;
    }

    const user = await getOrCreateUser({
      telegramId: BigInt(ctx.from.id),
      username: ctx.from.username ?? undefined,
      firstName: ctx.from.first_name ?? undefined,
    });

    const text = ctx.message.text.trim();
    if (text !== "Пропустить") {
      const pet = await addPetAccessByCode(user.id, text);
      if (pet) {
        await ctx.reply("Готово! Подключил тебя к питомцу ✅");
        await ctx.scene.leave();
        await replyHomeMenu(ctx);
        return;
      }

      await ctx.reply("Не нашел такой код. Можно продолжить без него.");
    }

    await ctx.scene.leave();
    await ctx.scene.enter("CREATE_PET");
  },
);
