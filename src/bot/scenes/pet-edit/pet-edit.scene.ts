import { Markup, Scenes } from "telegraf";

import {
  updatePetBirthDate,
  updatePetBreed,
  updatePetName,
  updatePetSex,
  updatePetSterilization,
} from "../../../modules/pets/pet.service";
import { parseDateDDMMYYYY } from "../../../utils/date";
import { assertHasText } from "../../asserts/has-text.assert";
import { ensureTextInput } from "../../guards/ensure-text-input.guard";
import { openPetCardInlineKeyboard } from "../../ui/inline/pet.inline";
import { BACK_TEXT, backKeyboard, sexKeyboard, yesNoKeyboard } from "../../ui/reply/keyboards";

type EditField = "name" | "breed" | "birth_date" | "sex" | "sterilized";

interface PetEditState {
  petId: string;
  field: EditField;
}

const getPrompt = (field: EditField) => {
  if (field === "sex") {
    return { text: "Выбери пол:", keyboard: sexKeyboard() };
  }
  if (field === "sterilized") {
    return { text: "Стерилизован ли питомец?", keyboard: yesNoKeyboard() };
  }
  if (field === "birth_date") {
    return { text: "Введи дату в формате ДД.ММ.ГГГГ", keyboard: backKeyboard() };
  }
  if (field === "breed") {
    return { text: "Введи новую породу", keyboard: backKeyboard() };
  }
  return { text: "Введи новую кличку", keyboard: backKeyboard() };
};

export const petEditWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "PET_EDIT",
  async (ctx) => {
    const state = ctx.scene.state as Partial<PetEditState>;
    if (!state.petId || !state.field) {
      await ctx.reply("Не удалось открыть редактирование. Попробуй снова из карточки питомца.");
      await ctx.scene.leave();
      return;
    }

    const prompt = getPrompt(state.field);
    await ctx.reply(prompt.text, prompt.keyboard);
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (!(await ensureTextInput(ctx, "Введи значение текстом."))) {
      return;
    }
    assertHasText(ctx);
    const state = ctx.scene.state as Partial<PetEditState>;
    const petId = state.petId;
    const field = state.field;
    const text = ctx.message.text.trim();

    if (!petId || !field) {
      await ctx.reply("Сессия редактирования устарела. Открой карточку питомца заново.");
      await ctx.scene.leave();
      return;
    }

    if (text === BACK_TEXT) {
      await ctx.reply("Редактирование отменено.", Markup.removeKeyboard());
      await ctx.reply("Вернуться в карточку питомца?", {
        reply_markup: { inline_keyboard: openPetCardInlineKeyboard(petId) },
      });
      await ctx.scene.leave();
      return;
    }

    if (field === "name") {
      await updatePetName(petId, text);
    } else if (field === "breed") {
      await updatePetBreed(petId, text);
    } else if (field === "birth_date") {
      const date = parseDateDDMMYYYY(text);
      if (!date) {
        await ctx.reply("Неверный формат даты. Пример: 15.05.2024");
        return;
      }
      await updatePetBirthDate(petId, date);
    } else if (field === "sex") {
      if (!["Девочка", "Мальчик"].includes(text)) {
        await ctx.reply("Выбери пол кнопкой");
        return;
      }
      await updatePetSex(petId, text === "Девочка" ? "FEMALE" : "MALE");
    } else {
      if (!["Да", "Нет"].includes(text)) {
        await ctx.reply("Выбери Да или Нет");
        return;
      }
      await updatePetSterilization(petId, text === "Да");
    }

    await ctx.reply("Информация обновлена ✅", Markup.removeKeyboard());
    await ctx.reply("Открой карточку питомца для просмотра изменений.", {
      reply_markup: { inline_keyboard: openPetCardInlineKeyboard(petId) },
    });
    await ctx.scene.leave();
  },
);
