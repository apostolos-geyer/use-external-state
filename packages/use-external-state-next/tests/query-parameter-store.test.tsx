import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { useExternalState } from '@apostoli/use-external-state';
import { QueryParameterStore } from '../src';

type RouterCall = [href: string, options?: { scroll?: boolean }];

const routerPush = vi.fn<[string, { scroll?: boolean }?], void>();
const routerReplace = vi.fn<[string, { scroll?: boolean }?], void>();
let pathname = '/products';
let currentSearchParams = new URLSearchParams();

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
  });

  it('hydrates defaults and writes updated params', () => {
    const schema = z.object({
      search: z.string().default(''),
      page: z.coerce.number().min(1).default(1),
    });

    const store = QueryParameterStore<z.output<typeof schema>>();

    const { result } = renderHook(() => useExternalState(store, schema));

    expect(result.current.value).toEqual({ search: '', page: 1 });

    const setSearch = result.current.set.search;
    expect(typeof setSearch).toBe('function');

    act(() => {
      if (!setSearch) {
        throw new Error('expected search setter to be defined');
      }
      setSearch('bikes');
    });

    const [href] = routerReplace.mock.calls.at(-1) as RouterCall;
    expect(href).toBe('/products?search=bikes&page=1');
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
