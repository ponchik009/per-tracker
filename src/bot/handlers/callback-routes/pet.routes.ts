import { softDeletePet } from "../../../modules/pets/pet.service";
import { listRecentWeightLogsDescending } from "../../../modules/weight/weight.service";
import { deleteConfirmInlineKeyboard } from "../../ui/inline/pet.inline";
import { weightActionsInlineKeyboard } from "../../ui/inline/reports.inline";
import { sendHomeMenu } from "../home.handler";
import { replyPetEditMenu, replyPetInfo, replyPetMenu } from "../pet.handler";
import { PrefixCallbackRoute } from "./callback-route.types";
import { replyIfNoPetAccess } from "./pet-access.reply";

export const petPrefixRoutes: PrefixCallbackRoute[] = [
  {
    prefix: "pet:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await replyPetMenu(ctx, petId);
    },
  },
  {
    prefix: "pet_info:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await replyPetInfo(ctx, petId);
    },
  },
  {
    prefix: "pet_edit_menu:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await replyPetEditMenu(ctx, petId);
    },
  },
  {
    prefix: "pet_edit:",
    handle: async ({ ctx, user }, data) => {
      const [, petId, field] = data.split(":");
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.scene.enter("PET_EDIT", { petId, field });
    },
  },
  {
    prefix: "weight:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      const logs = await listRecentWeightLogsDescending(petId, 4);
      const trend = logs.length > 1 ? logs[0].weightKg - logs.at(-1)!.weightKg : 0;
      await ctx.reply(
        `Текущий вес: ${logs[0]?.weightKg ?? "—"} кг\nИзменение за период: ${trend >= 0 ? "+" : ""}${trend.toFixed(2)} кг`,
        { reply_markup: { inline_keyboard: weightActionsInlineKeyboard(petId) } },
      );
    },
  },
  {
    prefix: "weight_edit:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.scene.enter("WEIGHT_UPDATE", { petId });
    },
  },
  {
    prefix: "delete:",
    handle: async ({ ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await ctx.reply("Точно удалить питомца из вашего списка?", {
        reply_markup: { inline_keyboard: deleteConfirmInlineKeyboard(petId) },
      });
    },
  },
  {
    prefix: "delete_confirm:",
    handle: async ({ bot, ctx, user }, data) => {
      const petId = data.split(":")[1];
      if (!(await replyIfNoPetAccess(ctx, user, petId))) return;
      await softDeletePet(petId);
      await ctx.reply("Питомец скрыт из списка.");
      if (!ctx.chat || !ctx.from) {
        return;
      }
      await sendHomeMenu(bot, BigInt(ctx.from.id), ctx.chat.id);
    },
  },
];
