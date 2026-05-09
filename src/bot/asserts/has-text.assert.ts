import { WizardContext } from "telegraf/scenes";

export function assertHasText(
  ctx: WizardContext,
): asserts ctx is WizardContext & { message: { text: string } } {
  if (!ctx.message || !("text" in ctx.message)) {
    throw new Error("No text message");
  }
}
