"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBot = void 0;
const telegraf_1 = require("telegraf");
const dayjs_1 = __importDefault(require("dayjs"));
const config_1 = require("../config");
const prisma_1 = require("../prisma");
const event_service_1 = require("../modules/events/event.service");
const feeding_service_1 = require("../modules/feeding/feeding.service");
const pet_service_1 = require("../modules/pets/pet.service");
const session_service_1 = require("../modules/sessions/session.service");
const user_service_1 = require("../modules/users/user.service");
const reports_1 = require("../services/reports");
const keyboards_1 = require("./ui/keyboards");
const date_1 = require("../utils/date");
const toPayload = (value) => (value ?? {});
const eventLabels = {
    PEE: "Пописала",
    POO: "Покакала",
    PLAY: "Поиграла",
    SYMPTOM: "Симптом",
    CUSTOM: "Другое",
    FEEDING: "Кормление",
};
const defaultEvents = [
    { kind: "PEE", label: "Пописала" },
    { kind: "POO", label: "Покакала" },
    { kind: "PLAY", label: "Игра" },
    { kind: "SYMPTOM", label: "Симптом" },
];
const createBot = () => {
    const getRangeByPeriod = (period) => {
        if (period === "week") {
            const from = (0, dayjs_1.default)().subtract(1, "week").toDate();
            return { start: from, end: new Date() };
        }
        if (period === "year") {
            const from = (0, dayjs_1.default)().subtract(1, "year").toDate();
            return { start: from, end: new Date() };
        }
        const from = (0, dayjs_1.default)().subtract(1, "month").toDate();
        return { start: from, end: new Date() };
    };
    const bot = new telegraf_1.Telegraf(config_1.config.TELEGRAM_BOT_TOKEN);
    const sendHome = async (telegramId, chatId) => {
        const pets = await (0, pet_service_1.listActivePetsByTelegramId)(telegramId);
        const buttons = pets.map((pet) => [{ text: `🐾 ${pet.name}`, callback_data: `pet:${pet.id}` }]);
        buttons.push([{ text: "➕ Добавить питомца", callback_data: "pet:add" }]);
        buttons.push([{ text: "🤝 Поделиться информацией", callback_data: "share:open" }]);
        await bot.telegram.sendMessage(chatId, pets.length ? "Выбери питомца из списка 👇" : "Питомцев пока нет. Добавим первого? 🐱", { reply_markup: { inline_keyboard: buttons } });
    };
    bot.start(async (ctx) => {
        if (!ctx.from) {
            return;
        }
        const user = await (0, user_service_1.getOrCreateUser)({
            telegramId: BigInt(ctx.from.id),
            username: ctx.from.username ?? undefined,
            firstName: ctx.from.first_name ?? undefined,
        });
        await (0, session_service_1.clearSession)(user.id);
        await ctx.reply("Привет! Я помогу отслеживать питание, туалет и другие события кошки 🐾");
        await ctx.reply("Если у тебя есть код для совместного доступа, отправь его сейчас. Или нажми «Пропустить».", (0, keyboards_1.skipKeyboard)());
        await (0, session_service_1.upsertSession)(user.id, "onboarding", "ask_ref", {});
    });
    bot.on("text", async (ctx, next) => {
        if (!ctx.from) {
            return next();
        }
        const user = await (0, user_service_1.getUserWithSession)(BigInt(ctx.from.id));
        if (!user) {
            return next();
        }
        const session = user.sessions[0];
        const text = ctx.message.text.trim();
        if (!session?.flow) {
            return next();
        }
        const payload = toPayload(session.payload);
        if (text === keyboards_1.BACK_TEXT) {
            if (session.flow === "pet_create") {
                if (session.step === "breed") {
                    await (0, session_service_1.upsertSession)(user.id, "pet_create", "name", payload);
                    await ctx.reply("Как зовут твою кошку? 😺", (0, keyboards_1.backKeyboard)());
                    return;
                }
                if (session.step === "birth_date") {
                    await (0, session_service_1.upsertSession)(user.id, "pet_create", "breed", payload);
                    await ctx.reply("Какая у неё порода? Можно написать в свободной форме.", (0, keyboards_1.backKeyboard)());
                    return;
                }
                if (session.step === "weight") {
                    await (0, session_service_1.upsertSession)(user.id, "pet_create", "birth_date", payload);
                    await ctx.reply("Дата рождения в формате ДД.ММ.ГГГГ 📅", (0, keyboards_1.backKeyboard)());
                    return;
                }
                if (session.step === "sex") {
                    await (0, session_service_1.upsertSession)(user.id, "pet_create", "weight", payload);
                    await ctx.reply("Какой вес питомца в кг? Например: 3,5", (0, keyboards_1.backKeyboard)());
                    return;
                }
                if (session.step === "sterilized") {
                    await (0, session_service_1.upsertSession)(user.id, "pet_create", "sex", payload);
                    await ctx.reply("Какой пол питомца?", (0, keyboards_1.sexKeyboard)());
                    return;
                }
                if (session.step === "photo") {
                    await (0, session_service_1.upsertSession)(user.id, "pet_create", "sterilized", payload);
                    await ctx.reply("Стерилизована ли кошка?", (0, keyboards_1.yesNoKeyboard)());
                    return;
                }
            }
            if (session.flow === "feeding_edit") {
                if (session.step === "daily_wet") {
                    await (0, session_service_1.upsertSession)(user.id, "feeding_edit", "daily_dry", payload);
                    await ctx.reply("Суточная норма сухого корма в граммах?", (0, keyboards_1.backKeyboard)());
                    return;
                }
            }
            if (session.flow === "feeding_schedule_add") {
                if (session.step === "feed_type") {
                    await (0, session_service_1.upsertSession)(user.id, "feeding_schedule_add", "time", payload);
                    await ctx.reply("Укажи время кормления в формате ЧЧ:ММ", (0, keyboards_1.backKeyboard)());
                    return;
                }
                if (session.step === "amount") {
                    await (0, session_service_1.upsertSession)(user.id, "feeding_schedule_add", "feed_type", payload);
                    await ctx.reply("Тип корма?", {
                        reply_markup: { keyboard: [["Влажный", "Сухой"], [keyboards_1.BACK_TEXT]], resize_keyboard: true },
                    });
                    return;
                }
            }
            if (session.flow === "pet_edit" && payload.selectedPetId) {
                await (0, session_service_1.clearSession)(user.id);
                await ctx.reply("Редактирование отменено.");
                await ctx.reply("Вернуться в карточку питомца?", {
                    reply_markup: {
                        inline_keyboard: [[{ text: "ℹ️ Открыть карточку", callback_data: `pet_info:${payload.selectedPetId}` }]],
                    },
                });
                return;
            }
            await (0, session_service_1.clearSession)(user.id);
            if (ctx.chat) {
                await sendHome(BigInt(ctx.from.id), ctx.chat.id);
            }
            return;
        }
        if (session.flow === "onboarding" && session.step === "ask_ref") {
            if (text !== "Пропустить") {
                const pet = await (0, pet_service_1.addPetAccessByCode)(user.id, text);
                if (pet) {
                    await ctx.reply("Готово! Подключила тебя к питомцу ✅");
                }
                else {
                    await ctx.reply("Не нашла такой код. Можно продолжить без него.");
                }
            }
            await (0, session_service_1.upsertSession)(user.id, "pet_create", "name", {});
            await ctx.reply("Как зовут твою кошку? 😺", (0, keyboards_1.backKeyboard)());
            return;
        }
        if (session.flow === "pet_create") {
            if (session.step === "name") {
                payload.petDraft = { ...payload.petDraft, name: text };
                await (0, session_service_1.upsertSession)(user.id, "pet_create", "breed", payload);
                await ctx.reply("Какая у неё порода? Можно написать в свободной форме.", {
                    ...(0, keyboards_1.backKeyboard)(),
                });
                return;
            }
            if (session.step === "breed") {
                payload.petDraft = { ...payload.petDraft, breed: text };
                await (0, session_service_1.upsertSession)(user.id, "pet_create", "birth_date", payload);
                await ctx.reply("Дата рождения в формате ДД.ММ.ГГГГ 📅", (0, keyboards_1.backKeyboard)());
                return;
            }
            if (session.step === "birth_date") {
                const date = (0, date_1.parseDateDDMMYYYY)(text);
                if (!date) {
                    await ctx.reply("Не получилось распознать дату. Пример: 15.05.2024");
                    return;
                }
                payload.petDraft = { ...payload.petDraft, birthDate: date.toISOString() };
                await (0, session_service_1.upsertSession)(user.id, "pet_create", "weight", payload);
                await ctx.reply("Какой вес питомца в кг? Например: 3,5", (0, keyboards_1.backKeyboard)());
                return;
            }
            if (session.step === "weight") {
                const weight = (0, date_1.parseWeight)(text);
                if (!weight) {
                    await ctx.reply("Вес не распознан. Напиши число, например 3.5");
                    return;
                }
                payload.petDraft = { ...payload.petDraft, weightKg: weight };
                await (0, session_service_1.upsertSession)(user.id, "pet_create", "sex", payload);
                await ctx.reply("Какой пол питомца?", (0, keyboards_1.sexKeyboard)());
                return;
            }
            if (session.step === "sex") {
                if (!["Девочка", "Мальчик"].includes(text)) {
                    await ctx.reply("Выбери пол кнопкой.");
                    return;
                }
                payload.petDraft = { ...payload.petDraft, sex: text === "Девочка" ? "FEMALE" : "MALE" };
                await (0, session_service_1.upsertSession)(user.id, "pet_create", "sterilized", payload);
                await ctx.reply("Стерилизована ли кошка?", (0, keyboards_1.yesNoKeyboard)());
                return;
            }
            if (session.step === "sterilized") {
                if (!["Да", "Нет"].includes(text)) {
                    await ctx.reply("Ответь кнопкой: Да или Нет.");
                    return;
                }
                payload.petDraft = { ...payload.petDraft, isSterilized: text === "Да" };
                await (0, session_service_1.upsertSession)(user.id, "pet_create", "photo", payload);
                await ctx.reply("Отправь фото питомца 🖼️", (0, keyboards_1.backKeyboard)());
                return;
            }
        }
        if (session.flow === "feeding_edit" && payload.selectedPetId) {
            if (session.step === "daily_dry") {
                const dry = (0, date_1.parseWeight)(text);
                if (dry === null) {
                    await ctx.reply("Укажи число, например 20");
                    return;
                }
                const data = { ...payload, dryFood: dry };
                await (0, session_service_1.upsertSession)(user.id, "feeding_edit", "daily_wet", data);
                await ctx.reply("Суточная норма влажного корма в пачках?");
                return;
            }
            if (session.step === "daily_wet") {
                const wet = (0, date_1.parseWeight)(text);
                if (wet === null) {
                    await ctx.reply("Укажи число, например 1 или 0,5");
                    return;
                }
                const dry = Number(payload.dryFood ?? 0);
                await (0, feeding_service_1.updateDailyNorm)(payload.selectedPetId, dry, wet);
                await (0, session_service_1.clearSession)(user.id);
                await ctx.reply("Нормы питания обновлены ✅");
                if (ctx.chat) {
                    await sendHome(BigInt(ctx.from.id), ctx.chat.id);
                }
                return;
            }
        }
        if (session.flow === "feeding_schedule_add" && payload.selectedPetId) {
            if (session.step === "time") {
                const minutes = (0, date_1.parseTimeHHMM)(text);
                if (minutes === null) {
                    await ctx.reply("Неверный формат времени. Пример: 08:30");
                    return;
                }
                const nextPayload = { ...payload, tempMinutesOfDay: minutes };
                await (0, session_service_1.upsertSession)(user.id, "feeding_schedule_add", "feed_type", nextPayload);
                await ctx.reply("Тип корма?", {
                    reply_markup: { keyboard: [["Влажный", "Сухой"], [keyboards_1.BACK_TEXT]], resize_keyboard: true },
                });
                return;
            }
            if (session.step === "feed_type") {
                if (!["Влажный", "Сухой"].includes(text)) {
                    await ctx.reply("Выбери тип кнопкой: Влажный или Сухой");
                    return;
                }
                const nextPayload = { ...payload, tempFeedType: text === "Влажный" ? "WET" : "DRY" };
                await (0, session_service_1.upsertSession)(user.id, "feeding_schedule_add", "amount", nextPayload);
                await ctx.reply(text === "Влажный"
                    ? "Укажи количество пачек (можно дробное, например 0,5)"
                    : "Укажи количество граммов", (0, keyboards_1.backKeyboard)());
                return;
            }
            if (session.step === "amount") {
                const amount = (0, date_1.parseWeight)(text);
                if (amount === null || payload.tempMinutesOfDay === undefined || !payload.tempFeedType) {
                    await ctx.reply("Проверь данные и попробуй снова.");
                    return;
                }
                await (0, feeding_service_1.addScheduleItem)(payload.selectedPetId, payload.tempMinutesOfDay, payload.tempFeedType, amount);
                await (0, session_service_1.clearSession)(user.id);
                await ctx.reply("Слот расписания добавлен ✅", {
                    reply_markup: {
                        inline_keyboard: [[{ text: "🕒 Открыть расписание", callback_data: `nutrition_schedule:${payload.selectedPetId}` }]],
                    },
                });
                return;
            }
        }
        if (session.flow === "event_comment" && payload.selectedPetId && payload.pendingEventKind) {
            await (0, event_service_1.createPetEvent)({
                petId: payload.selectedPetId,
                kind: payload.pendingEventKind,
                customEventTypeId: payload.customEventKindId,
                comment: text,
            });
            await (0, session_service_1.clearSession)(user.id);
            await ctx.reply("Событие записано ✍️");
            return;
        }
        if (session.flow === "weight_update" && payload.selectedPetId) {
            const weight = (0, date_1.parseWeight)(text);
            if (weight === null) {
                await ctx.reply("Не распознала вес. Пример: 3,6");
                return;
            }
            await prisma_1.prisma.pet.update({
                where: { id: payload.selectedPetId },
                data: { currentWeightKg: weight, weightLogs: { create: { weightKg: weight } } },
            });
            await (0, session_service_1.clearSession)(user.id);
            await ctx.reply("Вес обновлен ✅");
            return;
        }
        if (session.flow === "share" && session.step === "join_code") {
            const pet = await (0, pet_service_1.addPetAccessByCode)(user.id, text);
            if (!pet || pet.isDeleted) {
                await ctx.reply("Код не найден.");
                return;
            }
            await (0, session_service_1.clearSession)(user.id);
            await ctx.reply(`Теперь ты тоже можешь вести ${pet.name} 🤝`);
            if (ctx.chat) {
                await sendHome(BigInt(ctx.from.id), ctx.chat.id);
            }
            return;
        }
        if (session.flow === "pet_edit" && payload.selectedPetId && payload.editField) {
            if (payload.editField === "name") {
                await (0, pet_service_1.updatePetName)(payload.selectedPetId, text);
            }
            else if (payload.editField === "breed") {
                await (0, pet_service_1.updatePetBreed)(payload.selectedPetId, text);
            }
            else if (payload.editField === "birth_date") {
                const date = (0, date_1.parseDateDDMMYYYY)(text);
                if (!date) {
                    await ctx.reply("Неверный формат даты. Пример: 15.05.2024");
                    return;
                }
                await (0, pet_service_1.updatePetBirthDate)(payload.selectedPetId, date);
            }
            else if (payload.editField === "sex") {
                if (!["Девочка", "Мальчик"].includes(text)) {
                    await ctx.reply("Выбери пол кнопкой");
                    return;
                }
                await (0, pet_service_1.updatePetSex)(payload.selectedPetId, text === "Девочка" ? "FEMALE" : "MALE");
            }
            else if (payload.editField === "sterilized") {
                if (!["Да", "Нет"].includes(text)) {
                    await ctx.reply("Выбери Да или Нет");
                    return;
                }
                await (0, pet_service_1.updatePetSterilization)(payload.selectedPetId, text === "Да");
            }
            await (0, session_service_1.clearSession)(user.id);
            await ctx.reply("Информация обновлена ✅");
            await ctx.reply("Открой карточку питомца для просмотра изменений.");
            return;
        }
        if (session.flow === "report_custom_date" && payload.selectedPetId && payload.reportKind) {
            const date = (0, date_1.parseDateDDMMYYYY)(text);
            if (!date) {
                await ctx.reply("Неверный формат даты. Пример: 15.05.2024");
                return;
            }
            const start = (0, dayjs_1.default)(date).startOf("day").toDate();
            const end = (0, dayjs_1.default)(date).endOf("day").toDate();
            if (payload.reportKind === "weight") {
                const logs = await prisma_1.prisma.weightLog.findMany({
                    where: { petId: payload.selectedPetId, createdAt: { gte: start, lte: end } },
                    orderBy: { createdAt: "asc" },
                });
                const report = (0, reports_1.buildWeightReport)(logs.map((x) => ({ date: (0, dayjs_1.default)(x.createdAt).format("DD.MM.YYYY HH:mm"), weightKg: x.weightKg })));
                await ctx.replyWithDocument(telegraf_1.Input.fromBuffer(report, "weight_custom_date.xlsx"));
            }
            else {
                const pet = await prisma_1.prisma.pet.findUnique({ where: { id: payload.selectedPetId } });
                if (!pet) {
                    await (0, session_service_1.clearSession)(user.id);
                    return;
                }
                const [weights, events, feedings] = await Promise.all([
                    prisma_1.prisma.weightLog.findMany({ where: { petId: payload.selectedPetId, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: "asc" } }),
                    prisma_1.prisma.petEvent.findMany({ where: { petId: payload.selectedPetId, createdAt: { gte: start, lte: end } }, include: { customEventType: true }, orderBy: { createdAt: "asc" } }),
                    prisma_1.prisma.feedingLog.findMany({ where: { petId: payload.selectedPetId, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: "asc" } }),
                ]);
                const report = (0, reports_1.buildEventsReport)(pet.name, weights.map((x) => ({ date: (0, dayjs_1.default)(x.createdAt).format("DD.MM.YYYY HH:mm"), weightKg: x.weightKg })), events.map((x) => ({
                    date: (0, dayjs_1.default)(x.createdAt).format("DD.MM.YYYY HH:mm"),
                    type: x.kind === "CUSTOM" ? x.customEventType?.label ?? "Другое" : eventLabels[x.kind],
                    comment: x.comment ?? "",
                })), feedings.map((x) => ({
                    date: (0, dayjs_1.default)(x.createdAt).format("DD.MM.YYYY HH:mm"),
                    type: "Кормление",
                    comment: [x.feedType, x.amount].filter(Boolean).join(" "),
                })));
                await ctx.replyWithDocument(telegraf_1.Input.fromBuffer(report, `events_${pet.name}_custom_date.xlsx`));
            }
            await (0, session_service_1.clearSession)(user.id);
            return;
        }
        return next();
    });
    bot.on("photo", async (ctx, next) => {
        if (!ctx.from) {
            return next();
        }
        const user = await (0, user_service_1.getUserWithSession)(BigInt(ctx.from.id));
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
        const pet = await (0, pet_service_1.createPetFromDraft)(user.id, {
            name: draft.name,
            breed: draft.breed,
            birthDate: draft.birthDate,
            weightKg: draft.weightKg,
            sex: draft.sex,
            isSterilized: draft.isSterilized,
            photoFileId: photo.file_id,
        });
        await (0, session_service_1.clearSession)(user.id);
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
        const user = await (0, user_service_1.getUserWithPets)(BigInt(ctx.from.id));
        if (!user) {
            return;
        }
        await ctx.answerCbQuery();
        if (data === "pet:add") {
            await (0, session_service_1.upsertSession)(user.id, "pet_create", "name", {});
            await ctx.reply("Как зовут твою кошку? 😺", (0, keyboards_1.backKeyboard)());
            return;
        }
        if (data.startsWith("pet:")) {
            const petId = data.split(":")[1];
            await (0, session_service_1.upsertSession)(user.id, "pet_menu", "selected", { selectedPetId: petId });
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
            await ctx.reply(firstPet
                ? `Код доступа для шаринга: \`${firstPet.id}\`\nОтправь его второму пользователю.`
                : "Сначала добавь питомца, потом можно делиться доступом.", { parse_mode: "Markdown" });
            await (0, session_service_1.upsertSession)(user.id, "share", "join_code", {});
            await ctx.reply("Или отправь мне код, чтобы подключиться к другому питомцу.");
            return;
        }
        if (data.startsWith("pet_info:")) {
            const petId = data.split(":")[1];
            const pet = await prisma_1.prisma.pet.findUnique({ where: { id: petId }, include: { feedingConfig: { include: { scheduleItems: true } } } });
            if (!pet || pet.isDeleted) {
                await ctx.reply("Питомец не найден");
                return;
            }
            const schedule = pet.feedingConfig?.scheduleItems
                .map((i) => `${(0, date_1.formatMinutesToHHMM)(i.minutesOfDay)} - ${i.amount} ${i.feedType === "WET" ? "пач." : "гр."} ${i.feedType === "WET" ? "влажного" : "сухого"}`)
                .join("\n");
            await ctx.reply(`🐱 ${pet.name}\nПорода: ${pet.breed}\nДата рождения: ${(0, dayjs_1.default)(pet.birthDate).format("DD.MM.YYYY")}\nВес: ${pet.currentWeightKg} кг\nПол: ${pet.sex === "FEMALE" ? "девочка" : "мальчик"}\nСтерилизована: ${pet.isSterilized ? "да" : "нет"}\n\nПитание:\n${pet.feedingConfig
                ? `Сухой корм: ${pet.feedingConfig.dryFoodDailyGrams ?? 0} гр/сутки\nВлажный корм: ${pet.feedingConfig.wetFoodDailyPacks ?? 0} пач/сутки\n${schedule ? `Расписание:\n${schedule}` : "Расписание не заполнено"}`
                : "Настройки питания пока не заполнены"}`);
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
            const editField = field;
            await (0, session_service_1.upsertSession)(user.id, "pet_edit", "value", { selectedPetId: petId, editField });
            if (field === "sex") {
                await ctx.reply("Выбери пол:", (0, keyboards_1.sexKeyboard)());
            }
            else if (field === "sterilized") {
                await ctx.reply("Стерилизован ли питомец?", (0, keyboards_1.yesNoKeyboard)());
            }
            else if (field === "birth_date") {
                await ctx.reply("Введи дату в формате ДД.ММ.ГГГГ", (0, keyboards_1.backKeyboard)());
            }
            else if (field === "breed") {
                await ctx.reply("Введи новую породу", (0, keyboards_1.backKeyboard)());
            }
            else {
                await ctx.reply("Введи новую кличку", (0, keyboards_1.backKeyboard)());
            }
            return;
        }
        if (data.startsWith("weight:")) {
            const petId = data.split(":")[1];
            const logs = await prisma_1.prisma.weightLog.findMany({ where: { petId }, orderBy: { createdAt: "desc" }, take: 4 });
            const trend = logs.length > 1 ? logs[0].weightKg - logs.at(-1).weightKg : 0;
            await ctx.reply(`Текущий вес: ${logs[0]?.weightKg ?? "—"} кг\nИзменение за период: ${trend >= 0 ? "+" : ""}${trend.toFixed(2)} кг`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✏️ Изменить вес", callback_data: `weight_edit:${petId}` }],
                        [{ text: "📤 История (XLSX)", callback_data: `weight_history:${petId}` }],
                        [{ text: "⬅️ Назад", callback_data: `pet_info:${petId}` }],
                    ],
                },
            });
            return;
        }
        if (data.startsWith("weight_edit:")) {
            const petId = data.split(":")[1];
            await (0, session_service_1.upsertSession)(user.id, "weight_update", "value", { selectedPetId: petId });
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
            const period = periodRaw;
            const range = getRangeByPeriod(period);
            const logs = await prisma_1.prisma.weightLog.findMany({ where: { petId, createdAt: { gte: range.start, lte: range.end } }, orderBy: { createdAt: "asc" } });
            const report = (0, reports_1.buildWeightReport)(logs.map((x) => ({ date: (0, dayjs_1.default)(x.createdAt).format("DD.MM.YYYY HH:mm"), weightKg: x.weightKg })));
            await ctx.replyWithDocument(telegraf_1.Input.fromBuffer(report, `weight_${period}.xlsx`));
            return;
        }
        if (data.startsWith("weight_report_custom:")) {
            const petId = data.split(":")[1];
            await (0, session_service_1.upsertSession)(user.id, "report_custom_date", "date", {
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
            await (0, session_service_1.upsertSession)(user.id, "feeding_edit", "daily_dry", { selectedPetId: petId });
            await ctx.reply("Суточная норма сухого корма в граммах?", (0, keyboards_1.backKeyboard)());
            return;
        }
        if (data.startsWith("nutrition_schedule:")) {
            const petId = data.split(":")[1];
            const config = await (0, feeding_service_1.getFeedingConfigWithSchedule)(petId);
            const scheduleButtons = (config?.scheduleItems ?? []).map((item) => [
                {
                    text: `🗑️ ${(0, date_1.formatMinutesToHHMM)(item.minutesOfDay)} • ${item.amount} ${item.feedType === "WET" ? "пач" : "гр"}`,
                    callback_data: `nutrition_schedule_delete:${petId}:${item.id}`,
                },
            ]);
            await ctx.reply(config?.scheduleItems.length
                ? "Текущее расписание. Нажми на слот, чтобы удалить:"
                : "Расписание пока пустое.", {
                reply_markup: {
                    inline_keyboard: [
                        ...scheduleButtons,
                        [{ text: "➕ Добавить слот", callback_data: `nutrition_schedule_add:${petId}` }],
                        [{ text: "⬅️ Назад", callback_data: `nutrition:${petId}` }],
                    ],
                },
            });
            return;
        }
        if (data.startsWith("nutrition_schedule_add:")) {
            const petId = data.split(":")[1];
            await (0, session_service_1.upsertSession)(user.id, "feeding_schedule_add", "time", { selectedPetId: petId });
            await ctx.reply("Укажи время кормления в формате ЧЧ:ММ", (0, keyboards_1.backKeyboard)());
            return;
        }
        if (data.startsWith("nutrition_schedule_delete:")) {
            const [, petId, scheduleItemId] = data.split(":");
            await (0, feeding_service_1.deleteScheduleItem)(scheduleItemId);
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
            const feedingState = await (0, feeding_service_1.getPendingScheduleItemsForToday)(petId, user.timezone);
            if (!feedingState?.pet) {
                return;
            }
            if (!feedingState.pet.feedingConfig || feedingState.pet.feedingConfig.scheduleItems.length === 0) {
                await (0, feeding_service_1.quickFeed)(petId);
                await ctx.reply("Записала прием пищи 🫶 Если хочешь вести питание детальнее, заполни нормы и расписание.", {
                    reply_markup: {
                        inline_keyboard: [[{ text: "🍽️ Перейти в питание", callback_data: `nutrition:${petId}` }]],
                    },
                });
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
                            text: `${(0, date_1.formatMinutesToHHMM)(x.minutesOfDay)} • ${x.amount} ${x.feedType === "WET" ? "пачки" : "гр"} ${x.feedType === "WET" ? "влажного" : "сухого"}`,
                            callback_data: `feed_pick:${x.id}`,
                        },
                    ]),
                },
            });
            return;
        }
        if (data.startsWith("feed_pick:")) {
            const scheduleId = data.split(":")[1];
            const schedule = await (0, feeding_service_1.logScheduledFeeding)(scheduleId);
            if (!schedule) {
                return;
            }
            await ctx.reply("Кормление записано ✅");
            return;
        }
        if (data.startsWith("events:")) {
            const petId = data.split(":")[1];
            const today = await (0, event_service_1.getTodayEventSummary)(petId, user.timezone);
            const eventsText = today.events.length
                ? today.events
                    .map((event) => {
                    const label = event.kind === "CUSTOM"
                        ? event.customEventType?.label ?? "Другое"
                        : eventLabels[event.kind];
                    return `• ${(0, dayjs_1.default)(event.createdAt).format("HH:mm")} — ${label}${event.comment ? ` (${event.comment})` : ""}`;
                })
                    .join("\n")
                : "Сегодня событий пока нет.";
            await ctx.reply(`Сводка за сегодня:\nКормления: ${today.feedings}\n${eventsText}`);
            await (0, session_service_1.upsertSession)(user.id, "event_pick", "kind", { selectedPetId: petId });
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
            await (0, session_service_1.upsertSession)(user.id, "event_comment", "comment", {
                selectedPetId: petId,
                pendingEventKind: kind,
            });
            await ctx.reply("Добавь комментарий к событию:");
            return;
        }
        if (data.startsWith("event_new:")) {
            const petId = data.split(":")[1];
            await (0, session_service_1.upsertSession)(user.id, "event_new", "name", { selectedPetId: petId });
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
            const period = periodRaw;
            const pet = await prisma_1.prisma.pet.findUnique({ where: { id: petId } });
            if (!pet) {
                return;
            }
            const range = getRangeByPeriod(period);
            const [weights, events, feedings] = await Promise.all([
                prisma_1.prisma.weightLog.findMany({ where: { petId, createdAt: { gte: range.start, lte: range.end } }, orderBy: { createdAt: "asc" } }),
                prisma_1.prisma.petEvent.findMany({ where: { petId, createdAt: { gte: range.start, lte: range.end } }, include: { customEventType: true }, orderBy: { createdAt: "asc" } }),
                prisma_1.prisma.feedingLog.findMany({ where: { petId, createdAt: { gte: range.start, lte: range.end } }, orderBy: { createdAt: "asc" } }),
            ]);
            const report = (0, reports_1.buildEventsReport)(pet.name, weights.map((x) => ({ date: (0, dayjs_1.default)(x.createdAt).format("DD.MM.YYYY HH:mm"), weightKg: x.weightKg })), events.map((x) => ({
                date: (0, dayjs_1.default)(x.createdAt).format("DD.MM.YYYY HH:mm"),
                type: x.kind === "CUSTOM" ? x.customEventType?.label ?? "Другое" : eventLabels[x.kind],
                comment: x.comment ?? "",
            })), feedings.map((x) => ({
                date: (0, dayjs_1.default)(x.createdAt).format("DD.MM.YYYY HH:mm"),
                type: "Кормление",
                comment: [x.feedType, x.amount].filter(Boolean).join(" "),
            })));
            await ctx.replyWithDocument(telegraf_1.Input.fromBuffer(report, `events_${pet.name}_${period}.xlsx`));
            return;
        }
        if (data.startsWith("events_report_custom:")) {
            const petId = data.split(":")[1];
            await (0, session_service_1.upsertSession)(user.id, "report_custom_date", "date", {
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
            await (0, pet_service_1.softDeletePet)(petId);
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
        const user = await (0, user_service_1.getUserWithSession)(BigInt(ctx.from.id));
        const session = user?.sessions[0];
        if (!user || session?.flow !== "event_new" || session.step !== "name") {
            return next();
        }
        const payload = toPayload(session.payload);
        if (!payload.selectedPetId) {
            return next();
        }
        const customType = await (0, event_service_1.upsertCustomEventType)(payload.selectedPetId, ctx.message.text.trim(), user.id);
        await (0, session_service_1.upsertSession)(user.id, "event_comment", "comment", {
            selectedPetId: payload.selectedPetId,
            pendingEventKind: "CUSTOM",
            customEventKindId: customType.id,
        });
        await ctx.reply("Супер! Теперь напиши комментарий к событию.");
    });
    return bot;
};
exports.createBot = createBot;
