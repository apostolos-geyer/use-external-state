'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';

import type {
  ExternalStateAdapter,
  ExternalStateStore,
} from '@1apostoli/use-external-state';
import {
  createStoreEmitter,
  defaultQueryParse,
  normalizeQueryValue,
  type SerializedRecord,
} from '@1apostoli/use-external-state';

export interface QueryParameterNavigationConfig {
  mode?: 'history' | 'router';
}

export type QueryParameterStoreConfig<TValue> = Partial<{
  history: 'replace' | 'push';
  preserveUnknownKeys: boolean;
  serialize: (value: TValue) => SerializedRecord;
  parse: (params: URLSearchParams) => TValue | undefined;
  navigation: QueryParameterNavigationConfig;
}>;

const DEFAULT_HISTORY: 'replace' | 'push' = 'replace';

export function QueryParameterStore<TValue>(
  config: QueryParameterStoreConfig<TValue> = {},
): ExternalStateAdapter<TValue> {
  const {
    history = DEFAULT_HISTORY,
    preserveUnknownKeys = true,
    serialize,
    parse,
    navigation,
  } = config;

  return {
    id: '@1apostoli/use-external-state-next:query-parameters',
    useStore() {
      const router = useRouter();
      const pathname = usePathname();
      const searchParams = useSearchParams();
      const emitterRef = useRef(createStoreEmitter());
      const lastSerializedRef = useRef<string>('');
      const managedKeysRef = useRef<Set<string>>(new Set());
      const parseRef = useRef(parse);
      parseRef.current = parse;
      const serializeRef = useRef(serialize);
      serializeRef.current = serialize;
      const historyRef = useRef(history);
      historyRef.current = history;
      const preserveRef = useRef(preserveUnknownKeys);
      preserveRef.current = preserveUnknownKeys;
      const navigationMode = navigation?.mode ?? 'router';
      const navigationModeRef = useRef<'router' | 'history'>(navigationMode);
      navigationModeRef.current = navigationMode;

      const read = useCallback<ExternalStateStore<TValue>['read']>(() => {
        if (!isBrowser()) {
          return undefined;
        }
        const params = new URLSearchParams(searchParams.toString());
        lastSerializedRef.current = params.toString();
        const activeParse = parseRef.current;
        if (activeParse) {
          return activeParse(params);
        }
        const parsed = defaultQueryParse(params);
        return parsed === undefined ? undefined : (parsed as TValue);
      }, [searchParams]);

      const routerNavigate = useCallback(
        (href: Route, mode: 'replace' | 'push') => {
          if (mode === 'push') {
            router.push(href, { scroll: false });
          } else {
            router.replace(href, { scroll: false });
          }
        },
        [router],
      );

      const write = useCallback<ExternalStateStore<TValue>['write']>(
        (value) => {
          if (!isBrowser() || !pathname) {
            return;
          }

          const preserve = preserveRef.current ?? true;
          const baseSnapshot =
            navigationModeRef.current === 'history'
              ? window.location.search
              : searchParams.toString();
          const baseParams = preserve
            ? new URLSearchParams(baseSnapshot)
            : new URLSearchParams();

          managedKeysRef.current.forEach((key) => baseParams.delete(key));

          const nextKeys = new Set<string>();

          if (value !== undefined) {
            const serializer = serializeRef.current;
            const mapped: SerializedRecord = serializer
              ? serializer(value)
              : normalizeQueryValue(value);

            Object.entries(mapped).forEach(([key, entry]) => {
              baseParams.delete(key);
              nextKeys.add(key);

              if (entry === undefined) {
                return;
              }
              if (entry === null) {
                baseParams.set(key, 'null');
                return;
              }
              if (Array.isArray(entry)) {
                entry.forEach((item) =>
                  baseParams.append(key, item === null ? 'null' : item),
                );
                return;
              }
              baseParams.set(key, entry);
            });
          }

          managedKeysRef.current = nextKeys;

          const serialized = baseParams.toString();
          if (serialized === lastSerializedRef.current) {
            return;
          }

          lastSerializedRef.current = serialized;
          const mode = historyRef.current ?? DEFAULT_HISTORY;
          const url = serialized ? `${pathname}?${serialized}` : pathname;
          const navigationMode = navigationModeRef.current ?? 'router';

          if (navigationMode === 'router') {
            routerNavigate(url as Route, mode);
          } else {
            if (mode === 'push') {
              window.history.pushState(null, '', url);
            } else {
              window.history.replaceState(null, '', url);
            }
          }

          emitterRef.current.emit();
        },
        [pathname, routerNavigate, searchParams],
      );

      const subscribe = useCallback<ExternalStateStore<TValue>['subscribe']>(
        (listener) => {
          const unsubscribe = emitterRef.current.subscribe(listener);
          if (!isBrowser()) {
            return () => {
              unsubscribe();
            };
          }
          const handlePopState = () => {
            const current = window.location.search.replace(/^\?/, '');
            if (current !== lastSerializedRef.current) {
              lastSerializedRef.current = current;
              emitterRef.current.emit();
            }
          };
          window.addEventListener('popstate', handlePopState);
          return () => {
            window.removeEventListener('popstate', handlePopState);
            unsubscribe();
          };
        },
        [],
      );

      const isAvailable = useCallback<ExternalStateStore<TValue>['isAvailable']>(
        () => isBrowser(),
        [],
      );

      useEffect(() => {
        const current = searchParams.toString();
        if (current !== lastSerializedRef.current) {
          lastSerializedRef.current = current;
          emitterRef.current.emit();
        }
      }, [searchParams]);

      return useMemo<ExternalStateStore<TValue>>(
        () => ({
          read,
          write,
          subscribe,
          isAvailable,
        }),
        [isAvailable, read, subscribe, write],
      );
    },
  };
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
