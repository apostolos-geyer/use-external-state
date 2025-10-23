import type { z } from 'zod';

import type { DebouncedFunction, DebounceOptions } from './debounce';

export type AnySchema = z.ZodTypeAny;

export type SchemaInput<TSchema extends AnySchema> = z.input<TSchema>;

export type SchemaOutput<TSchema extends AnySchema> = z.output<TSchema>;

export interface ExternalStateStore<TValue> {
  read(): TValue | undefined;
  write(value: TValue | undefined): void;
  subscribe(listener: () => void): () => void;
  isAvailable(): boolean;
}

export interface ExternalStateAdapter<TValue> {
  id: string;
  useStore(): ExternalStateStore<TValue>;
}

export type ValidationIssue = Omit<z.core.$ZodIssue, 'path'> & {
  path?: readonly (string | number)[];
};

export interface ValidationErrorPayload {
  readonly issues: readonly ValidationIssue[];
  readonly rawValue: unknown;
}

export interface UseExternalStateStatus {
  kind: 'idle' | 'defaulted' | 'error';
  issues?: readonly ValidationIssue[];
}

export interface BasicSetter<TValue> {
  (value: TValue | ((current: TValue) => TValue)): void;
}

export type KeyedSetters<TValue> =
  TValue extends Record<PropertyKey, unknown>
    ? { readonly [K in keyof TValue]-?: BasicSetter<TValue[K]> }
    : Record<never, never>;

export type MergeSetter<TValue> =
  TValue extends Record<PropertyKey, unknown>
    ? (value: Partial<TValue> | ((current: TValue) => Partial<TValue>)) => void
    : never;

export interface UseExternalStateOptions<TSchema extends AnySchema> {
  defaultValue?: SchemaOutput<TSchema> | (() => SchemaOutput<TSchema>);
  isEqual?: (next: SchemaOutput<TSchema>, prev: SchemaOutput<TSchema>) => boolean;
  onValidationError?: (payload: ValidationErrorPayload) => void;
  debounce?: DebounceOptions;
}

export interface UseExternalStateResult<TValue> {
  value: TValue;
  set: KeyedSetters<TValue>;
  setValue: BasicSetter<TValue>;
  setAll: BasicSetter<TValue>;
  merge: MergeSetter<TValue> | undefined;
  status: UseExternalStateStatus;
  debounce: <T extends (...args: unknown[]) => unknown>(
    fn: T,
    override?: Partial<DebounceOptions>,
  ) => DebouncedFunction<T>;
}
