'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import { createDebouncer, type DebounceOptions } from './debounce';
import type {
  AnySchema,
  BasicSetter,
  ExternalStateAdapter,
  ExternalStateStore,
  KeyedSetters,
  MergeSetter,
  SchemaInput,
  SchemaOutput,
  UseExternalStateOptions,
  UseExternalStateResult,
  UseExternalStateStatus,
  ValidationErrorPayload,
  ValidationIssue,
} from './types';

const DEFAULT_UNSET = Symbol('defaultUnset');

interface Snapshot<TValue> {
  value: TValue;
  status: UseExternalStateStatus;
  source: 'store' | 'default';
}

interface PendingEffects<TValue> {
  defaultValue?: { present: true; value: TValue };
  error?: ValidationErrorPayload;
}

function isRecordLike(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function deepEqual(
  a: unknown,
  b: unknown,
  seen: WeakMap<object, WeakSet<object>>,
): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== 'object' || a === null || b === null) {
    return false;
  }

  const objectA = a as object;
  const objectB = b as object;
  const seenForA = seen.get(objectA);
  if (seenForA?.has(objectB)) {
    return true;
  }
  if (seenForA) {
    seenForA.add(objectB);
  } else {
    seen.set(objectA, new WeakSet([objectB]));
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let index = 0; index < a.length; index += 1) {
      if (!deepEqual(a[index], b[index], seen)) {
        return false;
      }
    }
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (!isPlainObject(a) || !isPlainObject(b)) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        seen,
      )
    ) {
      return false;
    }
  }
  return true;
}

function defaultIsEqual(a: unknown, b: unknown): boolean {
  return deepEqual(a, b, new WeakMap());
}

function mergeDebounceOptions(
  base: DebounceOptions | undefined,
  override?: Partial<DebounceOptions>,
): DebounceOptions {
  const merged: DebounceOptions = {
    wait: override?.wait ?? base?.wait ?? 0,
    leading: override?.leading ?? base?.leading ?? false,
    trailing: override?.trailing ?? base?.trailing ?? true,
  };

  const maxWait = override?.maxWait ?? base?.maxWait;
  if (typeof maxWait === 'number') {
    merged.maxWait = maxWait;
  }

  return merged;
}

function createKeyedSetters<TValue>(
  baseSetter: BasicSetter<TValue>,
): KeyedSetters<TValue> {
  const cache = new Map<PropertyKey, BasicSetter<unknown>>();

  const proxy = new Proxy<Record<PropertyKey, BasicSetter<unknown>>>(
    {},
    {
      get(_, prop: string | symbol | number) {
        if (prop === 'all') {
          return undefined;
        }

        if (
          typeof prop !== 'string' &&
          typeof prop !== 'number' &&
          typeof prop !== 'symbol'
        ) {
          return undefined;
        }

        const cacheKey = typeof prop === 'number' ? String(prop) : (prop as PropertyKey);

        if (!cache.has(cacheKey)) {
          const keySetter: BasicSetter<unknown> = (input) => {
            baseSetter((current) => {
              if (!isRecordLike(current)) {
                return current;
              }

              const prev = (current as Record<PropertyKey, unknown>)[cacheKey];
              const resolved =
                typeof input === 'function'
                  ? (input as (value: unknown) => unknown)(prev)
                  : input;

              if (Object.is(prev, resolved)) {
                return current;
              }

              if (Array.isArray(current)) {
                const clone = current.slice();
                const asRecord = clone as unknown as Record<PropertyKey, unknown>;
                asRecord[cacheKey] = resolved;
                return clone as unknown as TValue;
              }

              return {
                ...(current as Record<PropertyKey, unknown>),
                [cacheKey]: resolved,
              } as unknown as TValue;
            });
          };
          cache.set(cacheKey, keySetter);
        }

        return cache.get(cacheKey);
      },
      ownKeys() {
        return Array.from(cache.keys()) as (string | symbol)[];
      },
      getOwnPropertyDescriptor(_, prop) {
        const key = typeof prop === 'number' ? String(prop) : (prop as PropertyKey);
        if (cache.has(key)) {
          return {
            configurable: true,
            enumerable: true,
            value: cache.get(key),
            writable: false,
          };
        }
        return undefined;
      },
    },
  );

  return proxy as KeyedSetters<TValue>;
}

type MergeInput<TValue> =
  TValue extends Record<PropertyKey, unknown>
    ? Partial<TValue> | ((current: TValue) => Partial<TValue>)
    : never;

function createMergeSetter<TValue>(baseSetter: BasicSetter<TValue>): MergeSetter<TValue> {
  const mergeFn = ((input: MergeInput<TValue>) => {
    baseSetter((current) => {
      if (!isRecordLike(current)) {
        return current;
      }

      const patch =
        typeof input === 'function'
          ? (input as (value: TValue) => Partial<TValue>)(current)
          : input;

      if (!patch) {
        return current;
      }

      if (Array.isArray(current)) {
        const arrayCopy = [...(current as unknown as unknown[])];
        const clone = arrayCopy as unknown as TValue;
        const cloneRecord = arrayCopy as unknown as Record<PropertyKey, unknown>;
        let changed = false;

        for (const [key, patchValue] of Object.entries(patch)) {
          const prev = cloneRecord[key];
          const resolved =
            typeof patchValue === 'function'
              ? (patchValue as (v: unknown) => unknown)(prev)
              : patchValue;
          if (Object.is(prev, resolved)) {
            continue;
          }
          cloneRecord[key] = resolved;
          changed = true;
        }

        return changed ? clone : current;
      }

      const nextRecord = { ...(current as Record<PropertyKey, unknown>) };
      let changed = false;

      for (const [key, patchValue] of Object.entries(patch)) {
        const prev = nextRecord[key];
        const resolved =
          typeof patchValue === 'function'
            ? (patchValue as (v: unknown) => unknown)(prev)
            : patchValue;
        if (Object.is(prev, resolved)) {
          continue;
        }
        nextRecord[key] = resolved;
        changed = true;
      }

      return changed ? (nextRecord as unknown as TValue) : current;
    });
  }) as unknown as MergeSetter<TValue>;

  return mergeFn as unknown as MergeSetter<TValue>;
}

function resolveDefaultValue<TSchema extends AnySchema>(
  schema: TSchema,
  options?: UseExternalStateOptions<TSchema>,
): SchemaOutput<TSchema> {
  if (options?.defaultValue !== undefined) {
    return typeof options.defaultValue === 'function'
      ? (options.defaultValue as () => SchemaOutput<TSchema>)()
      : options.defaultValue;
  }

  const fromUndefined = schema.safeParse(undefined as SchemaInput<TSchema>);
  if (fromUndefined.success) {
    return fromUndefined.data;
  }

  const fromEmptyObject = schema.safeParse({} as SchemaInput<TSchema>);
  if (fromEmptyObject.success) {
    return fromEmptyObject.data;
  }

  throw new Error(
    [
      'useExternalState could not infer a default value from the provided schema.',
      'Pass `options.defaultValue` or ensure the schema accepts `undefined` input with a deterministic default.',
    ].join(' '),
  );
}

function getServerSnapshot<TValue>(defaultValue: TValue): Snapshot<TValue> {
  return {
    value: defaultValue,
    status: { kind: 'defaulted' },
    source: 'default',
  };
}

function normalizeIssues(
  issues: readonly z.core.$ZodIssue[],
): readonly ValidationIssue[] {
  return issues.map((issue) => {
    const normalizedPath = issue.path.filter(
      (segment): segment is string | number =>
        typeof segment === 'string' || typeof segment === 'number',
    );

    const normalized = { ...issue } as ValidationIssue & {
      path?: readonly (string | number)[];
    };

    if (normalizedPath.length > 0) {
      normalized.path = normalizedPath as readonly (string | number)[];
    } else {
      delete normalized.path;
    }

    return normalized;
  });
}

export function useExternalState<
  TSchema extends AnySchema,
  TValue extends SchemaOutput<TSchema> = SchemaOutput<TSchema>,
>(
  adapter: ExternalStateAdapter<TValue>,
  schema: TSchema,
  options?: UseExternalStateOptions<TSchema>,
): UseExternalStateResult<TValue> {
  const store = adapter.useStore();
  const onValidationError = options?.onValidationError;

  const defaultValueRef = useRef<TValue | typeof DEFAULT_UNSET>(DEFAULT_UNSET);
  if (defaultValueRef.current === DEFAULT_UNSET) {
    defaultValueRef.current = resolveDefaultValue(schema, options) as TValue;
  }

  const pendingEffectsRef = useRef<PendingEffects<TValue>>({});
  const lastValueRef = useRef<TValue>(defaultValueRef.current as TValue);
  const baseDebounceOptionsRef = useRef<DebounceOptions | undefined>(options?.debounce);
  baseDebounceOptionsRef.current = options?.debounce;
  const snapshotRef = useRef<Snapshot<TValue>>(
    getServerSnapshot(defaultValueRef.current as TValue),
  );
  const supportsMergeRef = useRef<boolean>(
    isRecordLike(defaultValueRef.current as TValue),
  );

  const getSnapshot = useCallback((): Snapshot<TValue> => {
    const equalityCheck = options?.isEqual ?? defaultIsEqual;
    const fallback = defaultValueRef.current as TValue;
    const currentSnapshot = snapshotRef.current;

    if (!store.isAvailable()) {
      if (
        currentSnapshot.source === 'default' &&
        currentSnapshot.status.kind === 'defaulted'
      ) {
        return currentSnapshot;
      }
      const nextSnapshot = getServerSnapshot(fallback);
      snapshotRef.current = nextSnapshot;
      return nextSnapshot;
    }

    const raw = store.read();

    if (raw === undefined) {
      pendingEffectsRef.current = {
        ...pendingEffectsRef.current,
        defaultValue: { present: true, value: fallback },
      };
      if (
        currentSnapshot.source === 'default' &&
        currentSnapshot.status.kind === 'defaulted' &&
        equalityCheck(currentSnapshot.value, fallback)
      ) {
        return currentSnapshot;
      }
      const nextSnapshot: Snapshot<TValue> = {
        value: fallback,
        status: { kind: 'defaulted' },
        source: 'default',
      };
      snapshotRef.current = nextSnapshot;
      return nextSnapshot;
    }

    const parsed = schema.safeParse(raw as SchemaInput<TSchema>);

    if (!parsed.success) {
      const normalizedIssues = normalizeIssues(parsed.error.issues);
      pendingEffectsRef.current = {
        ...pendingEffectsRef.current,
        defaultValue: { present: true, value: fallback },
        error: { issues: normalizedIssues, rawValue: raw },
      };

      if (
        currentSnapshot.source === 'default' &&
        currentSnapshot.status.kind === 'error' &&
        equalityCheck(currentSnapshot.value, fallback)
      ) {
        return currentSnapshot;
      }

      const nextSnapshot: Snapshot<TValue> = {
        value: fallback,
        status: { kind: 'error', issues: normalizedIssues },
        source: 'default',
      };
      snapshotRef.current = nextSnapshot;
      return nextSnapshot;
    }

    const parsedValue = parsed.data as TValue;
    const stableValue =
      currentSnapshot.source === 'store' &&
      equalityCheck(parsedValue, currentSnapshot.value)
        ? currentSnapshot.value
        : parsedValue;

    if (
      currentSnapshot.source === 'store' &&
      currentSnapshot.status.kind === 'idle' &&
      equalityCheck(stableValue, currentSnapshot.value)
    ) {
      return currentSnapshot;
    }

    const nextSnapshot: Snapshot<TValue> = {
      value: stableValue,
      status: { kind: 'idle' },
      source: 'store',
    };

    snapshotRef.current = nextSnapshot;
    return nextSnapshot;
  }, [options?.isEqual, schema, store]);

  const subscribe = useCallback<ExternalStateStore<TValue>['subscribe']>(
    (listener) => store.subscribe(listener),
    [store],
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () =>
    getServerSnapshot(defaultValueRef.current as TValue),
  );

  useEffect(() => {
    lastValueRef.current = snapshot.value;
    if (!supportsMergeRef.current && isRecordLike(snapshot.value)) {
      supportsMergeRef.current = true;
    }

    const pending = pendingEffectsRef.current;
    pendingEffectsRef.current = {};

    if (pending.defaultValue?.present && store.isAvailable()) {
      const valueToPersist = pending.defaultValue.value;
      Promise.resolve().then(() => {
        store.write(valueToPersist);
      });
    }

    if (pending.error && onValidationError) {
      onValidationError(pending.error);
    }
  }, [snapshot, store, onValidationError]);

  const setValue = useCallback<BasicSetter<TValue>>(
    (next) => {
      if (!store.isAvailable()) {
        return;
      }

      const current = lastValueRef.current ?? (defaultValueRef.current as TValue);
      const equalityCheck = options?.isEqual ?? defaultIsEqual;

      const resolved =
        typeof next === 'function' ? (next as (value: TValue) => TValue)(current) : next;

      if (equalityCheck(resolved, current)) {
        return;
      }

      const validation = schema.safeParse(resolved as SchemaInput<TSchema>);

      if (!validation.success) {
        pendingEffectsRef.current = {
          ...pendingEffectsRef.current,
          error: {
            issues: normalizeIssues(validation.error.issues),
            rawValue: resolved,
          },
        };
        return;
      }

      const nextValue = validation.data as TValue;
      store.write(nextValue);
      lastValueRef.current = nextValue;
    },
    [options?.isEqual, schema, store],
  );

  const keySetters = useMemo<KeyedSetters<TValue>>(
    () => createKeyedSetters(setValue),
    [setValue],
  );

  const mergeSetter = useMemo(() => {
    if (!supportsMergeRef.current) {
      return undefined;
    }
    return createMergeSetter(setValue);
  }, [setValue]);

  const debounce = useCallback<UseExternalStateResult<TValue>['debounce']>(
    (fn, override) => {
      const config = mergeDebounceOptions(baseDebounceOptionsRef.current, override);
      return createDebouncer(config)(fn);
    },
    [],
  );

  const result: UseExternalStateResult<TValue> = useMemo(() => {
    const canMerge = supportsMergeRef.current && isRecordLike(snapshot.value);

    return {
      value: snapshot.value,
      set: keySetters,
      setValue,
      setAll: setValue,
      merge: canMerge ? mergeSetter : undefined,
      status: snapshot.status,
      debounce,
    } satisfies UseExternalStateResult<TValue>;
  }, [debounce, keySetters, mergeSetter, setValue, snapshot]);

  return result;
}
