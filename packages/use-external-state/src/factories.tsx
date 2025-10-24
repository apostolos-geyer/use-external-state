'use client';

import {
  createContext,
  use,
  useMemo,
  type ComponentType,
  type PropsWithChildren,
  type JSX,
} from 'react';
import type { z } from 'zod';

import type {
  ExternalStateAdapter,
  UseExternalStateOptions,
  UseExternalStateResult,
} from './types';
import { useExternalState } from './use-external-state';

type HookParams<TValue, TConfig> = {
  schema: z.ZodType<TValue>;
  options?: UseExternalStateOptions<z.ZodType<TValue>>;
} & (TConfig extends undefined | void ? { config?: TConfig } : { config: TConfig });

export type ExternalStateHook<TValue, TConfig> = (
  params: HookParams<TValue, TConfig>,
) => UseExternalStateResult<TValue>;

export function makeHook<TValue, TConfig>(
  adapterFactory: (config: TConfig) => ExternalStateAdapter<TValue>,
): ExternalStateHook<TValue, TConfig> {
  return function useGeneratedExternalState(
    params: HookParams<TValue, TConfig>,
  ): UseExternalStateResult<TValue> {
    const { schema, options } = params;
    const config = (params as { config?: TConfig }).config as TConfig;

    const adapter = useMemo(() => adapterFactory(config), [config]);

    return useExternalState(adapter, schema, options);
  };
}

interface ContextOptions {
  displayName?: string;
  missingProviderMessage?: string;
}

export function makeContext<TValue, TConfig>(
  useBoundExternalState: ExternalStateHook<TValue, TConfig>,
  options?: ContextOptions,
) {
  const Context = createContext<UseExternalStateResult<TValue> | null>(null);
  if (options?.displayName) {
    Context.displayName = options.displayName;
  }

  type ProviderProps = PropsWithChildren<HookParams<TValue, TConfig>>;

  function Provider({ children, ...rest }: ProviderProps): JSX.Element {
    const value = useBoundExternalState(rest as unknown as HookParams<TValue, TConfig>);
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useExternalStateFromContext(): UseExternalStateResult<TValue> {
    const value = use(Context);
    if (value === null) {
      const baseMessage =
        options?.missingProviderMessage ??
        'useExternalState context was accessed outside of its Provider.';
      const name = Context.displayName;
      throw new Error(name ? `${baseMessage} (${name})` : baseMessage);
    }
    return value;
  }

  return { Provider, use: useExternalStateFromContext, Context } as const;
}

interface HocOptions {
  displayName?: string;
}

export function makeHOC<TValue, TConfig>(
  useBoundExternalState: ExternalStateHook<TValue, TConfig>,
  options?: HocOptions,
) {
  return function withExternalState<P extends object>(
    Component: ComponentType<P & { externalState: UseExternalStateResult<TValue> }>,
  ) {
    type WrapperProps = P & HookParams<TValue, TConfig>;

    const Wrapped = (props: WrapperProps): JSX.Element => {
      const {
        schema,
        config,
        options: hookOptions,
        ...rest
      } = props as HookParams<TValue, TConfig> & P;

      const state = useBoundExternalState({
        schema,
        config: config as TConfig,
        options: hookOptions,
      } as unknown as HookParams<TValue, TConfig>);

      return <Component {...(rest as P)} externalState={state} />;
    };

    const componentName = Component.displayName ?? Component.name ?? 'Component';
    Wrapped.displayName = options?.displayName ?? `WithExternalState(${componentName})`;

    return Wrapped;
  };
}

export type { HookParams };
