# @apostoli/use-external-state

React hook for managing browser-backed state with Zod v4 validation. See the
[monorepo README](../../README.md) for full documentation, API reference, and
examples.

- **Install**: `pnpm add @apostoli/use-external-state`
- **Exports**: `useExternalState`, `LocalStorageStore`, `SessionStorageStore`,
  `CookieStore`, `createDebouncer`, and keyed setter helpers.

The package ships both modern (ESM) and legacy (CJS) bundles under
`build/modern` and `build/legacy` respectively, and includes type declarations
for each target.
