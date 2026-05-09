import { Markup, Scenes } from "telegraf";

import { recordWeightForPet } from "../../../modules/weight/weight.service";
import { parseWeight } from "../../../utils/date";
import { leaveWizardIfNoPetAccess } from "../../guards/scene-pet-access.guard";
import { assertHasText } from "../../asserts/has-text.assert";
import { ensureTextInput } from "../../guards/ensure-text-input.guard";
import { openPetCardInlineKeyboard } from "../../ui/inline/pet.inline";
import { BACK_TEXT, backKeyboard } from "../../ui/reply/keyboards";

interface WeightUpdateState {
  petId: string;
}

export const weightUpdateWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "WEIGHT_UPDATE",
  async (ctx) => {
    const state = ctx.scene.state as Partial<WeightUpdateState>;
    if (!(await leaveWizardIfNoPetAccess(ctx, state.petId))) return;
    await ctx.reply("Укажи новый вес в кг", backKeyboard());
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Укажи вес текстом, например 3.6."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<WeightUpdateState>;
    const text = ctx.message.text.trim();

    if (!state.petId) {
      await ctx.reply("Сессия обновления веса устарела.");
      await ctx.scene.leave();
      return;
    }

    if (text === BACK_TEXT) {
      await ctx.reply("Обновление веса отменено.", Markup.removeKeyboard());
      await ctx.reply("Вернуться в карточку питомца?", {
        reply_markup: { inline_keyboard: openPetCardInlineKeyboard(state.petId) },
      });
      await ctx.scene.leave();
      return;
    }

    const weight = parseWeight(text);
    if (weight === null) {
      await ctx.reply("Не распознала вес. Пример: 3,6");
      return;
    }

    await recordWeightForPet(state.petId, weight);
    await ctx.reply("Вес обновлен ✅", Markup.removeKeyboard());
    await ctx.reply("Что дальше?", {
      reply_markup: { inline_keyboard: openPetCardInlineKeyboard(state.petId) },
    });
    await ctx.scene.leave();
  },
);
