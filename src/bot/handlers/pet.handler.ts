import dayjs from "dayjs";
import { Scenes } from "telegraf";

import { findPetWithFeedingScheduleForCard } from "../../modules/pets/pet.service";
import { formatMinutesToHHMM } from "../../utils/date";
import {
  petEditMenuInlineKeyboard,
  petMenuInlineKeyboard,
  petSectionsInlineKeyboard,
} from "../ui/inline/pet.inline";

export const replyPetMenu = async (ctx: Scenes.WizardContext, petId: string) => {
  await ctx.reply("Что делаем с питомцем?", {
    reply_markup: { inline_keyboard: petMenuInlineKeyboard(petId) },
  });
};

export const replyPetInfo = async (ctx: Scenes.WizardContext, petId: string) => {
  const pet = await findPetWithFeedingScheduleForCard(petId);
  if (!pet || pet.isDeleted) {
    await ctx.reply("Питомец не найден");
    return;
  }

  const schedule = pet.feedingConfig?.scheduleItems
    .map(
      (i) =>
        `${formatMinutesToHHMM(i.minutesOfDay)} - ${i.amount} ${i.feedType === "WET" ? "пач." : "гр."} ${i.feedType === "WET" ? "влажного" : "сухого"}`,
    )
    .join("\n");

  await ctx.replyWithPhoto(pet.photoFileId, {
    caption: `🐱 ${pet.name}\nПорода: ${pet.breed}\nДата рождения: ${dayjs(pet.birthDate).format("DD.MM.YYYY")}\nВес: ${pet.currentWeightKg} кг\nПол: ${pet.sex === "FEMALE" ? "девочка" : "мальчик"}\nСтерилизована: ${pet.isSterilized ? "да" : "нет"}\n\nПитание:\n${
      pet.feedingConfig
        ? `Сухой корм: ${pet.feedingConfig.dryFoodDailyGrams ?? 0} гр/сутки\nВлажный корм: ${pet.feedingConfig.wetFoodDailyPacks ?? 0} пач/сутки\n${schedule ? `Расписание:\n${schedule}` : "Расписание не заполнено"}`
        : "Настройки питания пока не заполнены"
    }`,
  });
  await ctx.reply("Выбери раздел:", {
    reply_markup: { inline_keyboard: petSectionsInlineKeyboard(petId) },
  });
};

export const replyPetEditMenu = async (ctx: Scenes.WizardContext, petId: string) => {
  await ctx.reply("Что изменить?", {
    reply_markup: { inline_keyboard: petEditMenuInlineKeyboard(petId) },
  });
};
