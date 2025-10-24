'use client';

import type { JSX } from 'react';
import { QueryParameterStore, useExternalState } from '@1apostoli/use-external-state';
import { z } from 'zod';

const filtersSchema = z.object({
  search: z.string().default(''),
  page: z.coerce.number().min(1).default(1),
  tags: z.array(z.string()).default([]),
});

type Filters = z.output<typeof filtersSchema>;

const tagOptions = ['books', 'electronics', 'fashion', 'home'] as const;

function toObject(value: Filters): Record<string, string | string[] | null | undefined> {
  return {
    search: value.search || undefined,
    page: value.page === 1 ? undefined : String(value.page),
    tags: value.tags.length > 0 ? value.tags : undefined,
  };
}

const queryAdapter = QueryParameterStore<Filters>({
  history: 'replace',
  serialize: toObject,
  parse: fromParams,
});

function fromParams(params: URLSearchParams): Filters | undefined {
  const draft = {
    search: params.get('search') ?? undefined,
    page: params.get('page') ?? undefined,
    tags: params.getAll('tags'),
  };
  const parsed = filtersSchema.safeParse(draft);
  if (parsed.success) {
    return parsed.data;
  }
  return undefined;
}

export default function CustomQueryParamsDemo(): JSX.Element {
  const filters = useExternalState<typeof filtersSchema, Filters>(
    queryAdapter,
    filtersSchema,
  );

  const toggleTag = (tag: string) => {
    filters.setValue((current) => {
      const exists = current.tags.includes(tag);
      return {
        ...current,
        tags: exists
          ? current.tags.filter((item) => item !== tag)
          : [...current.tags, tag],
      };
    });
  };

  return (
    <main
      style={{ padding: '2rem', fontFamily: 'sans-serif', display: 'grid', gap: '1rem' }}
    >
      <h1>Custom Query Parameter Adapter (React + Vite)</h1>
      <p>
        This example shows how to hand-roll a query parameter adapter using the{' '}
        <code>BrowserStateAdapter</code> interface.
      </p>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Search</span>
        <input
          value={filters.value.search}
          onChange={(event) => filters.set.search(event.target.value)}
        />
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Page</span>
        <input
          type="number"
          min={1}
          value={filters.value.page}
          onChange={(event) => filters.set.page(Number(event.target.value))}
        />
      </label>

      <fieldset style={{ border: '1px solid #ddd', padding: 16 }}>
        <legend>Tags</legend>
        {tagOptions.map((tag) => {
          const checked = filters.value.tags.includes(tag);
          return (
            <label key={tag} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={checked} onChange={() => toggleTag(tag)} />
              <span>{tag}</span>
            </label>
          );
        })}
      </fieldset>

      <button
        type="button"
        onClick={() => filters.setValue(() => filtersSchema.parse(undefined))}
        style={{ width: 'fit-content' }}
      >
        Reset filters
      </button>

      <section style={{ marginTop: '2rem' }}>
        <h2>Current filters</h2>
        <pre
          style={{
            background: '#f5f5f5',
            padding: '1rem',
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {JSON.stringify(filters.value, null, 2)}
        </pre>
      </section>
    </main>
  );
}
