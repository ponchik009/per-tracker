import { prisma } from "../../../prisma";
import { softDeletePet } from "../../../modules/pets/pet.service";
import { deleteConfirmInlineKeyboard } from "../../ui/inline/pet.inline";
import { weightActionsInlineKeyboard } from "../../ui/inline/reports.inline";
import { sendHomeMenu } from "../home.handler";
import { replyPetEditMenu, replyPetInfo, replyPetMenu } from "../pet.handler";
import { PrefixCallbackRoute } from "./callback-route.types";

export const petPrefixRoutes: PrefixCallbackRoute[] = [
  {
    prefix: "pet:",
    handle: async ({ ctx }, data) => {
      const petId = data.split(":")[1];
      await replyPetMenu(ctx, petId);
    },
  },
  {
    prefix: "pet_info:",
    handle: async ({ ctx }, data) => {
      await replyPetInfo(ctx, data.split(":")[1]);
    },
  },
  {
    prefix: "pet_edit_menu:",
    handle: async ({ ctx }, data) => {
      await replyPetEditMenu(ctx, data.split(":")[1]);
    },
  },
  {
    prefix: "pet_edit:",
    handle: async ({ ctx }, data) => {
      const [, petId, field] = data.split(":");
      await ctx.scene.enter("PET_EDIT", { petId, field });
    },
  },
  {
    prefix: "weight:",
    handle: async ({ ctx }, data) => {
      const petId = data.split(":")[1];
      const logs = await prisma.weightLog.findMany({
        where: { petId },
        orderBy: { createdAt: "desc" },
        take: 4,
      });
      const trend = logs.length > 1 ? logs[0].weightKg - logs.at(-1)!.weightKg : 0;
      await ctx.reply(
        `Текущий вес: ${logs[0]?.weightKg ?? "—"} кг\nИзменение за период: ${trend >= 0 ? "+" : ""}${trend.toFixed(2)} кг`,
        { reply_markup: { inline_keyboard: weightActionsInlineKeyboard(petId) } },
      );
    },
  },
  {
    prefix: "weight_edit:",
    handle: async ({ ctx }, data) => {
      const petId = data.split(":")[1];
      await ctx.scene.enter("WEIGHT_UPDATE", { petId });
    },
  },
  {
    prefix: "delete:",
    handle: async ({ ctx }, data) => {
      const petId = data.split(":")[1];
      await ctx.reply("Точно удалить питомца из вашего списка?", {
        reply_markup: { inline_keyboard: deleteConfirmInlineKeyboard(petId) },
      });
    },
  },
  {
    prefix: "delete_confirm:",
    handle: async ({ bot, ctx }, data) => {
      const petId = data.split(":")[1];
      await softDeletePet(petId);
      await ctx.reply("Питомец скрыт из списка.");
      if (!ctx.chat || !ctx.from) {
        return;
      }
      await sendHomeMenu(bot, BigInt(ctx.from.id), ctx.chat.id);
    },
  },
];
