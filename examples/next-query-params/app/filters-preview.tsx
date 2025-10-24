import type { JSX } from 'react';

import { parseFiltersFromSearchParams } from './filters-schema';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function FiltersPreview({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<SearchParams>;
}): Promise<JSX.Element> {
  const searchParams = await searchParamsPromise;
  const filters = parseFiltersFromSearchParams(searchParams);

  return (
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
        {JSON.stringify(filters, null, 2)}
      </pre>
    </section>
  );
}
