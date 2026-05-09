import { Markup, Scenes } from "telegraf";

import { createPetFromDraft, listActivePetsByTelegramId } from "../../../modules/pets/pet.service";
import { getOrCreateUser } from "../../../modules/users/user.service";
import { parseDateDDMMYYYY, parseWeight } from "../../../utils/date";
import { assertHasText } from "../../asserts/has-text.assert";
import { BACK_TEXT, backKeyboard, sexKeyboard, yesNoKeyboard } from "../../ui/keyboards";

interface AddPetState {
  name?: string;
  breed?: string;
  birthDate?: string;
  weightKg?: number;
  sex?: "FEMALE" | "MALE";
  isSterilized?: boolean;
}

const sendHomeFromScene = async (ctx: Scenes.WizardContext) => {
  if (!ctx.from || !ctx.chat) {
    return;
  }

  const pets = await listActivePetsByTelegramId(BigInt(ctx.from.id));
  const buttons = pets.map((pet) => [
    { text: `🐾 ${pet.name}`, callback_data: `pet:${pet.id}` },
  ]);
  buttons.push([{ text: "➕ Добавить питомца", callback_data: "pet:add" }]);
  buttons.push([
    { text: "🤝 Поделиться информацией", callback_data: "share:open" },
  ]);

  await ctx.reply(
    pets.length ? "Выбери питомца из списка 👇" : "Питомцев пока нет. Добавим первого? 🐱",
    Markup.inlineKeyboard(buttons),
  );
};

export const createPetWizard = new Scenes.WizardScene<Scenes.WizardContext>(
  "CREATE_PET",

  async (ctx) => {
    await ctx.reply("Как зовут твою кошку? 😺", backKeyboard());
    return ctx.wizard.next();
  },

  async (ctx) => {
    assertHasText(ctx);
    const text = ctx.message.text.trim();

    if (text === BACK_TEXT) {
      await ctx.scene.leave();
      await sendHomeFromScene(ctx);
      return;
    }

    (ctx.scene.state as AddPetState).name = text;
    await ctx.reply(
      "Какая у неё порода? Можно написать в свободной форме.",
      Markup.keyboard([["Пропустить"], [BACK_TEXT]]).resize(),
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    assertHasText(ctx);
    const text = ctx.message.text.trim();

    if (text === BACK_TEXT) {
      await ctx.reply("Как зовут твою кошку? 😺", backKeyboard());
      return ctx.wizard.back();
    }

    (ctx.scene.state as AddPetState).breed = text === "Пропустить" ? "Не указана" : text;
    await ctx.reply("Дата рождения в формате ДД.ММ.ГГГГ 📅", backKeyboard());
    return ctx.wizard.next();
  },

  async (ctx) => {
    assertHasText(ctx);
    const text = ctx.message.text.trim();

    if (text === BACK_TEXT) {
      await ctx.reply(
        "Какая у неё порода? Можно написать в свободной форме.",
        Markup.keyboard([["Пропустить"], [BACK_TEXT]]).resize(),
      );
      return ctx.wizard.back();
    }

    const birthDate = parseDateDDMMYYYY(text);
    if (!birthDate) {
      await ctx.reply("Не получилось распознать дату. Пример: 15.05.2024");
      return;
    }

    (ctx.scene.state as AddPetState).birthDate = birthDate.toISOString();
    await ctx.reply("Какой вес питомца в кг? Например: 3,5", backKeyboard());
    return ctx.wizard.next();
  },

  async (ctx) => {
    assertHasText(ctx);
    const text = ctx.message.text.trim();

    if (text === BACK_TEXT) {
      await ctx.reply("Дата рождения в формате ДД.ММ.ГГГГ 📅", backKeyboard());
      return ctx.wizard.back();
    }

    const weight = parseWeight(text);
    if (!weight) {
      await ctx.reply("Вес не распознан. Напиши число, например 3.5");
      return;
    }

    (ctx.scene.state as AddPetState).weightKg = weight;
    await ctx.reply("Какой пол питомца?", sexKeyboard());
    return ctx.wizard.next();
  },

  async (ctx) => {
    assertHasText(ctx);
    const text = ctx.message.text.trim();

    if (text === BACK_TEXT) {
      await ctx.reply("Какой вес питомца в кг? Например: 3,5", backKeyboard());
      return ctx.wizard.back();
    }

    if (!["Девочка", "Мальчик"].includes(text)) {
      await ctx.reply("Выбери пол кнопкой.");
      return;
    }

    (ctx.scene.state as AddPetState).sex = text === "Девочка" ? "FEMALE" : "MALE";
    await ctx.reply("Стерилизована ли кошка?", yesNoKeyboard());
    return ctx.wizard.next();
  },

  async (ctx) => {
    assertHasText(ctx);
    const text = ctx.message.text.trim();

    if (text === BACK_TEXT) {
      await ctx.reply("Какой пол питомца?", sexKeyboard());
      return ctx.wizard.back();
    }

    if (!["Да", "Нет"].includes(text)) {
      await ctx.reply("Ответь кнопкой: Да или Нет.");
      return;
    }

    (ctx.scene.state as AddPetState).isSterilized = text === "Да";
    await ctx.reply("Отправь фото питомца 🖼️", backKeyboard());
    return ctx.wizard.next();
  },

  async (ctx) => {
    const message = ctx.message;
    if (!message) {
      return;
    }

    if ("text" in message) {
      if (message.text.trim() === BACK_TEXT) {
        await ctx.reply("Стерилизована ли кошка?", yesNoKeyboard());
        await ctx.wizard.back();
      } else {
        await ctx.reply("Отправь фото питомца 🖼️", backKeyboard());
      }
      return;
    }

    if (!("photo" in message)) {
      await ctx.reply("Отправь фото питомца 🖼️");
      return;
    }

    const photo = message.photo.at(-1);
    const draft = ctx.scene.state as AddPetState;

    if (
      !ctx.from ||
      !photo ||
      !draft.name ||
      !draft.breed ||
      !draft.birthDate ||
      !draft.weightKg ||
      !draft.sex ||
      draft.isSterilized === undefined
    ) {
      await ctx.reply("Не получилось завершить добавление. Давай начнем заново через /start");
      await ctx.scene.leave();
      return;
    }

    const user = await getOrCreateUser({
      telegramId: BigInt(ctx.from.id),
      username: ctx.from.username ?? undefined,
      firstName: ctx.from.first_name ?? undefined,
    });

    const pet = await createPetFromDraft(user.id, {
      name: draft.name,
      breed: draft.breed,
      birthDate: draft.birthDate,
      weightKg: draft.weightKg,
      sex: draft.sex,
      isSterilized: draft.isSterilized,
      photoFileId: photo.file_id,
    });

    await ctx.reply(`Питомец ${pet.name} успешно добавлен! 🎉`);
    await ctx.scene.leave();
    await sendHomeFromScene(ctx);
  },
);
