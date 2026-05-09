import { Scenes, Telegraf } from "telegraf";

export type TextRouteUser = {
  id: string;
  telegramId: bigint;
  sessions: Array<{ flow: string; step: string }>;
};

export type TextRouteContext = {
  bot: Telegraf<any>;
  ctx: Scenes.WizardContext;
  user: TextRouteUser;
  text: string;
};

export type TextFlowRoute = {
  prefix: string;
  handle: (context: TextRouteContext, value: string) => Promise<void>;
};

export type TextExactRoute = {
  key: string;
  handle: (context: TextRouteContext) => Promise<void>;
};
