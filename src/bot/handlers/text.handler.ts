import { Scenes, Telegraf } from "telegraf";

import { BACK_TEXT } from "../ui/keyboards";
import { dispatchByExactAndPrefix } from "./router-dispatcher";
import { commonTextExactRoutes } from "./text-routes/common-text.routes";
import { onboardingTextRoutes } from "./text-routes/onboarding-text.routes";
import { TextRouteUser } from "./text-routes/text-route.types";

export const handleTextMessage = async (
  bot: Telegraf<any>,
  ctx: Scenes.WizardContext,
  user: TextRouteUser,
  text: string,
) => {
  const session = user.sessions[0];
  if (!session?.flow) {
    return false;
  }

  const context = { bot, ctx, user, text };
  const value = text === BACK_TEXT ? text : `${session.flow}:${session.step}`;
  return dispatchByExactAndPrefix({
    context,
    value,
    exactRoutes: commonTextExactRoutes,
    prefixRoutes: onboardingTextRoutes,
  });
};
