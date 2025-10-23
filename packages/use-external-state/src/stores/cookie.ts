import { useCallback, useEffect, useMemo, useRef } from 'react';

import { createStoreEmitter } from '../emitter';
import { isBrowser } from '../internal/is-browser';
import type { ExternalStateAdapter, ExternalStateStore } from '../types';
import type { StorageSerializer } from './web-storage';

export interface CookieAttributes {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
}

export interface CookieStoreConfig<TValue> {
  name: string;
  serializer?: StorageSerializer<TValue>;
  attributes?: CookieAttributes;
  /**
   * Polling interval (ms) to detect external cookie changes. Set to 0 to disable polling.
   * Defaults to 1000ms.
   */
  pollIntervalMs?: number;
}

const defaultSerializer = {
  serialize(value: unknown) {
    return encodeURIComponent(JSON.stringify(value) ?? 'null');
  },
  deserialize(raw: string) {
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      return raw;
    }
  },
} satisfies StorageSerializer<unknown>;

function readCookie(documentCookie: string, name: string): string | undefined {
  const cookies = documentCookie ? documentCookie.split('; ') : [];
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split('=');
    if (cookieName === name) {
      return rest.join('=');
    }
  }
  return undefined;
}

function formatAttributes(attributes: CookieAttributes | undefined): string {
  if (!attributes) {
    return '';
  }

  const parts: string[] = [];
  if (attributes.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(attributes.maxAge)}`);
  }
  if (attributes.expires) {
    parts.push(`Expires=${attributes.expires.toUTCString()}`);
  }
  if (attributes.domain) {
    parts.push(`Domain=${attributes.domain}`);
  }
  if (attributes.path) {
    parts.push(`Path=${attributes.path}`);
  }
  if (attributes.secure) {
    parts.push('Secure');
  }
  if (attributes.sameSite) {
    parts.push(`SameSite=${attributes.sameSite}`);
  }
  return parts.length > 0 ? `; ${parts.join('; ')}` : '';
}

export function CookieStore<TValue>(
  config: CookieStoreConfig<TValue>,
): ExternalStateAdapter<TValue> {
  const { name, serializer: serializerOverride, attributes, pollIntervalMs } = config;

  return {
    id: `cookie:${name}`,
    useStore() {
      const serializer = useMemo(
        () => serializerOverride ?? (defaultSerializer as StorageSerializer<TValue>),
        [],
      );

      const emitterRef = useRef(createStoreEmitter());
      const lastRawRef = useRef<string | undefined>(undefined);
      const nameRef = useRef(name);
      const attributesRef = useRef(attributes);
      const pollIntervalRef = useRef(pollIntervalMs);

      const read = useCallback<ExternalStateStore<TValue>['read']>(() => {
        if (!isBrowser()) {
          return undefined;
        }
        const cookieName = nameRef.current ?? name;
        const raw = readCookie(document.cookie, cookieName);
        lastRawRef.current = raw;
        if (raw === undefined) {
          return undefined;
        }
        return serializer.deserialize(raw);
      }, [serializer]);

      const write = useCallback<ExternalStateStore<TValue>['write']>(
        (value) => {
          if (!isBrowser()) {
            return;
          }

          const cookieName = nameRef.current ?? name;
          const cookieAttributes = attributesRef.current;

          if (value === undefined) {
            document.cookie = `${cookieName}=; Max-Age=0${formatAttributes(cookieAttributes)}`;
            lastRawRef.current = undefined;
            emitterRef.current.emit();
            return;
          }

          const serialized = serializer.serialize(value);
          lastRawRef.current = serialized;
          document.cookie = `${cookieName}=${serialized}${formatAttributes(cookieAttributes)}`;
          emitterRef.current.emit();
        },
        [serializer],
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
        if (!isBrowser()) {
          return;
        }
        const pollInterval = pollIntervalRef.current ?? 1000;
        if (pollInterval <= 0) {
          return;
        }
        const interval = window.setInterval(() => {
          const cookieName = nameRef.current ?? name;
          const raw = readCookie(document.cookie, cookieName);
          if (raw !== lastRawRef.current) {
            lastRawRef.current = raw;
            emitterRef.current.emit();
          }
        }, pollInterval);
        return () => {
          window.clearInterval(interval);
        };
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
