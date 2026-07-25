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

This starter is migrating its hand-rolled orchestration onto **Sanity Editorial
Workflows**. Roughly 4,600 lines of duplicated translate pipelines, semaphores,
status reducers and cache-based loop guards are on the delete list. Do not add
more of it.

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
- Read `docs/WORKFLOW_ENGINE_MIGRATION.md` before touching any of this. It records
  engine behaviour verified empirically that the official docs do not cover —
  cohort `status` meaning _settled_ rather than _succeeded_, `current` going false
  once a spawning stage is exited, triggers firing once per stage visit, and more.

# Where this starter is heading

The end state is **spec-driven, unit- and e2e-tested code composed from small,
domain-specific packages with the smallest possible deployed bundle**. Judge new
code against that, not just against "does it work".

- **Spec first.** Behaviour is proven by executable specs before it ships. For
  workflows that means `createBench` suites; for pure logic, unit tests; for the
  deployed surfaces, end-to-end coverage (**not yet present — a real gap today**,
  the suite is unit tests plus live-model evals).
- **Domain packages, not one grab-bag.** `packages/l10n` is currently a monolith
  papered over with fifteen sub-path exports. The direction is real packages split
  by domain — workflow definitions, prompt assembly, schemas, Studio UI — each with
  a stable public API, so consumers take a dependency on a domain rather than on
  everything.
- **Bundle footprint is a design constraint.** Anything a Function, the CLI or a
  frontend imports must not drag React, `@sanity/ui`, or Studio internals with it.
  Keep pure logic and definitions free of UI imports. `src/workflows/` and
  `src/core/` are the reference: engine and stdlib only, so they compose anywhere.
  Check before adding an import, not after.
- **Deletion is progress.** Replacing hand-rolled machinery with an engine
  primitive and removing the old code is the goal, not a nice-to-have.

# Monorepo

- Use `pnpm`, not `npm`
- Run commands from root via `pnpm --filter <pkg>` (e.g. `pnpm --filter l10n test`)
- Node **>=22.12** and Sanity Studio **v6** (the workflow Studio plugin needs 6.3+;
  there is no v5 path)
- `overrides` live in `pnpm-workspace.yaml`, not `package.json` (pnpm 10.30+), and
  do not reach auto-installed peers — declare those explicitly instead
- Starter lock files are gitignored, so CI resolves fresh from the catalog ranges
  in `pnpm-workspace.yaml` on every run
