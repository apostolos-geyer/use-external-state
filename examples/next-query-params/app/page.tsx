'use client';

import { Suspense, type JSX } from 'react';
import { QueryParameterStore } from '@1apostoli/use-external-state-next';
import { useExternalState } from '@1apostoli/use-external-state';
import { z } from 'zod';

const store = QueryParameterStore<Filters>({
  history: 'replace',
});

const categories = ['all', 'books', 'electronics', 'fashion', 'home'] as const;
type Category = (typeof categories)[number];
const filtersSchema = z.object({
  search: z.string().default(''),
  category: z.enum(categories).default('all'),
  minPrice: z.coerce.number().min(0).default(0),
  maxPrice: z.coerce.number().min(0).default(500),
  includeOutOfStock: z.coerce.boolean().default(false),
});

type Filters = z.output<typeof filtersSchema>;

export default function Page(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <FiltersPage />
    </Suspense>
  );
}

function FiltersPage(): JSX.Element {
  const filters = useExternalState(store, filtersSchema);
  return (
    <main style={{ display: 'grid', gap: '1rem', maxWidth: 640 }}>
      <h1>Next.js Query Parameters + Zod</h1>
      <p>
        This page keeps filters in sync with the URL search params using{' '}
        <code>@1apostoli/use-external-state-next</code>.
      </p>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Search</span>
        <input
          value={filters.value.search}
          onChange={(event) => filters.set.search(event.target.value)}
        />
      </label>

      <label style={{ display: 'grid', gap: 4 }}>
        <span>Category</span>
        <select
          value={filters.value.category}
          onChange={(event) => filters.set.category(event.target.value as Category)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ display: 'grid', gap: 4, flex: 1 }}>
          <span>Min price</span>
          <input
            type="number"
            min={0}
            value={filters.value.minPrice}
            onChange={(event) => filters.set.minPrice(Number(event.target.value))}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, flex: 1 }}>
          <span>Max price</span>
          <input
            type="number"
            min={filters.value.minPrice}
            value={filters.value.maxPrice}
            onChange={(event) => filters.set.maxPrice(Number(event.target.value))}
          />
        </label>
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={filters.value.includeOutOfStock}
          onChange={(event) => filters.set.includeOutOfStock(event.target.checked)}
        />
        <span>Include out-of-stock items</span>
      </label>

      <button
        type="button"
        onClick={() => filters.setValue(() => filtersSchema.parse(undefined))}
        style={{ width: 'fit-content' }}
      >
        Reset to defaults
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
