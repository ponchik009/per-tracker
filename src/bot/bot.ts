import { Scenes, session, Telegraf } from "telegraf";

import { config } from "../config";
import {
  clearSession,
  upsertSession,
} from "../modules/sessions/session.service";
import {
  getUserWithPets,
  getUserWithSession,
  getOrCreateUser,
  isUserExists,
} from "../modules/users/user.service";
import {
  skipKeyboard,
} from "./ui/keyboards";
import { createPetWizard } from "./scenes/create-pet/create-pet.scene";
import { petEditWizard } from "./scenes/pet-edit/pet-edit.scene";
import { feedingEditWizard } from "./scenes/feeding/feeding-edit.scene";
import { feedingScheduleWizard } from "./scenes/feeding/feeding-schedule.scene";
import { shareJoinWizard } from "./scenes/share/share-join.scene";
import { weightUpdateWizard } from "./scenes/weight/weight-update.scene";
import { reportCustomDateWizard } from "./scenes/reports/report-custom-date.scene";
import { eventCommentWizard } from "./scenes/events/event-comment.scene";
import { eventNewWizard } from "./scenes/events/event-new.scene";
import { sendHomeMenu } from "./handlers/home.handler";
import { handleCallbackQuery } from "./handlers/callback-query.handler";
import { handleTextMessage } from "./handlers/text.handler";

export const createBot = () => {
  const bot = new Telegraf<Scenes.WizardContext>(config.TELEGRAM_BOT_TOKEN);

  bot.use(session());
  const stage = new Scenes.Stage([
    createPetWizard,
    petEditWizard,
    feedingEditWizard,
    feedingScheduleWizard,
    shareJoinWizard,
    weightUpdateWizard,
    reportCustomDateWizard,
    eventCommentWizard,
    eventNewWizard,
  ]);
  bot.use(stage.middleware());

  bot.start(async (ctx) => {
    if (!ctx.from) {
      return;
    }

    const tgId = BigInt(ctx.from.id);
    const userExists = await isUserExists(tgId);
    const user = await getOrCreateUser({
      telegramId: tgId,
      username: ctx.from.username ?? undefined,
      firstName: ctx.from.first_name ?? undefined,
    });

    if (!userExists) {
      await clearSession(user.id);
      await ctx.reply(
        "Привет! Я помогу отслеживать питание, туалет и другие события кошки 🐾",
      );
      await ctx.reply(
        "Если у тебя есть код для совместного доступа, отправь его сейчас. Или нажми «Пропустить».",
        skipKeyboard(),
      );
      await upsertSession(user.id, "onboarding", "ask_ref", {});
    } else {
      await sendHomeMenu(bot, tgId, ctx.chat.id);
    }
  });

  bot.on("text", async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }

    const user = await getUserWithSession(BigInt(ctx.from.id));
    if (!user) {
      return next();
    }

    const text = ctx.message.text.trim();
    const handled = await handleTextMessage(bot, ctx, user as any, text);
    if (handled) {
      return;
    }

    return next();
  });

  bot.on("callback_query", async (ctx) => {
    if (!ctx.from || !("data" in ctx.callbackQuery)) {
      return;
    }

    const data = ctx.callbackQuery.data;
    const user = await getUserWithPets(BigInt(ctx.from.id));
    if (!user) {
      return;
    }

    await ctx.answerCbQuery();

    await handleCallbackQuery(bot, ctx, user as any, data);
  });

  return bot;
};
