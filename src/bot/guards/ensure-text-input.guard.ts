import { Scenes } from "telegraf";

import { textGuard } from "./text.guard";

export const ensureTextInput = async (
  ctx: Scenes.WizardContext,
  replyText?: string,
) => {
  let passed = false;
  const guard = textGuard(replyText) as (
    context: Scenes.WizardContext,
    next: () => Promise<void>,
  ) => Promise<unknown>;
  await guard(ctx, async () => {
    passed = true;
  });

  return passed;
};
