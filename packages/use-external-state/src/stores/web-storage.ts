import { useCallback, useEffect, useMemo, useRef } from 'react';

import { createStoreEmitter } from '../emitter';
import { isBrowser } from '../internal/is-browser';
import type { ExternalStateAdapter, ExternalStateStore } from '../types';

export interface StorageSerializer<TValue> {
  serialize(value: TValue): string;
  deserialize(raw: string): TValue;
}

const defaultJsonSerializer: StorageSerializer<unknown> = {
  serialize(value) {
    return JSON.stringify(value) ?? 'null';
  },
  deserialize(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },
};

export interface WebStorageAdapterConfig<TValue> {
  key: string;
  serializer?: StorageSerializer<TValue>;
  storage?: Storage;
}

function safeGetStorage(target: 'localStorage' | 'sessionStorage'): Storage | undefined {
  if (!isBrowser()) {
    return undefined;
  }

  try {
    return window[target];
  } catch {
    return undefined;
  }
}

export function createWebStorageAdapter<TValue>(
  id: string,
  target: 'localStorage' | 'sessionStorage',
  config: WebStorageAdapterConfig<TValue>,
): ExternalStateAdapter<TValue> {
  const { key, serializer: serializerOverride, storage: storageOverride } = config;

  return {
    id,
    useStore() {
      const serializer = useMemo(
        () => serializerOverride ?? (defaultJsonSerializer as StorageSerializer<TValue>),
        [],
      );

      const storage = useMemo(() => storageOverride ?? safeGetStorage(target), []);

      const emitterRef = useRef(createStoreEmitter());
      const storageRef = useRef(storage);
      storageRef.current = storage;
      const keyRef = useRef(key);
      const lastSerializedRef = useRef<string | null>(null);
      const lastValueRef = useRef<TValue | undefined>(undefined);

      const read = useCallback<ExternalStateStore<TValue>['read']>(() => {
        const activeStorage = storageRef.current;
        const storageKey = keyRef.current;
        if (!activeStorage) {
          return undefined;
        }
        try {
          const raw = storageKey ? activeStorage.getItem(storageKey) : null;
          if (raw === null) {
            lastSerializedRef.current = null;
            lastValueRef.current = undefined;
            return undefined;
          }
          if (raw === lastSerializedRef.current) {
            return lastValueRef.current;
          }
          const parsed = serializer.deserialize(raw);
          lastSerializedRef.current = raw;
          lastValueRef.current = parsed;
          return parsed;
        } catch (error) {
          if (error instanceof Error) {
            console.warn(
              `useBrowserState: failed to read "${storageKey ?? key}" from storage`,
              error,
            );
          } else {
            console.warn(
              `useBrowserState: failed to read "${storageKey ?? key}" from storage`,
              String(error),
            );
          }
          return undefined;
        }
      }, [serializer]);

      const write = useCallback<ExternalStateStore<TValue>['write']>(
        (value) => {
          const activeStorage = storageRef.current;
          const storageKey = keyRef.current ?? key;
          if (!activeStorage) {
            return;
          }

          try {
            if (value === undefined) {
              if (
                lastSerializedRef.current === null &&
                lastValueRef.current === undefined
              ) {
                return;
              }
              activeStorage.removeItem(storageKey);
              lastSerializedRef.current = null;
              lastValueRef.current = undefined;
            } else {
              const serialized = serializer.serialize(value);
              if (serialized === lastSerializedRef.current) {
                if (!Object.is(lastValueRef.current, value)) {
                  lastValueRef.current = value;
                }
                return;
              }
              activeStorage.setItem(storageKey, serialized);
              lastSerializedRef.current = serialized;
              lastValueRef.current = value;
            }
          } catch (error) {
            if (error instanceof Error) {
              console.warn(
                `useBrowserState: failed to write "${storageKey}" to storage`,
                error,
              );
            } else {
              console.warn(
                `useBrowserState: failed to write "${storageKey}" to storage`,
                String(error),
              );
            }
          }

          emitterRef.current.emit();
        },
        [serializer],
      );

      const subscribe = useCallback<ExternalStateStore<TValue>['subscribe']>(
        (listener) => emitterRef.current.subscribe(listener),
        [],
      );

      const isAvailable = useCallback<ExternalStateStore<TValue>['isAvailable']>(() => {
        return Boolean(storageRef.current);
      }, []);

      useEffect(() => {
        if (!isBrowser() || !storageRef.current) {
          return;
        }
        const handler = (event: StorageEvent) => {
          if (event.storageArea === storageRef.current && event.key === keyRef.current) {
            emitterRef.current.emit();
          }
        };
        window.addEventListener('storage', handler);
        return () => {
          window.removeEventListener('storage', handler);
        };
      }, [storage]);

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

export function LocalStorageStore<TValue>(
  config: WebStorageAdapterConfig<TValue>,
): ExternalStateAdapter<TValue> {
  return createWebStorageAdapter(`localStorage:${config.key}`, 'localStorage', config);
}

export function SessionStorageStore<TValue>(
  config: WebStorageAdapterConfig<TValue>,
): ExternalStateAdapter<TValue> {
  return createWebStorageAdapter(
    `sessionStorage:${config.key}`,
    'sessionStorage',
    config,
  );
}
