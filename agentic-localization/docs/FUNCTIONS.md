# Sanity Functions

Four [Functions](https://www.sanity.io/docs/functions) are the runtime of the
Editorial Workflows engine — it has no daemon of its own. Triggers, filters,
timeouts and env are declared in [`sanity.blueprint.ts`](../sanity.blueprint.ts),
which is the source of truth; this page says what each one is _for_.

| Function                 | Trigger                                                                            | Verb                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drain-effects`          | write to a `sanity.workflow.instance` carrying pending effects (workflows dataset) | `drainEffects` then `tick`. The definitions keep at most one effect pending per instance, so an invocation is at most one AI call.                             |
| `start-localization`     | publish of a source `article`                                                      | `startInstance` under a revision-derived id (start's idempotency key). A run already open is `tick`ed instead, which is what makes `sourceChanged` observable. |
| `handle-deleted-subject` | delete of an `article`                                                             | `abortInstance` on every run watching the deleted document. A deleted source would otherwise park its run in review forever.                                   |
| `heartbeat`              | every 15 minutes (`defineScheduleFunction`, `@alpha`)                              | `sweepStaleClaims` → `drainEffects` → `tick` across in-flight instances. Best-effort: the pipeline runs without it.                                            |

All four construct the same engine through
[`functions/engine.ts`](../functions/engine.ts). The effect handlers it registers
are `@starter/l10n/effects`; the definitions they satisfy are
`@starter/l10n/workflows`. See
[WORKFLOW_ENGINE_MIGRATION.md](WORKFLOW_ENGINE_MIGRATION.md) for the engine
behaviour behind these choices.

```
article (en-US) published            article deleted        every 15 min
        │                                   │                    │
        ▼                                   ▼                    ▼
 start-localization              handle-deleted-subject      heartbeat
        │ startInstance / tick            abortInstance      sweep + drain + tick
        ▼
 workflow instance ──(pending effect)──▶ drain-effects ──▶ handler ──▶ instance
                                              ▲                            │
                                              └────────────────────────────┘
```

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

The Functions CLI (`@sanity/runtime-cli`) transpiles with Vite
(`external: [/node_modules/]`) and then runs `@architect/hydrate` to install npm
deps into the artifact. In a pnpm workspace that breaks: `@starter/l10n` resolves
through a symlink outside `node_modules/`, so Vite inlines it while leaving its
transitive deps external — and hydrate has no function-level `package.json` to
resolve them from. The pnpm-side fixes all cost more than they save
(`shamefully-hoist` defeats strict resolution repo-wide; `pnpm deploy` or a
per-function `package.json` is a second deployment pipeline).

Pre-bundling is the better serverless artifact regardless: one file to parse at
cold start, tree-shaken, no deploy-time install, and identical locally and in
production.

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
