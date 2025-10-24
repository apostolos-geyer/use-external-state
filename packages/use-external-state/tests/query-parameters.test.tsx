import { act, renderHook, waitFor } from '@testing-library/react';
import { z } from 'zod';

import {
  QueryParameterStore,
  type QueryParameterStoreConfig,
} from '../src/stores/query-parameters';
import { useExternalState } from '../src';

type QueryState = { search: string; tags: string[] };

function createAdapter(config: QueryParameterStoreConfig<QueryState> = {}) {
  return QueryParameterStore<QueryState>({
    serialize: (value) => ({
      search: value.search || undefined,
      tags: value.tags.length > 0 ? value.tags : undefined,
    }),
    parse: (params) => ({
      search: params.get('search') ?? '',
      tags: params.getAll('tags'),
    }),
    ...config,
  });
}

describe('QueryParameterStore (core)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('writes values to the URL and reads them back', () => {
    const adapter = createAdapter();
    const { result } = renderHook(() => adapter.useStore());
    const store = result.current;

    act(() => {
      store.write({ search: 'alpha', tags: ['a', 'b'] });
    });

    expect(window.location.search).toBe('?search=alpha&tags=a&tags=b');
    expect(store.read()).toEqual({ search: 'alpha', tags: ['a', 'b'] });
  });

  it('preserves unknown query parameters when configured', () => {
    window.history.replaceState(null, '', '/?foo=bar');
    const adapter = createAdapter({ preserveUnknownKeys: true });
    const { result } = renderHook(() => adapter.useStore());
    const store = result.current;

    act(() => {
      store.write({ search: 'beta', tags: [] });
    });

    expect(window.location.search).toBe('?foo=bar&search=beta');
  });

  it('drops unknown query parameters when opt-out is set', () => {
    window.history.replaceState(null, '', '/?foo=bar');
    const adapter = createAdapter({ preserveUnknownKeys: false });
    const { result } = renderHook(() => adapter.useStore());
    const store = result.current;

    act(() => {
      store.write({ search: 'gamma', tags: [] });
    });

    expect(window.location.search).toBe('?search=gamma');
  });

  it('writes defaults to the URL when bound with useExternalState', async () => {
    window.history.replaceState(null, '', '/');
    const schema = z.object({
      search: z.string().default(''),
      page: z.coerce.number().default(1),
    });

    const adapter = QueryParameterStore<z.output<typeof schema>>();

    const { result } = renderHook(() => useExternalState(adapter, schema));

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('page')).toBe('1');
    });

    expect(result.current.value).toEqual({ search: '', page: 1 });
  });
});
