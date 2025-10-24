import { Suspense, type JSX } from 'react';

import FiltersPreview from './filters-preview';
import SearchControls from './search-controls';

type SearchParams = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): JSX.Element {
  const searchParamsPromise = searchParams;

  return (
    <main style={{ display: 'grid', gap: '1rem', maxWidth: 640 }}>
      <h1>Next.js Query Parameters + Zod</h1>
      <p>
        This page keeps filters in sync with the URL search params using{' '}
        <code>@1apostoli/use-external-state-next</code>.
      </p>

      <SearchControls />

      <Suspense fallback={<FiltersPreviewFallback />}>
        <FiltersPreview searchParamsPromise={searchParamsPromise} />
      </Suspense>
    </main>
  );
}

function FiltersPreviewFallback(): JSX.Element {
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
        Loading current filters…
      </pre>
    </section>
  );
}
