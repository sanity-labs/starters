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

# Orchestration belongs to the workflow engine

Localization runs on **Sanity Editorial Workflows**. Do not add orchestration
beside it.

- **Never hand-roll orchestration.** Fan-out, retries, concurrency limits, job
  status, review gates and idempotency are engine primitives — `spawn`, effects,
  transitions, guards, the idempotency ledger. If you find yourself writing a
  semaphore, a status enum, a "is this stale yet" cache, or a `for` loop over
  locales, stop: the engine already has it.
- Workflow definitions live in `packages/l10n/src/workflows/` and are the source
  of truth for how localization runs. State lives on the workflow **instance**;
  content documents hold content state only.
- Every `@sanity/workflow-*` package is an **exact-version peer** of the others.
  Pin exactly, no caret, and upgrade them as one set. Breaking changes ship in
  minor releases.
- Prove definitions with `@sanity/workflow-engine-test` (`createBench`) before
  deploying: the real engine, in memory, deterministic clock, no project or
  network. Specs are sibling `*.test.ts` files.
- Engine behaviour the official docs do not cover is listed under "What the engine
  does not document" in `skills/sanity-l10n/references/extending.md`. Read it
  before writing or changing a definition.

# Where this starter is heading

The end state is **spec-driven, unit- and e2e-tested code composed from small,
domain-specific packages with the smallest possible deployed bundle**. Judge new
code against that, not just against "does it work".

- **Spec first.** Behaviour is proven by executable specs before it ships. For
  workflows that means `createBench` suites; for pure logic, unit tests; for the
  deployed stack, the `e2e/` journeys. Browser journeys are the open gap —
  `e2e/README.md` keeps the honest not-covered list.
- **Domain packages, not one grab-bag.** Two packages split on the React line,
  entries as layers — `docs/decisions/adr-001-package-shape.md` is the decision and
  the two READMEs are the public API.
- **Bundle footprint is a design constraint.** Anything a Function, the CLI or a
  frontend imports must not drag React, `@sanity/ui`, or Studio internals with it.
  `@starter/l10n` is React-free by construction, enforced by an eslint zone and
  `packages/l10n/src/exports.test.ts`. Check before adding an import, not after.
- **Deletion is progress.** Replacing hand-rolled machinery with an engine
  primitive and removing the old code is the goal, not a nice-to-have.

# Monorepo

- Use `pnpm`, not `npm`
- Run commands from root via `pnpm --filter <pkg>` (e.g. `pnpm --filter @starter/l10n test`)
- Node **>=22.12** and Sanity Studio **v6** (the workflow Studio plugin needs 6.3+;
  there is no v5 path)
- `overrides` live in `pnpm-workspace.yaml`, not `package.json` (pnpm 10.30+), and
  do not reach auto-installed peers — declare those explicitly instead
- Starter lock files are gitignored, so CI resolves fresh from the catalog ranges
  in `pnpm-workspace.yaml` on every run
- `sanity.types.ts` is generated **and** gitignored, so a stale artifact hides a
  broken typegen config. `pnpm typecheck` from the root regenerates first;
  `pnpm -r typecheck` does not. Run `pnpm typegen` after moving any file the
  typegen glob in `studio/sanity.cli.ts` scans
