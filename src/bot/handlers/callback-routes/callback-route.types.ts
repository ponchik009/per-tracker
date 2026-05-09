import { Scenes, Telegraf } from "telegraf";

export type CallbackUser = {
  id: string;
  timezone: string;
  pets: Array<{ pet: { id: string; isDeleted: boolean } }>;
};

export type CallbackRouteContext = {
  bot: Telegraf<any>;
  ctx: Scenes.WizardContext;
  user: CallbackUser;
};

export type ExactCallbackRoute = {
  key: string;
  handle: (context: CallbackRouteContext) => Promise<void>;
};

export type PrefixCallbackRoute = {
  prefix: string;
  handle: (context: CallbackRouteContext, data: string) => Promise<void>;
};
