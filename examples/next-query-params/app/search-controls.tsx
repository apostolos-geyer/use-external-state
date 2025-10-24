'use client';

import type { JSX } from 'react';

import { QueryParameterStore } from '@1apostoli/use-external-state-next';
import { useExternalState } from '@1apostoli/use-external-state';

import { categories, filtersSchema, type Category, type Filters } from './filters-schema';

const store = QueryParameterStore<Filters>({
  history: 'replace',
});

export default function SearchControls(): JSX.Element {
  const filters = useExternalState(store, filtersSchema, { debounce: { wait: 150 } });

  return (
    <>
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
        onClick={() => filters.setValue(() => filtersSchema.parse({}))}
        style={{ width: 'fit-content' }}
      >
        Reset to defaults
      </button>
    </>
  );
}
