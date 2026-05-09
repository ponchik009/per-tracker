import { Scenes, Telegraf } from "telegraf";

import type { CallbackUser } from "../../../types/callback-user";

export type { CallbackUser };

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
