'use client';

export type {
  ExternalStateAdapter,
  ExternalStateStore,
  BasicSetter,
  KeyedSetters,
  MergeSetter,
  UseExternalStateOptions,
  UseExternalStateResult,
  UseExternalStateStatus,
  ValidationErrorPayload,
} from './types';
export {
  LocalStorageStore,
  SessionStorageStore,
  type StorageSerializer,
  type WebStorageAdapterConfig,
} from './stores/web-storage';
export {
  CookieStore,
  type CookieStoreConfig,
  type CookieAttributes,
} from './stores/cookie';
export {
  QueryParameterStore,
  type QueryParameterStoreConfig,
  normalizeQueryValue,
  defaultQueryParse,
  type SerializedRecord,
} from './stores/query-parameters';
export {
  createDebouncer,
  type DebounceOptions,
  type DebouncedFunction,
} from './debounce';
export { useExternalState } from './use-external-state';
export { createStoreEmitter } from './emitter';
export {
  makeHook,
  makeContext,
  makeHOC,
  type ExternalStateHook,
  type HookParams,
} from './factories';
