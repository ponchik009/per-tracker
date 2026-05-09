type ExactRoute<Context> = {
  key: string;
  handle: (context: Context) => Promise<void>;
};

type PrefixRoute<Context> = {
  prefix: string;
  handle: (context: Context, value: string) => Promise<void>;
};

type DispatchOptions<Context> = {
  context: Context;
  value: string;
  exactRoutes?: ExactRoute<Context>[];
  prefixRoutes?: PrefixRoute<Context>[];
};

export const dispatchByExactAndPrefix = async <Context>({
  context,
  value,
  exactRoutes = [],
  prefixRoutes = [],
}: DispatchOptions<Context>) => {
  const exact = exactRoutes.find((route) => route.key === value);
  if (exact) {
    await exact.handle(context);
    return true;
  }

  const sortedPrefixes = [...prefixRoutes].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const route of sortedPrefixes) {
    if (value.startsWith(route.prefix)) {
      await route.handle(context, value);
      return true;
    }
  }

  return false;
};
