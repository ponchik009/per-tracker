import type { Scenes } from "telegraf";

import { userHasPetAccess } from "../../modules/pets/pet-access.service";
import { prisma } from "../../prisma";

const deniedMessage = "Нет доступа к этому питомцу.";

export const leaveWizardIfNoPetAccess = async (
  ctx: Scenes.WizardContext,
  petId: string | undefined,
): Promise<boolean> => {
  if (!petId) {
    await ctx.reply("Сессия устарела. Открой питомца из меню снова.");
    await ctx.scene.leave();
    return false;
  }
  if (!ctx.from) {
    await ctx.scene.leave();
    return false;
  }
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
    select: { id: true },
  });
  if (!user) {
    await ctx.scene.leave();
    return false;
  }
  if (!(await userHasPetAccess(user.id, petId))) {
    await ctx.reply(deniedMessage);
    await ctx.scene.leave();
    return false;
  }
  return true;
};
