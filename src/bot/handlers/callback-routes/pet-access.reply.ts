import { Scenes } from "telegraf";

import { userHasPetAccess } from "../../../modules/pets/pet-access.service";
import type { CallbackUser } from "../../../types/callback-user";

const deniedMessage = "Нет доступа к этому питомцу.";

export const replyIfNoPetAccess = async (
  ctx: Scenes.WizardContext,
  user: CallbackUser,
  petId: string,
): Promise<boolean> => {
  if (await userHasPetAccess(user.id, petId)) {
    return true;
  }
  await ctx.reply(deniedMessage);
  return false;
};
