import { WizardContext } from "telegraf/scenes";

export function assertHasTextOrCommand(
  ctx: WizardContext,
): asserts ctx is WizardContext & { message: { text: string } } {
  if (
    (!ctx.message || !("text" in ctx.message)) &&
    (!ctx.callbackQuery || !("data" in ctx.callbackQuery))
  ) {
    throw new Error("No text message or command");
  }
}
