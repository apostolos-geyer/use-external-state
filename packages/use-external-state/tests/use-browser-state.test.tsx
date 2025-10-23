import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { z } from 'zod';

import { LocalStorageStore, createDebouncer, useExternalState } from '../src';

describe('useExternalState with LocalStorageStore', () => {
  const schema = z.object({ search: z.string().default('') });
  type SearchState = z.output<typeof schema>;
  const store = LocalStorageStore<SearchState>({ key: 'search' });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hydrates default value and persists updates', async () => {
    const { result } = renderHook(() =>
      useExternalState<typeof schema, SearchState>(store, schema),
    );

    await waitFor(() => {
      expect(result.current.value.search).toBe('');
    });

    act(() => {
      result.current.set.search('apple');
    });

    await waitFor(() => {
      expect(result.current.value.search).toBe('apple');
      expect(window.localStorage.getItem('search')).toBe(
        JSON.stringify({ search: 'apple' }),
      );
    });
  });

  it('supports merge updates', async () => {
    const { result } = renderHook(() =>
      useExternalState<typeof schema, SearchState>(store, schema),
    );

    act(() => {
      result.current.merge?.({ search: 'banana' });
    });

    await waitFor(() => {
      expect(result.current.value.search).toBe('banana');
    });
  });

  it('supports keyed setters with common property names', async () => {
    const commonSchema = z.object({
      name: z.string().default('initial'),
      merge: z.boolean().default(false),
      length: z.number().default(0),
    });
    type CommonState = z.output<typeof commonSchema>;
    const commonStore = LocalStorageStore<CommonState>({ key: 'common' });

    const { result } = renderHook(() =>
      useExternalState<typeof commonSchema, CommonState>(commonStore, commonSchema),
    );

    act(() => {
      result.current.set.name('updated');
      result.current.set.merge(true);
      result.current.set.length(42);
    });

    await waitFor(() => {
      expect(result.current.value).toEqual({
        name: 'updated',
        merge: true,
        length: 42,
      });
    });

    expect((result.current.set as Record<string, unknown>).all).toBeUndefined();
    expect(result.current.merge).toBeTypeOf('function');
  });

  it('exposes top-level helpers for whole state updates', async () => {
    const { result } = renderHook(() =>
      useExternalState<typeof schema, SearchState>(store, schema),
    );

    act(() => {
      result.current.setValue({ search: 'value' });
    });

    await waitFor(() => {
      expect(result.current.value.search).toBe('value');
    });

    act(() => {
      result.current.setAll((previous) => ({ ...previous, search: 'next' }));
    });

    await waitFor(() => {
      expect(result.current.value.search).toBe('next');
    });

    expect(result.current.setValue).toBe(result.current.setAll);
  });
});

describe('createDebouncer', () => {
  it('debounces calls using trailing edge by default', () => {
    vi.useFakeTimers();
    const debouncer = createDebouncer({ wait: 100 });
    const spy = vi.fn();
    const debounced = debouncer(spy);

    debounced();
    debounced();
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
