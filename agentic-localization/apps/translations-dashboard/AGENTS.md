# AGENTS.md — Translations Dashboard

Read [ARCHITECTURE.md](./ARCHITECTURE.md) first; it is short and it is the map.

## Rules specific to this app

**Orchestration belongs to the engine.** No concurrency pools, no status enums,
no "is this stale yet" caches, no polling. If the answer looks like a `for` loop
over locales, the definition in `packages/l10n/src/workflows/` already has it.
The app may call `startInstance`, `fireAction` and `tick`; that is the list.

**Instance state is read, never written.** Content documents hold content state;
the run holds workflow state. `translation.metadata` is the i18n plugin's join
document — read `translations[]`, write nothing.

**One place interprets stages.** `lib/localizationRun.ts`, proven by its sibling
test. A stage name anywhere else is a bug.

**Derived hooks fetch nothing.** They are `useMemo` over
`useTranslationAggregateData`. Adding a query to one of them breaks the single-
fetch property the whole layer rests on.

**React 19.2 + React Compiler.** No `useEffect` + `setState` fetch patterns; the
workflow hooks are already reactive. Async actions go through `useTransition`.

**Prefer package exports.** `@starter/l10n` owns the shared, React-free readers
(`readDocumentId`, `readFlag`, `readLocaleRequests`, `childInstanceIds`) and
the status display map (`getStatusDisplay`). `@sanity/workflow-engine` owns
`gdrRef`, `releaseRef`, `parseGdr`. Check before writing a helper.

## Gotchas that cost time

- `@sanity/workflow-sdk` has **no** engine hook. `hooks/useL10nEngine.ts` builds
  it, and its client must be bound to the `workflows` dataset — the engine
  assumes `client` addresses its own resource.
- `useWorkflowInstances` returns in-flight instances only. `loading: false` with
  an empty list is a confirmed "none", not "still loading".
- A cohort's `status` means _settled_, not _succeeded_. Read the child's `stage`.
- Subworkflow rows accumulate across stage visits; the newest row per `rowKey` is
  the current attempt.
- `@sanity/workflow-components` ships no types. The ambient declaration in
  `src/types/workflow-components.d.ts` covers what the SDK re-exports.

## Commands

```bash
pnpm --filter @starter/translations-dashboard dev        # port 3334
pnpm --filter @starter/translations-dashboard test       # localizationRun + useL10nEngine specs
pnpm --filter @starter/translations-dashboard typecheck
pnpm lint && npx oxfmt --check .                         # from the repo root
```
