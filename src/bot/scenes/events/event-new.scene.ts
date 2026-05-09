import { PetEventKind } from "@prisma/client";
import { Markup, Scenes } from "telegraf";

import { createPetEvent, upsertCustomEventType } from "../../../modules/events/event.service";
import { getOrCreateUser } from "../../../modules/users/user.service";
import { assertHasText } from "../../asserts/has-text.assert";
import { ensureTextInput } from "../../guards/ensure-text-input.guard";
import { petSectionsInlineKeyboard } from "../../ui/inline/pet.inline";

interface EventNewState {
  petId: string;
  customEventKindId?: string;
}

export const eventNewWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "EVENT_NEW",
  async (ctx) => {
    await ctx.reply("Напиши название нового события:");
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Напиши название события текстом."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<EventNewState>;

    if (!ctx.from || !state.petId) {
      await ctx.reply("Сессия добавления события устарела.");
      await ctx.scene.leave();
      return;
    }

    const user = await getOrCreateUser({
      telegramId: BigInt(ctx.from.id),
      username: ctx.from.username ?? undefined,
      firstName: ctx.from.first_name ?? undefined,
    });

    const customType = await upsertCustomEventType(
      state.petId,
      ctx.message.text.trim(),
      user.id,
    );
    (ctx.scene.state as EventNewState).customEventKindId = customType.id;

    await ctx.reply("Супер! Теперь напиши комментарий к событию.");
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Добавь комментарий к событию текстом."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<EventNewState>;
    if (!state.petId || !state.customEventKindId) {
      await ctx.reply("Сессия добавления события устарела.");
      await ctx.scene.leave();
      return;
    }

    await createPetEvent({
      petId: state.petId,
      kind: "CUSTOM" as PetEventKind,
      customEventTypeId: state.customEventKindId,
      comment: ctx.message.text.trim(),
    });

    await ctx.reply("Событие записано ✍️", Markup.removeKeyboard());
    await ctx.reply("Выбери раздел:", {
      reply_markup: { inline_keyboard: petSectionsInlineKeyboard(state.petId) },
    });
    await ctx.scene.leave();
  },
);
