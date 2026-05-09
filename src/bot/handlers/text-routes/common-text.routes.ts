import { clearSession } from "../../../modules/sessions/session.service";
import { BACK_TEXT } from "../../ui/keyboards";
import { sendHomeMenu } from "../home.handler";
import { TextRouteContext, TextExactRoute } from "./text-route.types";

export const handleCommonBackText = async ({
  bot,
  ctx,
  user,
}: TextRouteContext) => {
  await clearSession(user.id);
  if (!ctx.chat || !ctx.from) {
    return;
  }

  await sendHomeMenu(bot, BigInt(ctx.from.id), ctx.chat.id);
};

export const commonTextExactRoutes: TextExactRoute[] = [
  {
    key: BACK_TEXT,
    handle: handleCommonBackText,
  },
];
