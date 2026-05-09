import { Scenes, Telegraf } from "telegraf";

import { commonExactRoutes } from "./callback-routes/common.routes";
import { eventsPrefixRoutes } from "./callback-routes/events.routes";
import { feedingPrefixRoutes } from "./callback-routes/feeding.routes";
import { petPrefixRoutes } from "./callback-routes/pet.routes";
import { reportsPrefixRoutes } from "./callback-routes/reports.routes";
import { CallbackUser } from "./callback-routes/callback-route.types";
import { dispatchByExactAndPrefix } from "./router-dispatcher";

export const handleCallbackQuery = async (
  bot: Telegraf<any>,
  ctx: Scenes.WizardContext,
  user: CallbackUser,
  data: string,
) => {
  const context = { bot, ctx, user };
  const prefixRoutes = [
    ...petPrefixRoutes,
    ...feedingPrefixRoutes,
    ...eventsPrefixRoutes,
    ...reportsPrefixRoutes,
  ];
  return dispatchByExactAndPrefix({
    context,
    value: data,
    exactRoutes: commonExactRoutes,
    prefixRoutes,
  });
};
