import { clearSession } from "../../../modules/sessions/session.service";
import { sendHomeMenu } from "../home.handler";
import { ExactCallbackRoute } from "./callback-route.types";

export const commonExactRoutes: ExactCallbackRoute[] = [
  {
    key: "pet:add",
    handle: async ({ ctx, user }) => {
      await clearSession(user.id);
      await ctx.scene.enter("CREATE_PET");
    },
  },
  {
    key: "home",
    handle: async ({ bot, ctx }) => {
      if (!ctx.chat || !ctx.from) {
        return;
      }
      await sendHomeMenu(bot, BigInt(ctx.from.id), ctx.chat.id);
    },
  },
  {
    key: "share:open",
    handle: async ({ ctx, user }) => {
      const firstPet = user.pets.find((x) => !x.pet.isDeleted)?.pet;
      await ctx.reply(
        firstPet
          ? `Код доступа для шаринга: \`${firstPet.id}\`\nОтправь его второму пользователю.`
          : "Сначала добавь питомца, потом можно делиться доступом.",
        { parse_mode: "Markdown" },
      );
      await clearSession(user.id);
      await ctx.scene.enter("SHARE_JOIN");
    },
  },
];
