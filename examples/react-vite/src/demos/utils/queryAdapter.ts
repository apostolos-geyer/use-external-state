import { useMemo } from 'react';
import type {
  ExternalStateAdapter,
  ExternalStateStore,
} from '@1apostoli/use-external-state';

import { createStoreEmitter } from '@1apostoli/use-external-state';

interface QueryAdapterOptions<TValue> {
  history?: 'replace' | 'push';
  keys: (keyof TValue)[];
  serialize: (value: TValue) => Record<string, string | string[] | null | undefined>;
  deserialize: (params: URLSearchParams) => TValue | undefined;
}

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

export function useQueryParameterAdapter<TValue>(
  id: string,
  options: QueryAdapterOptions<TValue>,
): ExternalStateAdapter<TValue> {
  const { history = 'replace', keys, serialize, deserialize } = options;

  return useMemo(() => {
    const emitter = createStoreEmitter();

    const store: ExternalStateStore<TValue> = {
      read() {
        if (!isBrowser()) {
          return undefined;
        }
        const params = new URLSearchParams(window.location.search);
        return deserialize(params);
      },
      write(value) {
        if (!isBrowser()) {
          return;
        }
        const params = new URLSearchParams(window.location.search);

        if (value === undefined) {
          keys.forEach((key) => params.delete(String(key)));
        } else {
          const map = serialize(value);
          keys.forEach((key) => params.delete(String(key)));
          Object.entries(map).forEach(([key, entry]) => {
            if (entry === undefined) {
              return;
            }
            if (entry === null) {
              params.set(key, 'null');
              return;
            }
            if (Array.isArray(entry)) {
              params.delete(key);
              entry.forEach((item) => params.append(key, item));
              return;
            }
            params.set(key, entry);
          });
        }

        const next = params.toString();
        const url = next
          ? `${window.location.pathname}?${next}`
          : window.location.pathname;
        if (history === 'push') {
          window.history.pushState(null, '', url);
        } else {
          window.history.replaceState(null, '', url);
        }
        emitter.emit();
      },
      subscribe(listener) {
        if (!isBrowser()) {
          return () => {};
        }
        const unsubscribe = emitter.subscribe(listener);
        const handlePopState = () => emitter.emit();
        window.addEventListener('popstate', handlePopState);
        return () => {
          unsubscribe();
          window.removeEventListener('popstate', handlePopState);
        };
      },
      isAvailable() {
        return isBrowser();
      },
    };

    return {
      id: `query:${id}`,
      useStore: () => store,
    };
  }, [deserialize, history, id, keys, serialize]);
}
