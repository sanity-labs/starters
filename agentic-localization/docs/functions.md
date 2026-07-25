# Sanity Functions

Four [Functions](https://www.sanity.io/docs/functions) are the runtime of the
Editorial Workflows engine — it has no daemon of its own. A fifth, `heartbeat`,
is built but commented out in the blueprint. Triggers, filters, timeouts and env
are declared in [`sanity.blueprint.ts`](../sanity.blueprint.ts), which is the
source of truth; this page says what each one is _for_.

| Function                 | Trigger                                                                                                                       | Verb                                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drain-effects`          | write to a `sanity.workflow.instance` carrying pending effects (workflows dataset)                                            | `drainEffects` then `tick`. The definitions keep at most one effect pending per instance, so an invocation is at most one AI call.                             |
| `start-localization`     | publish of an `article` in the source language, or of a `person`                                                              | `startInstance` under a revision-derived id (start's idempotency key). A run already open is `tick`ed instead, which is what makes `sourceChanged` observable. |
| `handle-deleted-subject` | delete of an `article` or a `person`                                                                                          | `abortInstance` on every run watching the deleted document. A deleted source would otherwise park its run in review forever.                                   |
| `distill-review`         | instance reaching `approved` (workflows dataset)                                                                              | `distillReview` — diff the machine draft against the approved text, gate before spending, write DRAFT `l10n.proposal` documents. At most one AI call per run.  |
| `heartbeat` (opt-in)     | every 15 minutes (`defineScheduleFunction`, `@alpha`). Commented out: a schedule deploys only to an organization-scoped stack | `sweepStaleClaims` → `drainEffects` → `tick` across in-flight instances. Best-effort: the pipeline runs without it.                                            |

All five construct the same engine through
[`functions/engine.ts`](../functions/engine.ts). The effect handlers it registers
are `@starter/l10n/effects`; the definitions they satisfy are
`@starter/l10n/workflows`; the learning loop is `@starter/l10n/distill`, designed
in [adr-002](decisions/adr-002-learning-loop.md).

```
source published                     subject deleted     every 15 min (opt-in)
        │                                   │                    │
        ▼                                   ▼                    ▼
 start-localization              handle-deleted-subject      heartbeat
        │ startInstance / tick            abortInstance      sweep + drain + tick
        ▼
 workflow instance ──(pending effect)──▶ drain-effects ──▶ handler ──▶ instance
        │                                     ▲                            │
        │                                     └────────────────────────────┘
        └──(currentStage == approved)──▶ distill-review ──▶ drafts.l10n.proposal.*
```

`distill-review` is the only one triggered by the engine's own dataset rather than
by content, so it is the only one that has to be told where content lives
(`CONTENT_DATASET_NAME`). It reaches the content dataset with a plain sibling
client; the others need `projectResourceClients` because the engine gates every
ref they supply on the declared resource surface.

---

## Build pipeline

```
pnpm --filter @starter/functions build   # → functions/dist/<name>/index.js
```

Config: [`functions/rolldown.config.ts`](../functions/rolldown.config.ts). One
config object per function — `codeSplitting: false` only guarantees no chunks
_within_ an entry — minified, `platform: 'node'`, and **nothing marked external**.
Every dependency, `@sanity/*` included, is inlined into a single file.

### Why pre-bundle

The Functions CLI (`@sanity/runtime-cli` ≥14.3) bundles workspace dependencies
itself, so a pnpm monorepo deploys without help. Rolldown stays for the
artifact: the CLI hardcodes `minify: false` and ships the inlined TypeScript's
sourcemaps in the zip, where this config minifies and drops the maps — one
tree-shaken file to parse at cold start, no source shipped to the runtime, and
the same file locally and in production.

### How the CLI bypass works

`findFunctionEntryPoint` resolves `package.json#main` → `index.ts` → `index.js`,
and only transpiles a `.ts` entry. Pointing the blueprint `src` at
`functions/dist/<name>` hands it an `index.js`, so Vite is skipped; the directory
has no `package.json`, so hydrate is a no-op; and nothing is external, so there is
nothing left to hydrate anyway.

### Adding a function

1. `functions/<name>/index.ts` exporting `handler` from `documentEventHandler` or
   `scheduledEventHandler`.
2. Add `<name>` to the `functions` array in `rolldown.config.ts`.
3. Add a `defineDocumentFunction` / `defineScheduleFunction` resource in
   `sanity.blueprint.ts` with `src: 'functions/dist/<name>'`.

Anything a Function imports is inlined, so keep React, `@sanity/ui` and Studio
internals out of its import graph — `grep -c "react-dom\|@sanity/ui" dist/<name>/index.js`
must be `0`.
