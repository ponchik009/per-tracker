import { TextFlowRoute } from "./text-route.types";
import { handleOnboardingRefText } from "../onboarding.handler";

export const onboardingTextRoutes: TextFlowRoute[] = [
  {
    prefix: "onboarding:ask_ref",
    handle: async ({ bot, ctx, user, text }) => {
      await handleOnboardingRefText(bot, ctx, user, text);
    },
  },
];
