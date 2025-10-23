'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';

import type {
  ExternalStateAdapter,
  ExternalStateStore,
} from '@apostoli/use-external-state';
import { createStoreEmitter } from '@apostoli/use-external-state';

type SerializedRecord = Record<string, string | (string | null)[] | null | undefined>;

export type QueryParameterStoreConfig<TValue> = Partial<{
  history: 'replace' | 'push';
  preserveUnknownKeys: boolean;
  serialize: (value: TValue) => SerializedRecord;
  parse: (params: URLSearchParams) => TValue | undefined;
}>;

const DEFAULT_HISTORY: 'replace' | 'push' = 'replace';

function normalizeValue(value: unknown): SerializedRecord {
  const record: SerializedRecord = {};
  if (!value || typeof value !== 'object') return record;

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (entry === undefined) {
      return;
    }
    if (entry === null) {
      record[key] = null;
      return;
    }
    if (Array.isArray(entry)) {
      record[key] = entry.map((item) => (item === null ? null : String(item))) as (
        | string
        | null
      )[];
      return;
    }
    record[key] = String(entry);
  });

  return record;
}

function defaultParse(params: URLSearchParams) {
  const result: SerializedRecord = {};
  params.forEach((_value, key) => {
    const values = params.getAll(key);
    if (values.length === 0) return;
    if (values.length === 1) {
      result[key] = values[0] === 'null' ? null : values[0];
    } else {
      result[key] = values.map((item) => (item === 'null' ? null : item));
    }
  });
  return result;
}

export function QueryParameterStore<TValue>(
  config: QueryParameterStoreConfig<TValue> = {},
): ExternalStateAdapter<TValue> {
  const {
    history = DEFAULT_HISTORY,
    preserveUnknownKeys = true,
    serialize,
    parse,
  } = config;

  return {
    id: '@apostoli/use-external-state/next:query-parameters',
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

      const read = useCallback<ExternalStateStore<TValue>['read']>(() => {
        if (!isBrowser()) {
          return undefined;
        }
        const params = new URLSearchParams(searchParams.toString());
        const activeParse = parseRef.current;
        if (activeParse) {
          return activeParse(params);
        }
        return defaultParse(params) as TValue;
      }, [searchParams]);

      const write = useCallback<ExternalStateStore<TValue>['write']>(
        (value) => {
          if (!isBrowser() || !pathname) {
            return;
          }

          const preserve = preserveRef.current ?? true;
          const baseParams = preserve
            ? new URLSearchParams(searchParams.toString())
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
          const href = (serialized ? `${pathname}?${serialized}` : pathname) as Route;
          const mode = historyRef.current ?? DEFAULT_HISTORY;

          if (mode === 'push') {
            router.push(href, { scroll: false });
          } else {
            router.replace(href, { scroll: false });
          }

          emitterRef.current.emit();
        },
        [pathname, router, searchParams],
      );

      const subscribe = useCallback<ExternalStateStore<TValue>['subscribe']>(
        (listener) => emitterRef.current.subscribe(listener),
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
