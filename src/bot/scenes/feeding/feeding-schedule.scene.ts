import { Markup, Scenes } from "telegraf";

import { addScheduleItem } from "../../../modules/feeding/feeding.service";
import { leaveWizardIfNoPetAccess } from "../../guards/scene-pet-access.guard";
import { parseTimeHHMM, parseWeight } from "../../../utils/date";
import { assertHasText } from "../../asserts/has-text.assert";
import { ensureTextInput } from "../../guards/ensure-text-input.guard";
import { openScheduleInlineKeyboard } from "../../ui/inline/feeding.inline";
import { BACK_TEXT, backKeyboard } from "../../ui/reply/keyboards";

interface FeedingScheduleState {
  petId: string;
  minutesOfDay?: number;
  feedType?: "WET" | "DRY";
}

export const feedingScheduleWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "FEEDING_SCHEDULE_ADD",
  async (ctx) => {
    const state = ctx.scene.state as Partial<FeedingScheduleState>;
    if (!state.petId) {
      await ctx.reply("Не удалось открыть добавление слота расписания. Попробуй снова.");
      await ctx.scene.leave();
      return;
    }

    if (!(await leaveWizardIfNoPetAccess(ctx, state.petId))) return;

    await ctx.reply("Укажи время кормления в формате ЧЧ:ММ", backKeyboard());
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Укажи время в формате ЧЧ:ММ."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<FeedingScheduleState>;
    const text = ctx.message.text.trim();

    if (!state.petId) {
      await ctx.reply("Сессия добавления слота устарела.");
      await ctx.scene.leave();
      return;
    }

    if (text === BACK_TEXT) {
      await ctx.reply("Добавление слота отменено.", Markup.removeKeyboard());
      await ctx.reply("Открыть расписание?", {
        reply_markup: { inline_keyboard: openScheduleInlineKeyboard(state.petId) },
      });
      await ctx.scene.leave();
      return;
    }

    const minutes = parseTimeHHMM(text);
    if (minutes === null) {
      await ctx.reply("Неверный формат времени. Пример: 08:30");
      return;
    }

    (ctx.scene.state as FeedingScheduleState).minutesOfDay = minutes;
    await ctx.reply("Тип корма?", Markup.keyboard([["Влажный", "Сухой"], [BACK_TEXT]]).resize());
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Выбери тип корма текстом."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<FeedingScheduleState>;
    const text = ctx.message.text.trim();

    if (!state.petId) {
      await ctx.reply("Сессия добавления слота устарела.");
      await ctx.scene.leave();
      return;
    }

    if (text === BACK_TEXT) {
      await ctx.reply("Укажи время кормления в формате ЧЧ:ММ", backKeyboard());
      return ctx.wizard.back();
    }

    if (!["Влажный", "Сухой"].includes(text)) {
      await ctx.reply("Выбери тип кнопкой: Влажный или Сухой");
      return;
    }

    (ctx.scene.state as FeedingScheduleState).feedType = text === "Влажный" ? "WET" : "DRY";
    await ctx.reply(
      text === "Влажный"
        ? "Укажи количество пачек (можно дробное, например 0,5)"
        : "Укажи количество граммов",
      backKeyboard(),
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Укажи количество корма текстом."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<FeedingScheduleState>;
    const text = ctx.message.text.trim();

    if (!state.petId) {
      await ctx.reply("Сессия добавления слота устарела.");
      await ctx.scene.leave();
      return;
    }

    if (text === BACK_TEXT) {
      await ctx.reply("Тип корма?", Markup.keyboard([["Влажный", "Сухой"], [BACK_TEXT]]).resize());
      return ctx.wizard.back();
    }

    const amount = parseWeight(text);
    if (
      amount === null ||
      state.minutesOfDay === undefined ||
      !state.feedType
    ) {
      await ctx.reply("Проверь данные и попробуй снова.");
      return;
    }

    await addScheduleItem(state.petId, state.minutesOfDay, state.feedType, amount);
    await ctx.reply("Слот расписания добавлен ✅", Markup.removeKeyboard());
    await ctx.reply("Открыть расписание?", {
      reply_markup: { inline_keyboard: openScheduleInlineKeyboard(state.petId) },
    });
    await ctx.scene.leave();
  },
);
