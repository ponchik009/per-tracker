import { Middleware } from "telegraf";
import { WizardContext } from "telegraf/scenes";

/**
 * Guard для проверки наличия текста в сообщении пользователя.
 * Если текст отсутствует – отправляет предупреждение и прерывает выполнение.
 * Если текст есть – вызывает next() и передаёт управление дальше по шагу.
 */
export const textGuard =
  (replyText?: string): Middleware<WizardContext> =>
  async (ctx, next) => {
    if (ctx.message && "text" in ctx.message) {
      return next();
    }

    await ctx.reply(
      replyText ?? "⚠️ Пожалуйста, отправьте **текстовое сообщение**.",
      {
        parse_mode: "Markdown",        
      },
    );
  };
