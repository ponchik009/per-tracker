import { Middleware } from "telegraf";
import { WizardContext } from "telegraf/scenes";

/**
 * Guard для проверки наличия текста в сообщении пользователя.
 * Если текст отсутствует – отправляет предупреждение и прерывает выполнение.
 * Если текст есть – вызывает next() и передаёт управление дальше по шагу.
 */
export const textOrCommandGuard =
  (replyText?: string): Middleware<WizardContext> =>
  async (ctx, next) => {
    if (ctx.message && "text" in ctx.message) {
      return next();
    }

    if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
      return next();
    }

    await ctx.reply(
      replyText ?? "🚫 Нераспознанная команда. Пожалуйста, отправь текст или нажми **Пропустить**",
      {
        parse_mode: "Markdown",        
      },
    );
  };
