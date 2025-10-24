# @1apostoli/use-external-state

React hook for managing state that lives outside the component tree while staying type-safe with [Zod v4](https://zod.dev). Synchronise with browser storage, cookies, or Next.js query parameters without sprinkling custom effects everywhere.

## Highlights

- ✅ Works with Zod v4 schemas end-to-end (inference + validation)
- ✅ Supports `localStorage`, `sessionStorage`, cookies, and Next.js App Router search params out of the box
- ✅ Keeps defaults, `null` vs `undefined`, and validation failures consistent
- ✅ Stable, key-safe setters (`state.set.search`) with top-level helpers for whole-state updates
- ✅ Built-in debounced writes (via `options.debounce`) with a standalone helper when you need manual control
- ✅ React 19 compiler-friendly: pure hooks, stable dependencies, and external store integration

## Installation

```bash
# core hook
pnpm add @1apostoli/use-external-state

# optional Next.js adapter
pnpm add @1apostoli/use-external-state-next
```

Peer dependencies: `react@^18.2.0` (core) and `next@>=13.4.0` when using the Next.js adapter.

## Quick start

```tsx
'use client';

import { useExternalState, LocalStorageStore } from '@1apostoli/use-external-state';
import { z } from 'zod';

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).default('light'),
  compact: z.boolean().default(false),
});

export function ThemeToggle() {
  const prefs = useExternalState(LocalStorageStore({ key: 'prefs' }), preferencesSchema);

  return (
    <fieldset>
      <label>
        <input
          type="checkbox"
          checked={prefs.value.compact}
          onChange={(event) => prefs.set.compact(event.target.checked)}
        />
        Compact mode
      </label>
      <button
        onClick={() =>
          prefs.merge?.({ theme: 'dark' }) ??
          prefs.setValue((current) => ({ ...current, theme: 'dark' }))
        }
      >
        Dark theme
      </button>
    </fieldset>
  );
}
```

## Next.js query parameters

```tsx
'use client';

import { QueryParameterStore } from '@1apostoli/use-external-state-next';
import { z } from 'zod';

const searchSchema = z.object({
  search: z.string().default(''),
  page: z.coerce.number().min(1).default(1),
});

export default function ProductsPage() {
  const query = useExternalState(QueryParameterStore(), searchSchema, {
    debounce: { wait: 300 },
  });

  return (
    <SearchInput
      value={query.value.search}
      onChange={(event) => query.set.search(event.target.value)}
    />
  );
}
```

The adapter automatically merges managed keys with other query parameters. Pair it with `options.debounce` (as above) to keep the UI responsive while batching router navigations. Set `QueryParameterStore({ navigation: { mode: 'history' } })` to update the URL without triggering a refetch, or `{ preserveUnknownKeys: false }` to opt out of merging.

## Cookies

```tsx
const cookieState = useExternalState(
  CookieStore({
    name: 'preferences',
    attributes: { path: '/', maxAge: 60 * 60 * 24 * 30 }, // 30 days
  }),
  schema,
  { defaultValue: { theme: 'light' } },
);
```

Cookies are polled every second for external changes. Set `pollIntervalMs: 0` to disable polling.

## API reference

### `useExternalState(adapter, schema, options?)`

- `adapter`: a `BrowserStateAdapter<T>` such as `LocalStorageStore`, `CookieStore`, or `QueryParameterStore`.
- `schema`: any Zod schema (`z.object`, `z.string`, etc.).
- `options.defaultValue`: manual default when the schema cannot hydrate one from `undefined` (e.g. when every field is required).
- `options.isEqual`: custom equality check to skip redundant writes. Defaults to a structural deep compare so schemas that create fresh objects (e.g. Zod) do not cause re-renders.
- `options.onValidationError`: tap into validation issues before the hook falls back to the default.
- `options.debounce`: debounce configuration for adapter writes. The hook updates `value` immediately while writes are scheduled with the supplied options.

### Return value

- `value`: the parsed value from the external store.
- `set`: map of per-key setters inferred from the schema (`state.set.search`, `state.set[0]`, ...).
- `setValue(next | updater)`: update the entire value.
- `setAll(next | updater)`: alias for `setValue` for compatibility.
- `merge(partial | updater)`: merge partial updates when the schema resolves to an object/array.
- `status`: `{ kind: "idle" | "defaulted" | "error"; issues?: Issue[] }`

### Adapters

| Adapter                                                                                                                         | Description                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `LocalStorageStore({ key, serializer?, storage? })`                                                                             | JSON by default, cross-tab updates via `storage` events.                              |
| `SessionStorageStore({ key, serializer?, storage? })`                                                                           | Same API as local storage.                                                            |
| `CookieStore({ name, attributes?, pollIntervalMs?, serializer? })`                                                              | Serialises as URL-encoded JSON by default.                                            |
| `QueryParameterStore({ history?, preserveUnknownKeys?, serialize?, parse? })`                                                   | Browser history-backed query params for vanilla React apps.                           |
| `@1apostoli/use-external-state-next` `QueryParameterStore({ history?, preserveUnknownKeys?, serialize?, parse?, navigation? })` | Next.js App Router integration with optional history-only mode via `navigation.mode`. |

### Factories & context helpers

```tsx
import {
  makeContext,
  makeHook,
  makeHOC,
  QueryParameterStore,
  type QueryParameterStoreConfig,
} from '@1apostoli/use-external-state';
import { z } from 'zod';

const schema = z.object({ search: z.string().default('') });
type QueryState = z.infer<typeof schema>;

const useQueryState = makeHook<QueryState, QueryParameterStoreConfig<QueryState>>(
  QueryParameterStore<QueryState>,
);

const QueryState = makeContext(useQueryState, { displayName: 'QueryState' });

const withQueryState = makeHOC(useQueryState);

// Provider usage
<QueryState.Provider schema={schema} config={{ history: 'replace' }}>
  <Search />
</QueryState.Provider>;

// React 19 `use`
function Search() {
  const state = QueryState.use();
  return (
    <input
      value={state.value.search}
      onChange={(event) => state.set.search(event.target.value)}
    />
  );
}

// Higher-order component
const SearchWithState = withQueryState(({ externalState }) => (
  <input
    value={externalState.value.search}
    onChange={(event) => externalState.set.search(event.target.value)}
  />
));

// Later in JSX
<SearchWithState schema={schema} config={{ history: 'replace' }} />;
```

### Debouncer helper

```ts
import { createDebouncer } from '@1apostoli/use-external-state';

const debounced = createDebouncer({ wait: 250 })(callback);
debounced(); // trailing calls by default
debounced.cancel();
debounced.flush();
```

## SSR & client-only contexts

Every adapter performs `window` checks and can safely be imported in shared modules. When a component must only render on the client, wrap it in the provided helper:

```tsx
import { ClientOnly } from '@1apostoli/use-external-state/client-only';

<ClientOnly>
  <SearchWidget />
</ClientOnly>;
```

## Development

- `pnpm run build` – bundle the packages with `tsup`
- `pnpm run test` – run unit tests (Vitest + jsdom)
- `pnpm run typecheck` – strict TypeScript check across packages
- `pnpm --filter basic-local-storage dev` – sample Vite app (see Examples below)

## Examples

All demos live under `examples/`. Install dependencies at the repo root, then run:

- `pnpm dev:basic` – Vite app using `LocalStorageStore`
- `pnpm dev:session` – Vite app persisting a form draft in `sessionStorage`
- `pnpm dev:cookie` – Vite app demonstrating `CookieStore`
- `pnpm --filter next-query-params dev` – Next.js App Router example using `@1apostoli/use-external-state-next`

Each Vite demo automatically rebuilds the workspace package before launching. See `examples/README.md` for more details.

---

MIT License © 2024
