import {
  deleteScheduleItem,
  getFeedingConfigWithSchedule,
  getPendingScheduleItemsForToday,
  logScheduledFeeding,
  quickFeed,
} from "../../../modules/feeding/feeding.service";
import { getPetIdForFeedingScheduleId } from "../../../modules/pets/pet-access.service";
import { formatMinutesToHHMM } from "../../../utils/date";
import {
  feedingMenuInlineKeyboard,
  feedingScheduleInlineKeyboard,
  openScheduleInlineKeyboard,
  quickFeedInlineKeyboard,
} from "../../ui/inline/feeding.inline";
import { openPetCardInlineKeyboard } from "../../ui/inline/pet.inline";
import { PrefixCallbackRoute } from "./callback-route.types";
import { replyIfNoPetAccess } from "./pet-access.reply";

export const feedingPrefixRoutes: PrefixCallbackRoute[] = [
  {
    prefix: "nut:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.reply("Раздел питания:", {
        reply_markup: { inline_keyboard: feedingMenuInlineKeyboard(petId) },
      });
    },
  },
  {
    prefix: "nut_norm:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.scene.enter("FEEDING_EDIT", { petId });
    },
  },
  {
    prefix: "nut_sch:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      const config = await getFeedingConfigWithSchedule(petId);
      await ctx.reply(
        config?.scheduleItems.length
          ? "Текущее расписание. Нажми на слот, чтобы удалить:"
          : "Расписание пока пустое.",
        {
          reply_markup: {
            inline_keyboard: feedingScheduleInlineKeyboard(
              petId,
              (config?.scheduleItems ?? []).map((item) => ({
                id: item.id,
                minutesOfDay: item.minutesOfDay,
                amount: item.amount,
                feedType: item.feedType as "WET" | "DRY",
              })),
            ),
          },
        },
      );
    },
  },
  {
    prefix: "nut_sch_add:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.scene.enter("FEEDING_SCHEDULE_ADD", { petId });
    },
  },
  {
    prefix: "nsd:",
    handle: async ({ ctx, user }, data) => {
      const scheduleItemId = data.split(":")[1];
      const petId = await getPetIdForFeedingScheduleId(scheduleItemId);
      if (!petId || !(await replyIfNoPetAccess(ctx, user, petId))) {
        return;
      }
      await deleteScheduleItem(scheduleItemId);
      await ctx.reply("Слот удален ✅");
      await ctx.reply("Открой раздел расписания снова для просмотра обновлений.", {
        reply_markup: { inline_keyboard: openScheduleInlineKeyboard(petId) },
      });
    },
  },
  {
    prefix: "feed:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      const feedingState = await getPendingScheduleItemsForToday(petId, user.timezone);
      if (!feedingState?.pet) return;

      if (
        !feedingState.pet.feedingConfig ||
        feedingState.pet.feedingConfig.scheduleItems.length === 0
      ) {
        await quickFeed(petId);
        await ctx.reply(
          "Записала прием пищи 🫶 Если хочешь вести питание детальнее, заполни нормы и расписание.",
          { reply_markup: { inline_keyboard: quickFeedInlineKeyboard(petId) } },
        );
        return;
      }

      const pending = feedingState.pending;
      if (!pending.length) {
        await ctx.reply("Все плановые кормления на сегодня уже отмечены ✅", {
          reply_markup: { inline_keyboard: openPetCardInlineKeyboard(petId) },
        });
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
    },
  },
  {
    prefix: "feed_pick:",
    handle: async ({ ctx, user }, data) => {
      const scheduleId = data.split(":")[1];
      const petId = await getPetIdForFeedingScheduleId(scheduleId);
      if (!petId || !(await replyIfNoPetAccess(ctx, user, petId))) {
        return;
      }
      const schedule = await logScheduledFeeding(scheduleId);
      if (!schedule) {
        return;
      }
      await ctx.reply("Кормление записано ✅", {
        reply_markup: { inline_keyboard: openPetCardInlineKeyboard(schedule.feedingConfig.petId) },
      });
    },
  },
];
