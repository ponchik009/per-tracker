import { Input, Telegraf } from "telegraf";
import { PetEventKind, Prisma } from "@prisma/client";
import dayjs from "dayjs";

import { config } from "../config";
import { prisma } from "../prisma";
import { createPetEvent, getTodayEventSummary, upsertCustomEventType } from "../modules/events/event.service";
import {
  addScheduleItem,
  deleteScheduleItem,
  getFeedingConfigWithSchedule,
  getPendingScheduleItemsForToday,
  logScheduledFeeding,
  quickFeed,
  updateDailyNorm,
} from "../modules/feeding/feeding.service";
import {
  addPetAccessByCode,
  createPetFromDraft,
  listActivePetsByTelegramId,
  softDeletePet,
  updatePetBirthDate,
  updatePetBreed,
  updatePetName,
  updatePetSex,
  updatePetSterilization,
} from "../modules/pets/pet.service";
import { clearSession, upsertSession } from "../modules/sessions/session.service";
import { getUserWithPets, getUserWithSession, getOrCreateUser } from "../modules/users/user.service";
import { buildEventsReport, buildWeightReport } from "../services/reports";
import {
  BACK_TEXT,
  backKeyboard,
  sexKeyboard,
  skipKeyboard,
  yesNoKeyboard,
} from "./ui/keyboards";
import {
  formatMinutesToHHMM,
  parseDateDDMMYYYY,
  parseTimeHHMM,
  parseWeight,
} from "../utils/date";

type SessionPayload = {
  petDraft?: {
    name?: string;
    breed?: string;
    birthDate?: string;
    weightKg?: number;
    sex?: "FEMALE" | "MALE";
    isSterilized?: boolean;
    photoFileId?: string;
  };
  selectedPetId?: string;
  sharedCode?: string;
  customEventKindId?: string;
  pendingEventKind?: PetEventKind;
  reportKind?: "weight" | "events";
  tempMinutesOfDay?: number;
  tempFeedType?: "WET" | "DRY";
  editField?: "name" | "breed" | "birth_date" | "sex" | "sterilized";
};

const toPayload = (value: Prisma.JsonValue | null | undefined): SessionPayload =>
  (value ?? {}) as SessionPayload;

const eventLabels: Record<PetEventKind, string> = {
  PEE: "Пописала",
  POO: "Покакала",
  PLAY: "Поиграла",
  SYMPTOM: "Симптом",
  CUSTOM: "Другое",
  FEEDING: "Кормление",
};

const defaultEvents: { kind: PetEventKind; label: string }[] = [
  { kind: "PEE", label: "Пописала" },
  { kind: "POO", label: "Покакала" },
  { kind: "PLAY", label: "Игра" },
  { kind: "SYMPTOM", label: "Симптом" },
];

export const createBot = () => {
  const getRangeByPeriod = (period: "week" | "month" | "year") => {
    if (period === "week") {
      const from = dayjs().subtract(1, "week").toDate();
      return { start: from, end: new Date() };
    }
    if (period === "year") {
      const from = dayjs().subtract(1, "year").toDate();
      return { start: from, end: new Date() };
    }
    const from = dayjs().subtract(1, "month").toDate();
    return { start: from, end: new Date() };
  };

  const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

  const sendHome = async (telegramId: bigint, chatId: number) => {
    const pets = await listActivePetsByTelegramId(telegramId);
    const buttons = pets.map((pet) => [{ text: `🐾 ${pet.name}`, callback_data: `pet:${pet.id}` }]);
    buttons.push([{ text: "➕ Добавить питомца", callback_data: "pet:add" }]);
    buttons.push([{ text: "🤝 Поделиться информацией", callback_data: "share:open" }]);
    await bot.telegram.sendMessage(
      chatId,
      pets.length ? "Выбери питомца из списка 👇" : "Питомцев пока нет. Добавим первого? 🐱",
      { reply_markup: { inline_keyboard: buttons } },
    );
  };

  bot.start(async (ctx) => {
    if (!ctx.from) {
      return;
    }
    const user = await getOrCreateUser({
      telegramId: BigInt(ctx.from.id),
      username: ctx.from.username ?? undefined,
      firstName: ctx.from.first_name ?? undefined,
    });
    await clearSession(user.id);
    await ctx.reply("Привет! Я помогу отслеживать питание, туалет и другие события кошки 🐾");
    await ctx.reply(
      "Если у тебя есть код для совместного доступа, отправь его сейчас. Или нажми «Пропустить».",
      skipKeyboard(),
    );
    await upsertSession(user.id, "onboarding", "ask_ref", {});
  });

  bot.on("text", async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }
    const user = await getUserWithSession(BigInt(ctx.from.id));
    if (!user) {
      return next();
    }
    const session = user.sessions[0];
    const text = ctx.message.text.trim();
    if (!session?.flow) {
      return next();
    }
    const payload = toPayload(session.payload);

    if (text === BACK_TEXT) {
      if (session.flow === "pet_create") {
        if (session.step === "breed") {
          await upsertSession(user.id, "pet_create", "name", payload as Prisma.JsonObject);
          await ctx.reply("Как зовут твою кошку? 😺", backKeyboard());
          return;
        }
        if (session.step === "birth_date") {
          await upsertSession(user.id, "pet_create", "breed", payload as Prisma.JsonObject);
          await ctx.reply("Какая у неё порода? Можно написать в свободной форме.", backKeyboard());
          return;
        }
        if (session.step === "weight") {
          await upsertSession(user.id, "pet_create", "birth_date", payload as Prisma.JsonObject);
          await ctx.reply("Дата рождения в формате ДД.ММ.ГГГГ 📅", backKeyboard());
          return;
        }
        if (session.step === "sex") {
          await upsertSession(user.id, "pet_create", "weight", payload as Prisma.JsonObject);
          await ctx.reply("Какой вес питомца в кг? Например: 3,5", backKeyboard());
          return;
        }
        if (session.step === "sterilized") {
          await upsertSession(user.id, "pet_create", "sex", payload as Prisma.JsonObject);
          await ctx.reply("Какой пол питомца?", sexKeyboard());
          return;
        }
        if (session.step === "photo") {
          await upsertSession(user.id, "pet_create", "sterilized", payload as Prisma.JsonObject);
          await ctx.reply("Стерилизована ли кошка?", yesNoKeyboard());
          return;
        }
      }

      if (session.flow === "feeding_edit") {
        if (session.step === "daily_wet") {
          await upsertSession(user.id, "feeding_edit", "daily_dry", payload as Prisma.JsonObject);
          await ctx.reply("Суточная норма сухого корма в граммах?", backKeyboard());
          return;
        }
      }

      if (session.flow === "feeding_schedule_add") {
        if (session.step === "feed_type") {
          await upsertSession(user.id, "feeding_schedule_add", "time", payload as Prisma.JsonObject);
          await ctx.reply("Укажи время кормления в формате ЧЧ:ММ", backKeyboard());
          return;
        }
        if (session.step === "amount") {
          await upsertSession(user.id, "feeding_schedule_add", "feed_type", payload as Prisma.JsonObject);
          await ctx.reply("Тип корма?", {
            reply_markup: { keyboard: [["Влажный", "Сухой"], [BACK_TEXT]], resize_keyboard: true },
          });
          return;
        }
      }

      if (session.flow === "pet_edit" && payload.selectedPetId) {
        await clearSession(user.id);
        await ctx.reply("Редактирование отменено.");
        await ctx.reply("Вернуться в карточку питомца?", {
          reply_markup: {
            inline_keyboard: [[{ text: "ℹ️ Открыть карточку", callback_data: `pet_info:${payload.selectedPetId}` }]],
          },
        });
        return;
      }

      await clearSession(user.id);
      if (ctx.chat) {
        await sendHome(BigInt(ctx.from.id), ctx.chat.id);
      }
      return;
    }

    if (session.flow === "onboarding" && session.step === "ask_ref") {
      if (text !== "Пропустить") {
        const pet = await addPetAccessByCode(user.id, text);
        if (pet) {
          await ctx.reply("Готово! Подключила тебя к питомцу ✅");
        } else {
          await ctx.reply("Не нашла такой код. Можно продолжить без него.");
        }
      }
      await upsertSession(user.id, "pet_create", "name", {});
      await ctx.reply("Как зовут твою кошку? 😺", backKeyboard());
      return;
    }

    if (session.flow === "pet_create") {
      if (session.step === "name") {
        payload.petDraft = { ...payload.petDraft, name: text };
        await upsertSession(user.id, "pet_create", "breed", payload as Prisma.JsonObject);
        await ctx.reply("Какая у неё порода? Можно написать в свободной форме.", {
          ...backKeyboard(),
        });
        return;
      }
      if (session.step === "breed") {
        payload.petDraft = { ...payload.petDraft, breed: text };
        await upsertSession(user.id, "pet_create", "birth_date", payload as Prisma.JsonObject);
        await ctx.reply("Дата рождения в формате ДД.ММ.ГГГГ 📅", backKeyboard());
        return;
      }
      if (session.step === "birth_date") {
        const date = parseDateDDMMYYYY(text);
        if (!date) {
          await ctx.reply("Не получилось распознать дату. Пример: 15.05.2024");
          return;
        }
        payload.petDraft = { ...payload.petDraft, birthDate: date.toISOString() };
        await upsertSession(user.id, "pet_create", "weight", payload as Prisma.JsonObject);
        await ctx.reply("Какой вес питомца в кг? Например: 3,5", backKeyboard());
        return;
      }
      if (session.step === "weight") {
        const weight = parseWeight(text);
        if (!weight) {
          await ctx.reply("Вес не распознан. Напиши число, например 3.5");
          return;
        }
        payload.petDraft = { ...payload.petDraft, weightKg: weight };
        await upsertSession(user.id, "pet_create", "sex", payload as Prisma.JsonObject);
        await ctx.reply("Какой пол питомца?", sexKeyboard());
        return;
      }
      if (session.step === "sex") {
        if (!["Девочка", "Мальчик"].includes(text)) {
          await ctx.reply("Выбери пол кнопкой.");
          return;
        }
        payload.petDraft = { ...payload.petDraft, sex: text === "Девочка" ? "FEMALE" : "MALE" };
        await upsertSession(user.id, "pet_create", "sterilized", payload as Prisma.JsonObject);
        await ctx.reply("Стерилизована ли кошка?", yesNoKeyboard());
        return;
      }
      if (session.step === "sterilized") {
        if (!["Да", "Нет"].includes(text)) {
          await ctx.reply("Ответь кнопкой: Да или Нет.");
          return;
        }
        payload.petDraft = { ...payload.petDraft, isSterilized: text === "Да" };
        await upsertSession(user.id, "pet_create", "photo", payload as Prisma.JsonObject);
        await ctx.reply("Отправь фото питомца 🖼️", backKeyboard());
        return;
      }
    }

    if (session.flow === "feeding_edit" && payload.selectedPetId) {
      if (session.step === "daily_dry") {
        const dry = parseWeight(text);
        if (dry === null) {
          await ctx.reply("Укажи число, например 20");
          return;
        }
        const data = { ...payload, dryFood: dry };
        await upsertSession(user.id, "feeding_edit", "daily_wet", data as Prisma.JsonObject);
        await ctx.reply("Суточная норма влажного корма в пачках?");
        return;
      }
      if (session.step === "daily_wet") {
        const wet = parseWeight(text);
        if (wet === null) {
          await ctx.reply("Укажи число, например 1 или 0,5");
          return;
        }
        const dry = Number((payload as SessionPayload & { dryFood?: number }).dryFood ?? 0);
        await updateDailyNorm(payload.selectedPetId, dry, wet);
        await clearSession(user.id);
        await ctx.reply("Нормы питания обновлены ✅");
        if (ctx.chat) {
          await sendHome(BigInt(ctx.from.id), ctx.chat.id);
        }
        return;
      }
    }

    if (session.flow === "feeding_schedule_add" && payload.selectedPetId) {
      if (session.step === "time") {
        const minutes = parseTimeHHMM(text);
        if (minutes === null) {
          await ctx.reply("Неверный формат времени. Пример: 08:30");
          return;
        }
        const nextPayload = { ...payload, tempMinutesOfDay: minutes };
        await upsertSession(user.id, "feeding_schedule_add", "feed_type", nextPayload as Prisma.JsonObject);
        await ctx.reply("Тип корма?", {
          reply_markup: { keyboard: [["Влажный", "Сухой"], [BACK_TEXT]], resize_keyboard: true },
        });
        return;
      }

      if (session.step === "feed_type") {
        if (!["Влажный", "Сухой"].includes(text)) {
          await ctx.reply("Выбери тип кнопкой: Влажный или Сухой");
          return;
        }
        const nextPayload = { ...payload, tempFeedType: text === "Влажный" ? "WET" : "DRY" };
        await upsertSession(user.id, "feeding_schedule_add", "amount", nextPayload as Prisma.JsonObject);
        await ctx.reply(
          text === "Влажный"
            ? "Укажи количество пачек (можно дробное, например 0,5)"
            : "Укажи количество граммов",
          backKeyboard(),
        );
        return;
      }

      if (session.step === "amount") {
        const amount = parseWeight(text);
        if (amount === null || payload.tempMinutesOfDay === undefined || !payload.tempFeedType) {
          await ctx.reply("Проверь данные и попробуй снова.");
          return;
        }
        await addScheduleItem(payload.selectedPetId, payload.tempMinutesOfDay, payload.tempFeedType, amount);
        await clearSession(user.id);
        await ctx.reply("Слот расписания добавлен ✅", {
          reply_markup: {
            inline_keyboard: [[{ text: "🕒 Открыть расписание", callback_data: `nutrition_schedule:${payload.selectedPetId}` }]],
          },
        });
        return;
      }
    }

    if (session.flow === "event_comment" && payload.selectedPetId && payload.pendingEventKind) {
      await createPetEvent({
        petId: payload.selectedPetId,
        kind: payload.pendingEventKind,
        customEventTypeId: payload.customEventKindId,
        comment: text,
      });
      await clearSession(user.id);
      await ctx.reply("Событие записано ✍️");
      return;
    }

    if (session.flow === "weight_update" && payload.selectedPetId) {
      const weight = parseWeight(text);
      if (weight === null) {
        await ctx.reply("Не распознала вес. Пример: 3,6");
        return;
      }
      await prisma.pet.update({
        where: { id: payload.selectedPetId },
        data: { currentWeightKg: weight, weightLogs: { create: { weightKg: weight } } },
      });
      await clearSession(user.id);
      await ctx.reply("Вес обновлен ✅");
      return;
    }

    if (session.flow === "share" && session.step === "join_code") {
      const pet = await addPetAccessByCode(user.id, text);
      if (!pet || pet.isDeleted) {
        await ctx.reply("Код не найден.");
        return;
      }
      await clearSession(user.id);
      await ctx.reply(`Теперь ты тоже можешь вести ${pet.name} 🤝`);
      if (ctx.chat) {
        await sendHome(BigInt(ctx.from.id), ctx.chat.id);
      }
      return;
    }

    if (session.flow === "pet_edit" && payload.selectedPetId && payload.editField) {
      if (payload.editField === "name") {
        await updatePetName(payload.selectedPetId, text);
      } else if (payload.editField === "breed") {
        await updatePetBreed(payload.selectedPetId, text);
      } else if (payload.editField === "birth_date") {
        const date = parseDateDDMMYYYY(text);
        if (!date) {
          await ctx.reply("Неверный формат даты. Пример: 15.05.2024");
          return;
        }
        await updatePetBirthDate(payload.selectedPetId, date);
      } else if (payload.editField === "sex") {
        if (!["Девочка", "Мальчик"].includes(text)) {
          await ctx.reply("Выбери пол кнопкой");
          return;
        }
        await updatePetSex(payload.selectedPetId, text === "Девочка" ? "FEMALE" : "MALE");
      } else if (payload.editField === "sterilized") {
        if (!["Да", "Нет"].includes(text)) {
          await ctx.reply("Выбери Да или Нет");
          return;
        }
        await updatePetSterilization(payload.selectedPetId, text === "Да");
      }

      await clearSession(user.id);
      await ctx.reply("Информация обновлена ✅");
      await ctx.reply("Открой карточку питомца для просмотра изменений.");
      return;
    }

    if (session.flow === "report_custom_date" && payload.selectedPetId && payload.reportKind) {
      const date = parseDateDDMMYYYY(text);
      if (!date) {
        await ctx.reply("Неверный формат даты. Пример: 15.05.2024");
        return;
      }
      const start = dayjs(date).startOf("day").toDate();
      const end = dayjs(date).endOf("day").toDate();
      if (payload.reportKind === "weight") {
        const logs = await prisma.weightLog.findMany({
          where: { petId: payload.selectedPetId, createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: "asc" },
        });
        const report = buildWeightReport(
          logs.map((x) => ({ date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"), weightKg: x.weightKg })),
        );
        await ctx.replyWithDocument(Input.fromBuffer(report, "weight_custom_date.xlsx"));
      } else {
        const pet = await prisma.pet.findUnique({ where: { id: payload.selectedPetId } });
        if (!pet) {
          await clearSession(user.id);
          return;
        }
        const [weights, events, feedings] = await Promise.all([
          prisma.weightLog.findMany({ where: { petId: payload.selectedPetId, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: "asc" } }),
          prisma.petEvent.findMany({ where: { petId: payload.selectedPetId, createdAt: { gte: start, lte: end } }, include: { customEventType: true }, orderBy: { createdAt: "asc" } }),
          prisma.feedingLog.findMany({ where: { petId: payload.selectedPetId, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: "asc" } }),
        ]);
        const report = buildEventsReport(
          pet.name,
          weights.map((x) => ({ date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"), weightKg: x.weightKg })),
          events.map((x) => ({
            date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"),
            type: x.kind === "CUSTOM" ? x.customEventType?.label ?? "Другое" : eventLabels[x.kind],
            comment: x.comment ?? "",
          })),
          feedings.map((x) => ({
            date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"),
            type: "Кормление",
            comment: [x.feedType, x.amount].filter(Boolean).join(" "),
          })),
        );
        await ctx.replyWithDocument(Input.fromBuffer(report, `events_${pet.name}_custom_date.xlsx`));
      }
      await clearSession(user.id);
      return;
    }

    return next();
  });

  bot.on("photo", async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }
    const user = await getUserWithSession(BigInt(ctx.from.id));
    const session = user?.sessions[0];
    if (!user || session?.flow !== "pet_create" || session.step !== "photo") {
      return next();
    }
    const payload = toPayload(session.payload);
    const photo = ctx.message.photo.at(-1);
    if (!photo) {
      await ctx.reply("Попробуй отправить фото еще раз.");
      return;
    }
    const draft = payload.petDraft;
    if (!draft?.name || !draft.breed || !draft.birthDate || !draft.weightKg || !draft.sex || draft.isSterilized === undefined) {
      await ctx.reply("Сессия регистрации устарела. Давай начнем заново через /start");
      return;
    }
    const pet = await createPetFromDraft(user.id, {
      name: draft.name,
      breed: draft.breed,
      birthDate: draft.birthDate,
      weightKg: draft.weightKg,
      sex: draft.sex,
      isSterilized: draft.isSterilized,
      photoFileId: photo.file_id,
    });
    await clearSession(user.id);
    await ctx.reply(`Питомец ${pet.name} успешно добавлен! 🎉`);
    if (ctx.chat) {
      await sendHome(BigInt(ctx.from.id), ctx.chat.id);
    }
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

    if (data === "pet:add") {
      await upsertSession(user.id, "pet_create", "name", {});
      await ctx.reply("Как зовут твою кошку? 😺", backKeyboard());
      return;
    }

    if (data.startsWith("pet:")) {
      const petId = data.split(":")[1];
      await upsertSession(user.id, "pet_menu", "selected", { selectedPetId: petId });
      await ctx.reply("Что делаем с питомцем?", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "ℹ️ Основная информация", callback_data: `pet_info:${petId}` }],
            [{ text: "🍽️ Покормить", callback_data: `feed:${petId}` }],
            [{ text: "📝 Записать событие", callback_data: `event:${petId}` }],
            [{ text: "🗑️ Удалить информацию", callback_data: `delete:${petId}` }],
            [{ text: "⬅️ Назад", callback_data: "home" }],
          ],
        },
      });
      return;
    }

    if (data === "home") {
      if (ctx.chat) {
        await sendHome(BigInt(ctx.from.id), ctx.chat.id);
      }
      return;
    }

    if (data === "share:open") {
      const firstPet = user.pets.find((x) => !x.pet.isDeleted)?.pet;
      await ctx.reply(
        firstPet
          ? `Код доступа для шаринга: \`${firstPet.id}\`\nОтправь его второму пользователю.`
          : "Сначала добавь питомца, потом можно делиться доступом.",
        { parse_mode: "Markdown" },
      );
      await upsertSession(user.id, "share", "join_code", {});
      await ctx.reply("Или отправь мне код, чтобы подключиться к другому питомцу.");
      return;
    }

    if (data.startsWith("pet_info:")) {
      const petId = data.split(":")[1];
      const pet = await prisma.pet.findUnique({ where: { id: petId }, include: { feedingConfig: { include: { scheduleItems: true } } } });
      if (!pet || pet.isDeleted) {
        await ctx.reply("Питомец не найден");
        return;
      }
      const schedule = pet.feedingConfig?.scheduleItems
        .map((i) => `${formatMinutesToHHMM(i.minutesOfDay)} - ${i.amount} ${i.feedType === "WET" ? "пач." : "гр."} ${i.feedType === "WET" ? "влажного" : "сухого"}`)
        .join("\n");
      await ctx.reply(
        `🐱 ${pet.name}\nПорода: ${pet.breed}\nДата рождения: ${dayjs(pet.birthDate).format("DD.MM.YYYY")}\nВес: ${pet.currentWeightKg} кг\nПол: ${pet.sex === "FEMALE" ? "девочка" : "мальчик"}\nСтерилизована: ${pet.isSterilized ? "да" : "нет"}\n\nПитание:\n${
          pet.feedingConfig
            ? `Сухой корм: ${pet.feedingConfig.dryFoodDailyGrams ?? 0} гр/сутки\nВлажный корм: ${pet.feedingConfig.wetFoodDailyPacks ?? 0} пач/сутки\n${schedule ? `Расписание:\n${schedule}` : "Расписание не заполнено"}`
            : "Настройки питания пока не заполнены"
        }`,
      );
      await ctx.reply("Выбери раздел:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✏️ Редактировать информацию", callback_data: `pet_edit_menu:${petId}` }],
            [{ text: "⚖️ Вес", callback_data: `weight:${petId}` }],
            [{ text: "🍽️ Питание", callback_data: `nutrition:${petId}` }],
            [{ text: "📋 События", callback_data: `events:${petId}` }],
            [{ text: "⬅️ Назад", callback_data: `pet:${petId}` }],
          ],
        },
      });
      return;
    }

    if (data.startsWith("pet_edit_menu:")) {
      const petId = data.split(":")[1];
      await ctx.reply("Что изменить?", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Кличка", callback_data: `pet_edit:${petId}:name` }],
            [{ text: "Порода", callback_data: `pet_edit:${petId}:breed` }],
            [{ text: "Дата рождения", callback_data: `pet_edit:${petId}:birth_date` }],
            [{ text: "Пол", callback_data: `pet_edit:${petId}:sex` }],
            [{ text: "Стерилизация", callback_data: `pet_edit:${petId}:sterilized` }],
            [{ text: "⬅️ Назад", callback_data: `pet_info:${petId}` }],
          ],
        },
      });
      return;
    }

    if (data.startsWith("pet_edit:")) {
      const [, petId, field] = data.split(":");
      const editField = field as SessionPayload["editField"];
      await upsertSession(user.id, "pet_edit", "value", { selectedPetId: petId, editField });

      if (field === "sex") {
        await ctx.reply("Выбери пол:", sexKeyboard());
      } else if (field === "sterilized") {
        await ctx.reply("Стерилизован ли питомец?", yesNoKeyboard());
      } else if (field === "birth_date") {
        await ctx.reply("Введи дату в формате ДД.ММ.ГГГГ", backKeyboard());
      } else if (field === "breed") {
        await ctx.reply("Введи новую породу", backKeyboard());
      } else {
        await ctx.reply("Введи новую кличку", backKeyboard());
      }
      return;
    }

    if (data.startsWith("weight:")) {
      const petId = data.split(":")[1];
      const logs = await prisma.weightLog.findMany({ where: { petId }, orderBy: { createdAt: "desc" }, take: 4 });
      const trend = logs.length > 1 ? logs[0].weightKg - logs.at(-1)!.weightKg : 0;
      await ctx.reply(
        `Текущий вес: ${logs[0]?.weightKg ?? "—"} кг\nИзменение за период: ${trend >= 0 ? "+" : ""}${trend.toFixed(2)} кг`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✏️ Изменить вес", callback_data: `weight_edit:${petId}` }],
              [{ text: "📤 История (XLSX)", callback_data: `weight_history:${petId}` }],
              [{ text: "⬅️ Назад", callback_data: `pet_info:${petId}` }],
            ],
          },
        },
      );
      return;
    }

    if (data.startsWith("weight_edit:")) {
      const petId = data.split(":")[1];
      await upsertSession(user.id, "weight_update", "value", { selectedPetId: petId });
      await ctx.reply("Укажи новый вес в кг");
      return;
    }

    if (data.startsWith("weight_history:")) {
      const petId = data.split(":")[1];
      await ctx.reply("Выбери период для отчета по весу:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "За неделю", callback_data: `weight_report:${petId}:week` }],
            [{ text: "За месяц", callback_data: `weight_report:${petId}:month` }],
            [{ text: "За год", callback_data: `weight_report:${petId}:year` }],
            [{ text: "За произвольную дату", callback_data: `weight_report_custom:${petId}` }],
          ],
        },
      });
      return;
    }

    if (data.startsWith("weight_report:")) {
      const [, petId, periodRaw] = data.split(":");
      const period = periodRaw as "week" | "month" | "year";
      const range = getRangeByPeriod(period);
      const logs = await prisma.weightLog.findMany({ where: { petId, createdAt: { gte: range.start, lte: range.end } }, orderBy: { createdAt: "asc" } });
      const report = buildWeightReport(
        logs.map((x) => ({ date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"), weightKg: x.weightKg })),
      );
      await ctx.replyWithDocument(Input.fromBuffer(report, `weight_${period}.xlsx`));
      return;
    }

    if (data.startsWith("weight_report_custom:")) {
      const petId = data.split(":")[1];
      await upsertSession(user.id, "report_custom_date", "date", {
        selectedPetId: petId,
        reportKind: "weight",
      });
      await ctx.reply("Введи дату в формате ДД.ММ.ГГГГ");
      return;
    }

    if (data.startsWith("nutrition:")) {
      const petId = data.split(":")[1];
      await ctx.reply("Раздел питания:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✏️ Редактировать норму питания", callback_data: `nutrition_norm:${petId}` }],
            [{ text: "🕒 Редактировать расписание", callback_data: `nutrition_schedule:${petId}` }],
            [{ text: "⬅️ Назад", callback_data: `pet_info:${petId}` }],
          ],
        },
      });
      return;
    }

    if (data.startsWith("nutrition_norm:")) {
      const petId = data.split(":")[1];
      await upsertSession(user.id, "feeding_edit", "daily_dry", { selectedPetId: petId });
      await ctx.reply("Суточная норма сухого корма в граммах?", backKeyboard());
      return;
    }

    if (data.startsWith("nutrition_schedule:")) {
      const petId = data.split(":")[1];
      const config = await getFeedingConfigWithSchedule(petId);
      const scheduleButtons = (config?.scheduleItems ?? []).map((item) => [
        {
          text: `🗑️ ${formatMinutesToHHMM(item.minutesOfDay)} • ${item.amount} ${item.feedType === "WET" ? "пач" : "гр"}`,
          callback_data: `nutrition_schedule_delete:${petId}:${item.id}`,
        },
      ]);
      await ctx.reply(
        config?.scheduleItems.length
          ? "Текущее расписание. Нажми на слот, чтобы удалить:"
          : "Расписание пока пустое.",
        {
          reply_markup: {
            inline_keyboard: [
              ...scheduleButtons,
              [{ text: "➕ Добавить слот", callback_data: `nutrition_schedule_add:${petId}` }],
              [{ text: "⬅️ Назад", callback_data: `nutrition:${petId}` }],
            ],
          },
        },
      );
      return;
    }

    if (data.startsWith("nutrition_schedule_add:")) {
      const petId = data.split(":")[1];
      await upsertSession(user.id, "feeding_schedule_add", "time", { selectedPetId: petId });
      await ctx.reply("Укажи время кормления в формате ЧЧ:ММ", backKeyboard());
      return;
    }

    if (data.startsWith("nutrition_schedule_delete:")) {
      const [, petId, scheduleItemId] = data.split(":");
      await deleteScheduleItem(scheduleItemId);
      await ctx.reply("Слот удален ✅");
      await ctx.reply("Открой раздел расписания снова для просмотра обновлений.", {
        reply_markup: {
          inline_keyboard: [[{ text: "🕒 Открыть расписание", callback_data: `nutrition_schedule:${petId}` }]],
        },
      });
      return;
    }

    if (data.startsWith("feed:")) {
      const petId = data.split(":")[1];
      const feedingState = await getPendingScheduleItemsForToday(petId, user.timezone);
      if (!feedingState?.pet) {
        return;
      }
      if (!feedingState.pet.feedingConfig || feedingState.pet.feedingConfig.scheduleItems.length === 0) {
        await quickFeed(petId);
        await ctx.reply(
          "Записала прием пищи 🫶 Если хочешь вести питание детальнее, заполни нормы и расписание.",
          {
            reply_markup: {
              inline_keyboard: [[{ text: "🍽️ Перейти в питание", callback_data: `nutrition:${petId}` }]],
            },
          },
        );
        return;
      }
      const pending = feedingState.pending;
      if (!pending.length) {
        await ctx.reply("Все плановые кормления на сегодня уже отмечены ✅");
        return;
      }
      await ctx.reply("Какое кормление отмечаем?", {
        reply_markup: {
          inline_keyboard: pending.map((x) => [
            {
              text: `${formatMinutesToHHMM(x.minutesOfDay)} • ${x.amount} ${x.feedType === "WET" ? "пачки" : "гр"} ${x.feedType === "WET" ? "влажного" : "сухого"}`,
              callback_data: `feed_pick:${x.id}`,
            },
          ]),
        },
      });
      return;
    }

    if (data.startsWith("feed_pick:")) {
      const scheduleId = data.split(":")[1];
      const schedule = await logScheduledFeeding(scheduleId);
      if (!schedule) {
        return;
      }
      await ctx.reply("Кормление записано ✅");
      return;
    }

    if (data.startsWith("events:")) {
      const petId = data.split(":")[1];
      const today = await getTodayEventSummary(petId, user.timezone);
      const eventsText = today.events.length
        ? today.events
            .map((event) => {
              const label =
                event.kind === "CUSTOM"
                  ? event.customEventType?.label ?? "Другое"
                  : eventLabels[event.kind];
              return `• ${dayjs(event.createdAt).format("HH:mm")} — ${label}${event.comment ? ` (${event.comment})` : ""}`;
            })
            .join("\n")
        : "Сегодня событий пока нет.";
      await ctx.reply(`Сводка за сегодня:\nКормления: ${today.feedings}\n${eventsText}`);

      await upsertSession(user.id, "event_pick", "kind", { selectedPetId: petId });
      await ctx.reply("Выбери событие или добавь новое:", {
        reply_markup: {
          inline_keyboard: [
            ...defaultEvents.map((x) => [{ text: x.label, callback_data: `event_pick:${petId}:${x.kind}` }]),
            [{ text: "➕ Добавить свое событие", callback_data: `event_new:${petId}` }],
            [{ text: "📤 Отчеты (XLSX)", callback_data: `events_report_menu:${petId}` }],
          ],
        },
      });
      return;
    }

    if (data.startsWith("event_pick:")) {
      const [, petId, kind] = data.split(":");
      await upsertSession(user.id, "event_comment", "comment", {
        selectedPetId: petId,
        pendingEventKind: kind as PetEventKind,
      });
      await ctx.reply("Добавь комментарий к событию:");
      return;
    }

    if (data.startsWith("event_new:")) {
      const petId = data.split(":")[1];
      await upsertSession(user.id, "event_new", "name", { selectedPetId: petId });
      await ctx.reply("Напиши название нового события:");
      return;
    }

    if (data.startsWith("events_report_menu:")) {
      const petId = data.split(":")[1];
      await ctx.reply("Выбери период для отчета по событиям:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "За неделю", callback_data: `events_report:${petId}:week` }],
            [{ text: "За месяц", callback_data: `events_report:${petId}:month` }],
            [{ text: "За год", callback_data: `events_report:${petId}:year` }],
            [{ text: "За произвольную дату", callback_data: `events_report_custom:${petId}` }],
          ],
        },
      });
      return;
    }

    if (data.startsWith("events_report:")) {
      const [, petId, periodRaw] = data.split(":");
      const period = periodRaw as "week" | "month" | "year";
      const pet = await prisma.pet.findUnique({ where: { id: petId } });
      if (!pet) {
        return;
      }
      const range = getRangeByPeriod(period);
      const [weights, events, feedings] = await Promise.all([
        prisma.weightLog.findMany({ where: { petId, createdAt: { gte: range.start, lte: range.end } }, orderBy: { createdAt: "asc" } }),
        prisma.petEvent.findMany({ where: { petId, createdAt: { gte: range.start, lte: range.end } }, include: { customEventType: true }, orderBy: { createdAt: "asc" } }),
        prisma.feedingLog.findMany({ where: { petId, createdAt: { gte: range.start, lte: range.end } }, orderBy: { createdAt: "asc" } }),
      ]);
      const report = buildEventsReport(
        pet.name,
        weights.map((x) => ({ date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"), weightKg: x.weightKg })),
        events.map((x) => ({
          date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"),
          type: x.kind === "CUSTOM" ? x.customEventType?.label ?? "Другое" : eventLabels[x.kind],
          comment: x.comment ?? "",
        })),
        feedings.map((x) => ({
          date: dayjs(x.createdAt).format("DD.MM.YYYY HH:mm"),
          type: "Кормление",
          comment: [x.feedType, x.amount].filter(Boolean).join(" "),
        })),
      );
      await ctx.replyWithDocument(Input.fromBuffer(report, `events_${pet.name}_${period}.xlsx`));
      return;
    }

    if (data.startsWith("events_report_custom:")) {
      const petId = data.split(":")[1];
      await upsertSession(user.id, "report_custom_date", "date", {
        selectedPetId: petId,
        reportKind: "events",
      });
      await ctx.reply("Введи дату в формате ДД.ММ.ГГГГ");
      return;
    }

    if (data.startsWith("delete:")) {
      const petId = data.split(":")[1];
      await ctx.reply("Точно удалить питомца из вашего списка?", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Да, удалить", callback_data: `delete_confirm:${petId}` }],
            [{ text: "Нет, отмена", callback_data: `pet:${petId}` }],
          ],
        },
      });
      return;
    }

    if (data.startsWith("delete_confirm:")) {
      const petId = data.split(":")[1];
      await softDeletePet(petId);
      await ctx.reply("Питомец скрыт из списка.");
      if (ctx.chat) {
        await sendHome(BigInt(ctx.from.id), ctx.chat.id);
      }
    }
  });

  bot.on("text", async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }
    const user = await getUserWithSession(BigInt(ctx.from.id));
    const session = user?.sessions[0];
    if (!user || session?.flow !== "event_new" || session.step !== "name") {
      return next();
    }
    const payload = toPayload(session.payload);
    if (!payload.selectedPetId) {
      return next();
    }
    const customType = await upsertCustomEventType(payload.selectedPetId, ctx.message.text.trim(), user.id);
    await upsertSession(user.id, "event_comment", "comment", {
      selectedPetId: payload.selectedPetId,
      pendingEventKind: "CUSTOM",
      customEventKindId: customType.id,
    });
    await ctx.reply("Супер! Теперь напиши комментарий к событию.");
  });

  return bot;
};
