# Sanity Functions

This project uses [Sanity Functions](https://www.sanity.io/docs/functions) to run serverless event handlers that react to document lifecycle events in the Content Lake. Functions are defined in `functions/` and deployed via [Blueprints](https://www.sanity.io/docs/blueprints) (`sanity.blueprint.ts`).

---

## Build pipeline

### Why rolldown?

The Sanity Functions CLI (`@sanity/runtime-cli`) has a built-in transpile step that uses **Vite** with `preserveModules: true` and `external: [/node_modules/]`. After transpiling, it runs `@architect/hydrate` to install npm dependencies into the deploy artifact.

This breaks in **pnpm monorepos** because workspace packages (like `@starter/l10n`) resolve via **symlinks**, not under `node_modules/`. Vite sees a resolved path outside `node_modules/` and inlines the workspace code — but the workspace package's **transitive npm dependencies** (`@portabletext/markdown`, `@portabletext/toolkit`, `diff`, etc.) stay external since they _are_ under `node_modules/`. `@architect/hydrate` then fails to resolve them because there's no `package.json` with declared dependencies at the function level.

The fix: **pre-bundle with rolldown** so all transitive dependencies are resolved at build time and the CLI's transpile + hydrate steps are bypassed entirely.

### Why not fix pnpm instead?

There are a few ways to make pnpm conform to what the CLI expects, but none are good tradeoffs:

- **`shamefully-hoist=true`** in `.npmrc` flattens all deps into root `node_modules/`, so workspace package paths would match Vite's `/node_modules/` external regex. But this defeats pnpm's strict dependency model and creates phantom dependency issues across the entire monorepo — a heavy tradeoff for one use case.
- **`pnpm deploy` per function** creates an isolated install with a flat `node_modules/`. But it's a whole deployment pipeline per function, and you'd need a `package.json` per function declaring every transitive dep.
- **Function-level `package.json`** listing all transitive deps so `@architect/hydrate` can install them. But hydrate runs `pnpm i --prod` inside the `.build/` directory, which doesn't participate in the workspace — fragile and duplicative.

### Why pre-bundling is better for serverless anyway

Even if pnpm worked with the CLI's pipeline, pre-bundling is the better choice for serverless:

- **Cold start**: V8 parses one file instead of traversing a `node_modules/` tree. `@portabletext/markdown` alone has several transitive deps — each is a separate file read at import time.
- **Deploy size**: tree-shaken 286 KB vs. full packages with all their exports. The `diff` package is much larger than what `diffWords` actually needs.
- **No deploy-time installs**: `@architect/hydrate` adds latency and a failure mode to every deploy. With pre-bundling, the artifact is ready to upload.
- **Determinism**: what you build locally is exactly what runs in production. No version resolution on a remote machine.
- **Package manager agnostic**: works the same whether the monorepo uses pnpm, npm, yarn, or bun.

### How the CLI bypass works

The CLI build pipeline (`@sanity/runtime-cli`) follows these steps:

1. `defineDocumentFunction({ name })` defaults `src` to `functions/<name>` if not specified
2. `findFunctionEntryPoint(src)` resolves in order: `package.json#main` → `index.ts` → `index.js`
3. `shouldTranspileFunction` checks a `transpile` flag, else checks if entry is `.ts`
4. `transpileFunction` → Vite build (`preserveModules: true`, `external: [/node_modules/]`)
5. `resolveResourceDependencies` → `@architect/hydrate` installs npm deps

By pointing the blueprint `src` at **pre-bundled `.js` output** (`functions/dist/<name>`):

- `findFunctionEntryPoint` finds `index.js` → **skips Vite transpile** (not `.ts`)
- hydrate finds no `package.json` with deps → **no-op**

### Rolldown configuration

```
pnpm build:functions        # → rolldown -c functions/rolldown.config.ts
```

Config: [`functions/rolldown.config.ts`](../functions/rolldown.config.ts)

**Key decisions:**

| Setting         | Value                                   | Why                                                                                                                                                                                           |
| --------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`        | `esm`                                   | Sanity Functions runtime expects ESM                                                                                                                                                          |
| `platform`      | `node`                                  | Functions run on Node 20                                                                                                                                                                      |
| `codeSplitting` | `false`                                 | Each function must be a single self-contained file — the deploy artifact is one `index.js` per function directory. Shared chunks aren't supported by the CLI's deploy layout.                 |
| `sourcemap`     | `true`                                  | Stack traces from the Functions runtime map back to source                                                                                                                                    |
| `external`      | `/^@sanity\//`, `/^sanity/`, `/^groq$/` | These are **runtime-provided** by the Sanity Functions platform — they don't need to be in the bundle. Regex patterns match each package and all subpath exports (e.g. `@sanity/client/csm`). |

Everything else is **bundled**: `@starter/l10n/*`, `@portabletext/*`, `diff`, and other npm deps are resolved and tree-shaken into each output file. The `sanity` package has `"sideEffects": false` so imports like `getPublishedId` tree-shake cleanly even though `sanity` itself is externalized.

**Separate configs per entry** — each function gets its own rolldown config object (not multiple entries in one config). This prevents rolldown from creating shared chunks between functions, since `codeSplitting: false` only guarantees no chunks _within_ a single entry.

### Adding a new function

1. Create `functions/<name>.ts` with a `handler` export using `documentEventHandler` or `scheduledEventHandler`
2. Add an entry to `functions/rolldown.config.ts`:
   ```ts
   {
     input: { '<name>/index': '<name>.ts' },
     ...shared,
   }
   ```
3. Add the function to `sanity.blueprint.ts` — point `src` at the bundled output:
   ```ts
   defineDocumentFunction({
     name: '<name>',
     src: 'functions/dist/<name>',
     // ...event config
   })
   ```
4. Run `pnpm build:functions` and verify the output is a single file at `functions/dist/<name>/index.js`

---

## Functions

### mark-translations-stale

**Source:** [`functions/mark-translations-stale.ts`](../functions/mark-translations-stale.ts)

**Trigger:** `publish` event on `article` documents where `language == 'en-US'` (base language).

**What it does:** When a base-language document is published, this function finds the `translation.metadata` document that references it and marks all non-missing translation entries as `stale`. This signals to editors and the analyze function that translations may be out of date.

**Flow:**

1. Guard: skip if document language isn't `en-US`
2. Strip `drafts.`/`versions.` prefix to get the published ID
3. GROQ query: find `translation.metadata` where `translations[].value._ref` matches the published ID
4. Normalize `workflowStates` (handles both array and legacy object shapes)
5. Filter entries to mark: skip `missing` and already `stale` entries
6. Patch: set `status: 'stale'`, `staleSourceRev`, and `updatedAt` on each entry — preserves existing `source` (ai/manual) since staleness is orthogonal to how the translation was produced

**Blueprint config:**

| Field          | Value                                       |
| -------------- | ------------------------------------------- |
| `timeout`      | 15s                                         |
| `robotToken`   | `fn-robot` (editor role)                    |
| `event.on`     | `publish`                                   |
| `event.filter` | `_type == 'article' && language == 'en-US'` |

---

### analyze-stale-translations

**Source:** [`functions/analyze-stale-translations.ts`](../functions/analyze-stale-translations.ts)

**Trigger:** `update` event on `translation.metadata` documents where `count(workflowStates[status == 'stale']) > 0`.

**What it does:** Chains after `mark-translations-stale`. When metadata is updated with stale entries, this function computes a field-level diff between the historical and current source document, runs AI analysis to assess change materiality, and pre-translates changed fields for all stale locales.

**Flow:**

1. Fetch the full metadata document (translations, workflowStates, staleAnalysis cache)
2. **Freshness guard**: skip if a valid analysis already exists for this `staleSourceRev` (prevents infinite loops — this function writes to the metadata doc it triggers on)
3. Find the base-language source document ref from `translations[]`
4. Fetch historical doc (via History API at `sourceRevision`) and current doc in parallel
5. Compute field-level diff using `computeFieldChanges` from `@starter/l10n/core`
6. Build a field summary with word-level diffs (via `diffWords` from the `diff` package)
7. **AI analysis**: send the field summary to `agent.action.prompt` with `ANALYSIS_PROMPT_INSTRUCTION` — returns materiality classification (`cosmetic`/`minor`/`material`) and per-field suggestions
8. **Phase 1 cache write**: write analysis results immediately so the inspector UI has data even if pre-translation times out
9. **Pre-translate**: for each field recommended for retranslation, call `agent.action.translate` with `noWrite: true` for every stale locale, batched in groups of 3 for rate limiting. Assembles style guide and glossary context per-locale.
10. **Phase 2 cache write**: overwrite cache with analysis + pre-translation suggestions

**Blueprint config:**

| Field          | Value                                                                             |
| -------------- | --------------------------------------------------------------------------------- |
| `timeout`      | 120s                                                                              |
| `memory`       | 1 GB                                                                              |
| `robotToken`   | `fn-robot` (editor role)                                                          |
| `event.on`     | `update`                                                                          |
| `event.filter` | `_type == 'translation.metadata' && count(workflowStates[status == 'stale']) > 0` |

**Key dependencies bundled:**

- `@starter/l10n/core/*` — field diffing, text extraction, analysis cache, prompt templates
- `@starter/l10n/promptAssembly` — glossary filtering, style guide assembly, protected phrases
- `@starter/l10n/queries` — GROQ queries for glossaries and style guides
- `diff` — word-level diffing for the field summary
- `@portabletext/*` — Portable Text to markdown conversion (via promptAssembly)

---

## Event chain

```
article (en-US) published
        │
        ▼
┌─────────────────────────┐
│ mark-translations-stale │  sets workflowStates[].status = 'stale'
│ (15s timeout)           │  on translation.metadata
└───────────┬─────────────┘
            │ metadata update triggers
            ▼
┌────────────────────────────┐
│ analyze-stale-translations │  computes diff → AI analysis → pre-translate
│ (120s, 1GB)                │  writes staleAnalysis cache on metadata
└────────────────────────────┘
            │
            ▼
  Studio inspector reads staleAnalysis
  and shows materiality + suggestions
```
