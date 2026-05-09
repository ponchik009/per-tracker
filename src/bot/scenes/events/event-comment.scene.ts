import { PetEventKind } from "@prisma/client";
import { Markup, Scenes } from "telegraf";

import { createPetEvent } from "../../../modules/events/event.service";
import { assertHasText } from "../../asserts/has-text.assert";
import { ensureTextInput } from "../../guards/ensure-text-input.guard";
import { petSectionsInlineKeyboard } from "../../ui/inline/pet.inline";

interface EventCommentState {
  petId: string;
  kind: PetEventKind;
  customEventKindId?: string;
}

export const eventCommentWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "EVENT_COMMENT",
  async (ctx) => {
    await ctx.reply("Добавь комментарий к событию:");
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Добавь комментарий текстом."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<EventCommentState>;
    if (!state.petId || !state.kind) {
      await ctx.reply("Сессия добавления события устарела.");
      await ctx.scene.leave();
      return;
    }

    await createPetEvent({
      petId: state.petId,
      kind: state.kind,
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
