import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { useExternalState } from '@1apostoli/use-external-state';
import { QueryParameterStore } from '../src';

type RouterCall = [href: string, options?: { scroll?: boolean }];

const routerPush = vi.fn<[string, { scroll?: boolean }?], void>();
const routerReplace = vi.fn<[string, { scroll?: boolean }?], void>();
let pathname = '/products';
let currentSearchParams = new URLSearchParams();

function syncSearchParams(href: string) {
  const url = new URL(href, 'https://example.com');
  const nextParams = new URLSearchParams(url.search);
  const entries: Array<[string, string]> = [];
  nextParams.forEach((value, key) => {
    entries.push([key, value]);
  });
  Array.from(currentSearchParams.keys()).forEach((key) => {
    currentSearchParams.delete(key);
  });
  for (const [key, value] of entries) {
    currentSearchParams.append(key, value);
  }
}

function toReadonlyParams(params: URLSearchParams): URLSearchParams {
  // Next.js ReadonlyURLSearchParams extends URLSearchParams. Casting keeps the minimal api we need.
  return params;
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
  }),
  usePathname: () => pathname,
  useSearchParams: () => toReadonlyParams(currentSearchParams),
}));

describe('QueryParameterStore', () => {
  beforeEach(() => {
    routerPush.mockReset();
    routerReplace.mockReset();
    pathname = '/products';
    currentSearchParams = new URLSearchParams();

    routerPush.mockImplementation((href) => {
      syncSearchParams(href);
    });

    routerReplace.mockImplementation((href) => {
      syncSearchParams(href);
    });
  });

  it('hydrates defaults and writes updated params', async () => {
    const schema = z.object({
      search: z.string().default(''),
      page: z.coerce.number().min(1).default(1),
    });

    const store = QueryParameterStore<z.output<typeof schema>>();

    const { result } = renderHook(() => useExternalState(store, schema));

    expect(result.current.value).toEqual({ search: '', page: 1 });

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalled();
    });

    const [initialHref] = routerReplace.mock.calls[0] as RouterCall;
    const initialParams = new URL(initialHref, 'https://example.com').searchParams;
    expect(initialParams.get('page')).toBe('1');

    const setSearch = result.current.set.search;
    expect(typeof setSearch).toBe('function');

    act(() => {
      if (!setSearch) {
        throw new Error('expected search setter to be defined');
      }
      setSearch('bikes');
    });

    expect(result.current.value.search).toBe('bikes');

    const calls = routerReplace.mock.calls as RouterCall[];
    expect(calls.some(([href]) => href === '/products?search=bikes&page=1')).toBe(
      true,
    );
  });

  it('preserves unknown parameters by default', () => {
    currentSearchParams = new URLSearchParams('foo=123');

    const schema = z.object({
      search: z.string().default(''),
    });

    const store = QueryParameterStore<z.output<typeof schema>>();

    const { result } = renderHook(() => useExternalState(store, schema));

    expect(result.current.value.search).toBe('');

    const setSearch = result.current.set.search;
    expect(typeof setSearch).toBe('function');

    act(() => {
      if (!setSearch) {
        throw new Error('expected search setter to be defined');
      }
      setSearch('desk');
    });

    const [href] = routerReplace.mock.calls.at(-1) as RouterCall;
    expect(href).toBe('/products?foo=123&search=desk');
  });
});
