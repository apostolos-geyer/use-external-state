# @1apostoli/use-external-state/next

Query parameter adapter for [`@1apostoli/use-external-state`](https://www.npmjs.com/package/@1apostoli/use-external-state) tailored to the Next.js App Router.

## Installation

```bash
pnpm add @1apostoli/use-external-state @1apostoli/use-external-state/next
```

Peer dependencies: `react@^18.2.0` or `^19.0.0`, `next@>=13.4.0`.

## Usage

```tsx
'use client';

import { QueryParameterStore } from '@1apostoli/use-external-state/next';
import { useExternalState } from '@1apostoli/use-external-state';
import { z } from 'zod';

const searchSchema = z.object({
  search: z.string().default(''),
  page: z.coerce.number().min(1).default(1),
});

export function ProductsSearch() {
  const query = useExternalState(QueryParameterStore(), searchSchema);

  return (
    <input
      value={query.value.search}
      onChange={(event) => query.set.search(event.target.value)}
    />
  );
}
```

`QueryParameterStore` keeps managed keys in sync with the Next.js router, merges unknown keys by default, and exposes history control (`push` or `replace`).
