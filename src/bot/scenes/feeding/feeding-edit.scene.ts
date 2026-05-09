import { Markup, Scenes } from "telegraf";

import { updateDailyNorm } from "../../../modules/feeding/feeding.service";
import { parseWeight } from "../../../utils/date";
import { assertHasText } from "../../asserts/has-text.assert";
import { ensureTextInput } from "../../guards/ensure-text-input.guard";
import { feedingMenuInlineKeyboard } from "../../ui/inline/feeding.inline";
import { BACK_TEXT, backKeyboard } from "../../ui/keyboards";

interface FeedingEditState {
  petId: string;
  dryFood?: number;
}

export const feedingEditWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "FEEDING_EDIT",
  async (ctx) => {
    const state = ctx.scene.state as Partial<FeedingEditState>;
    if (!state.petId) {
      await ctx.reply("Не удалось открыть редактирование питания. Попробуй снова.");
      await ctx.scene.leave();
      return;
    }

    await ctx.reply("Суточная норма сухого корма в граммах?", backKeyboard());
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Укажи норму сухого корма текстом."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<FeedingEditState>;
    const text = ctx.message.text.trim();

    if (!state.petId) {
      await ctx.reply("Сессия редактирования устарела.");
      await ctx.scene.leave();
      return;
    }

    if (text === BACK_TEXT) {
      await ctx.reply("Раздел питания:", Markup.removeKeyboard());
      await ctx.reply("Выбери действие:", {
        reply_markup: { inline_keyboard: feedingMenuInlineKeyboard(state.petId) },
      });
      await ctx.scene.leave();
      return;
    }

    const dry = parseWeight(text);
    if (dry === null) {
      await ctx.reply("Укажи число, например 20");
      return;
    }

    (ctx.scene.state as FeedingEditState).dryFood = dry;
    await ctx.reply("Суточная норма влажного корма в пачках?", backKeyboard());
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Укажи норму влажного корма текстом."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<FeedingEditState>;
    const text = ctx.message.text.trim();

    if (!state.petId) {
      await ctx.reply("Сессия редактирования устарела.");
      await ctx.scene.leave();
      return;
    }

    if (text === BACK_TEXT) {
      await ctx.reply("Суточная норма сухого корма в граммах?", backKeyboard());
      return ctx.wizard.back();
    }

    const wet = parseWeight(text);
    if (wet === null || state.dryFood === undefined) {
      await ctx.reply("Укажи число, например 1 или 0,5");
      return;
    }

    await updateDailyNorm(state.petId, state.dryFood, wet);
    await ctx.reply("Нормы питания обновлены ✅", Markup.removeKeyboard());
    await ctx.reply("Раздел питания:", {
      reply_markup: { inline_keyboard: feedingMenuInlineKeyboard(state.petId) },
    });
    await ctx.scene.leave();
  },
);
