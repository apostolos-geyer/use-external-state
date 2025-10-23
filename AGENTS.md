# Agent Playbook

This repository ships two workspace packages:

- `@1apostoli/use-external-state`: core hook + browser storage adapters (Zod-only)
- `@1apostoli/use-external-state/next`: query-parameter adapter for the Next.js App Router

All packages are TypeScript-first, React 18/19 friendly, and rely on Zod v4 for schema validation.

## Architecture Overview

- **Entry points**
  - `packages/use-external-state/src/index.ts` (core exports)
  - `packages/use-external-state/src/client-only.tsx` (SSR-safe helper)
  - `packages/use-external-state-next/src/index.ts` (Next.js adapter)
- **Core hook** (`packages/use-external-state/src/use-external-state.ts`)
  - Accepts any Zod schema (`safeParse` on reads/writes, `defaultValue` fallback)
  - Default equality uses structural deep comparison; overridable via `options.isEqual`
  - Normalises Zod issues before invoking `onValidationError`
- **Adapters**
  - `packages/use-external-state/src/stores/web-storage.ts`: local/session storage with optional custom serializer
  - `packages/use-external-state/src/stores/cookie.ts`: cookie-backed store (polling for external changes)
  - `packages/use-external-state-next`: Next.js query param store (`push`/`replace`, merge behaviour)
- **Utilities**
- `packages/use-external-state/src/debounce.ts`: exported debouncer factory
- `packages/use-external-state/src/internal/*`: emitter + browser guards

## Workflows

- Lint: `pnpm run lint`
- Typecheck: `pnpm run typecheck`
- Tests: `pnpm run test`
- Build: `pnpm run build`
- Examples: `pnpm --filter basic-local-storage dev` (see `examples/README.md`)

Examples are self-contained Vite/Next projects. Vite demos call the workspace build (`pnpm run build`) before starting dev/preview/build.

## Validation Strategy

- Always accept Zod schemas. Defaults come from `schema.safeParse(undefined)` or user-provided `defaultValue`
- On failure: normalise issues (`ValidationIssue`), trigger `onValidationError`, write fallback back to store
- `null` vs `undefined` semantics must be preserved in adapters

## Operational Guidelines

- Never introduce Standard Schema dependencies—Zod v4 is the only validator target
- Keep exports dual ESM/CJS compatible; maintain generated `build/` directories via `tsup`
- When touching adapters or the core hook, add tests (`tests/use-external-state.test.tsx` or new files)
- Keep documentation current (`README.md`, `examples/README.md`, per-package READMEs)
- Update version numbers for both packages and changelog entries before publishing

## Examples

- `examples/react-vite`: Vite + React demos using built-in adapters.
- `examples/next-query-params`: Next.js App Router example depending on `@1apostoli/use-external-state/next`.

## Release Checklist

1. `pnpm install`
2. `pnpm run lint`
3. `pnpm run typecheck`
4. `pnpm run test`
5. `pnpm run build`
6. `pnpm --filter <example> build` (sanity-check demos)
7. Update package versions + changelog

Stay disciplined with React 19 best practices, and prioritise predictable, type-safe ergonomics.
