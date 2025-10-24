'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { ExternalStateAdapter, ExternalStateStore } from '../types';
import { createStoreEmitter } from '../emitter';
import { defaultParse, normalizeValue, type SerializedRecord } from '../internal/query-params';

const DEFAULT_HISTORY: 'replace' | 'push' = 'replace';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export type QueryParameterStoreConfig<TValue> = Partial<{
  history: 'replace' | 'push';
  preserveUnknownKeys: boolean;
  serialize: (value: TValue) => SerializedRecord;
  parse: (params: URLSearchParams) => TValue | undefined;
}>;

export function QueryParameterStore<TValue>(
  config: QueryParameterStoreConfig<TValue> = {},
): ExternalStateAdapter<TValue> {
  return {
    id: '@1apostoli/use-external-state:query-parameters',
    useStore() {
      const emitterRef = useRef(createStoreEmitter());
      const managedKeysRef = useRef<Set<string>>(new Set());
      const lastSerializedRef = useRef<string>('');
      const historyRef = useRef(config.history ?? DEFAULT_HISTORY);
      historyRef.current = config.history ?? DEFAULT_HISTORY;
      const preserveRef = useRef(config.preserveUnknownKeys ?? true);
      preserveRef.current = config.preserveUnknownKeys ?? true;
      const serializeRef = useRef(config.serialize);
      serializeRef.current = config.serialize;
      const parseRef = useRef(config.parse);
      parseRef.current = config.parse;

      const read = useCallback<ExternalStateStore<TValue>['read']>(() => {
        if (!isBrowser()) {
          return undefined;
        }
        const params = new URLSearchParams(window.location.search);
        lastSerializedRef.current = params.toString();
        const parser = parseRef.current;
        if (parser) {
          return parser(params);
        }
        const parsed = defaultParse(params);
        return parsed === undefined ? undefined : (parsed as TValue);
      }, []);

      const write = useCallback<ExternalStateStore<TValue>['write']>(
        (value) => {
          if (!isBrowser()) {
            return;
          }

          const preserve = preserveRef.current ?? true;
          const baseParams = preserve
            ? new URLSearchParams(window.location.search)
            : new URLSearchParams();

          managedKeysRef.current.forEach((key) => baseParams.delete(key));

          const nextKeys = new Set<string>();

          if (value !== undefined) {
            const serializer = serializeRef.current;
            const mapped: SerializedRecord = serializer
              ? serializer(value)
              : normalizeValue(value);

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
          const pathname = window.location.pathname;
          const href = serialized ? `${pathname}?${serialized}` : pathname;
          const mode = historyRef.current ?? DEFAULT_HISTORY;

          if (mode === 'push') {
            window.history.pushState(null, '', href);
          } else {
            window.history.replaceState(null, '', href);
          }

          emitterRef.current.emit();
        },
        [],
      );

      const subscribe = useCallback<ExternalStateStore<TValue>['subscribe']>(
        (listener) => {
          if (!isBrowser()) {
            return () => {};
          }

          const unsubscribe = emitterRef.current.subscribe(listener);
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
        if (!isBrowser()) {
          return;
        }
        lastSerializedRef.current = window.location.search.replace(/^\?/, '');
      }, []);

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

export {
  normalizeValue as normalizeQueryValue,
  defaultParse as defaultQueryParse,
} from '../internal/query-params';
export type { SerializedRecord } from '../internal/query-params';
