# @starter/l10n

The node floor of the localization pattern: primitives, prompt assembly, the
workflow definitions, and the effect handlers that satisfy them.

Nothing here imports `react`, `sanity`, `@sanity/ui`, `@sanity/icons` or
`styled-components` — not even in type position — so every entry costs the same
inside a Sanity Function, the workflow CLI or a frontend as it does in the
Studio. Two guards enforce that rather than asking you to remember it: an oxlint
zone over `src/**` ([`oxlint.config.ts`](../../oxlint.config.ts)) and
[`src/exports.test.ts`](./src/exports.test.ts), which bundles each entry with
rolldown and asserts on the resolved module ids.

Studio UI lives in [`@starter/l10n-studio`](../l10n-studio).

## Entries

Six, each an explicit barrel — the barrels are the API reference, and every
export documents itself as TSDoc. There are no deep imports: if a name is not
on a barrel, it is internal. A drift test asserts the barrels stay explicit
(no `export *`).

### [`@starter/l10n`](./src/index.ts) — primitives

Schema and field names, plugin configuration, the status vocabulary every
surface renders, BCP-47 locale handling, the field-level tier, revision
diffing, typed reads over workflow instances, and the run-tree projection into
per-locale rows.

### [`@starter/l10n/prompts`](./src/prompts/index.ts) — prompt assembly

The starter's hypothesis in code: context stored as structured content
measurably improves translations. `buildTranslateParams` returns what
`client.agent.action.translate()` takes, assembled from glossaries narrowed to
the terms the document actually contains.

### [`@starter/l10n/workflows`](./src/workflows/index.ts) — the definitions

The three definitions and everything a host must agree with them on: effect
names, the `localize-document` stage vocabulary and its `runPhase` semantics,
the engine coordinates, and the resource clients that admit the project's
other datasets to the engine's surface.

### [`@starter/l10n/effects`](./src/effects/index.ts) — the handlers

The handler map `createEngine({effectHandlers})` takes, each handler singly,
and the runtime they are built on. One rule the entry exists to enforce:
`ctx.client` addresses the workflows dataset only — content traffic goes
through the routing helpers here.

### [`@starter/l10n/distill`](./src/distill/index.ts) — the learning loop

An observer of finished runs, not a phase of one
([adr-002](../../docs/decisions/adr-002-learning-loop.md)). Optional: deleting
this entry, `functions/distill-review/` and one blueprint resource removes the
loop. The pure noise gate that runs before any spend is internal
([`src/core/distillDelta.ts`](./src/core/distillDelta.ts)) — it is why a
reviewer who fixed a comma costs nothing.

### [`@starter/l10n/credentials`](./src/credentials/index.ts) — a token outside the CLI

Its own entry because `configstore` reads the filesystem, and every other entry
is bundled into a Function or a frontend. Consumed by the eval suite and `e2e/`.

## Build your own workflow

`./workflows` and `./effects` are an extension surface, not just this starter's
internals. To localize something the shipped definitions do not cover:

1. **Write the definition** against `@sanity/workflow-engine/define`. Name your
   effects; an effect name is a registry key and must be unique per definition.
2. **Prove it on the bench before deploying.** `createBench` from
   `@sanity/workflow-engine-test` runs the real engine in memory on a
   deterministic clock, with no project and no network. Every definition here has
   a sibling `*.test.ts` doing this — start from
   [`pendingEffects.test.ts`](./src/workflows/pendingEffects.test.ts), which
   asserts the invariant the whole runtime rests on: no instance ever holds more
   than one pending effect, so a drain is worth at most one AI call.
3. **Satisfy the effects.** Reuse a handler, wrap one, or write your own on the
   `effectRuntime` helpers above — client routing, param narrowing, GDR
   arithmetic and the idempotency read are the parts that are easy to get subtly
   wrong.
4. **Register and deploy.** Add the definition to the deploy set
   (`sanity.workflow.ts`) and the handler to the map the drain Function passes
   (`functions/drain-effects`). A parent cannot spawn a child that is not
   deployed.

Engine behaviour the official docs do not cover — cohort `status` meaning
_settled_ rather than _succeeded_, spawn rows needing a projected `_key`, triggers
firing at most once per stage visit — is listed under "What the engine does not
document" in
[`skills/sanity-l10n/references/extending.md`](../../skills/sanity-l10n/references/extending.md).
Read it before writing a definition.

## Why two types are declared here

`InternationalizedArrayItem` and `TranslationReference` are owned upstream by
`sanity-plugin-internationalized-array` and
`@sanity/document-internationalization`. Both plugins are Studio-only, and an
effect handler has to read and write those shapes from inside a Function — so
they are re-declared in [`src/core/types.ts`](./src/core/types.ts). A
bidirectional assignability test in `@starter/l10n-studio` (the only package that
depends on both) fails `typecheck` if the two ever drift.

## Tests and evals

```sh
pnpm test   # unit tests, bench suites, and the bundle-shape assertion
pnpm eval   # live model evals via Agent Actions — consumes AI credits
```

Evals live in [`src/prompts/evals/`](./src/prompts/evals), next to the assembly
they measure. They need `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET` (repo
root `.env`) plus a `SANITY_AUTH_TOKEN` in `packages/l10n/.env` (gitignored — copy
`.env.example`); a `sanity login` session token is the fallback. Each case draws
three translations per arm and asserts on the aggregate, because a single
live-model draw is too noisy to gate on. `EVAL_SAMPLES` draws more.
