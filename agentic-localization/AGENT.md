# React 19.2 — async-first patterns

- **Sanity caveat**: Sanity data fetching is realtime via observables (useListeningQuery, listenQuery), NOT one-shot promises. `use(promise)` applies to mutations/actions/non-realtime fetches, not to document listeners. Don't replace observable subscriptions with `use`.
- `use(promise)` unwraps promises in render; replaces useEffect+useState for one-shot async
- `<Suspense fallback={…}>` catches unresolved `use()` promises, shows fallback automatically
- `useTransition()` → `startTransition(async () => { … })` wraps async actions; `isPending` disables UI
- No dep arrays needed for async ops — no stale closures
- Do NOT reach for useEffect/setState loading patterns; use `use`+Suspense instead
- Pair `<Suspense>` with `<ErrorBoundary fallback={…}>` — rejected promises from `use()` propagate as errors. No ErrorBoundary = unhandled crash.

# Prefer package exports — don't reinvent

- Before writing a util, assertion, parser, type guard, or helper: check if `sanity`, `@sanity/*`, or other workspace packages already export it. Use theirs.
- Sanity packages expose a lot: validators, path utils, schema helpers, client methods, UI components, typed assertions. Grep exports before rolling your own.
- Same for `groq`, `@sanity/client`, `@sanity/types`, `@sanity/ui`, `@sanity/image-url`, etc. — rich surface area, lean on it.
- If a local workspace package (`packages/*`) already has a util, import it. Don't duplicate across packages.
- **Types**: prefer generated types (Sanity TypeGen) or types from `sanity` or `@sanity/*`. Don't hand-write interfaces for document shapes, schema types, or client responses that already have generated/exported types.

# Monorepo

- Use `pnpm`, not `npm`
- Run commands from root via `pnpm --filter <pkg>` (e.g. `pnpm --filter l10n test`)
