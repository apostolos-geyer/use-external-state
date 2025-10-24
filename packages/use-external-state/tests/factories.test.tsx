'use client';

import { renderHook, act, render, screen } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { z } from 'zod';

import { LocalStorageStore, makeContext, makeHOC, makeHook } from '../src';

const schema = z.object({ search: z.string().default('') });
type SearchState = z.infer<typeof schema>;

const useSearchState = makeHook<SearchState, { key: string }>(
  LocalStorageStore<SearchState>,
);

describe('factories', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('creates a typed hook with makeHook', async () => {
    const { result } = renderHook(() =>
      useSearchState({ schema, config: { key: 'factory-hook' } }),
    );

    await act(async () => {
      result.current.set.search('alpha');
    });

    expect(result.current.value.search).toBe('alpha');
  });

  it('provides a context wrapper that uses React 19 `use`', async () => {
    const SearchContext = makeContext(useSearchState, {
      displayName: 'SearchContext',
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <SearchContext.Provider schema={schema} config={{ key: 'context' }}>
        {children}
      </SearchContext.Provider>
    );

    const { result } = renderHook(() => SearchContext.use(), { wrapper });

    await act(async () => {
      result.current.set.search('context');
    });

    expect(result.current.value.search).toBe('context');
  });

  it('injects state into components via makeHOC', async () => {
    const withSearchState = makeHOC(useSearchState);

    const Display = withSearchState(({ externalState }) => {
      useEffect(() => {
        externalState.set.search('hoc');
      }, [externalState]);

      return <span>{externalState.value.search}</span>;
    });

    render(<Display schema={schema} config={{ key: 'hoc' }} />);

    expect(await screen.findByText('hoc')).toBeInTheDocument();
  });
});
