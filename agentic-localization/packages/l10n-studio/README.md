# @starter/l10n-studio

The Studio surface of the localization pattern: the plugin, the schema types, and
the Translations pane where a human reviews what the engine produced.

This is the only layer allowed `react`, `sanity`, `@sanity/ui`, `@sanity/icons`
and `styled-components`. Everything that is not UI — the status vocabulary,
instance readers, prompt assembly, the workflow definitions — comes from
[`@starter/l10n`](../l10n) and is deliberately **not** re-exported here, so a
Function or a frontend never reaches it through this package.

## Entries

Two explicit barrels — the barrels are the API reference, and every export
documents itself as TSDoc. If a name is not on a barrel, it is internal.

### [`@starter/l10n-studio`](./src/index.ts) — the plugin and its UI

`createL10n()` and the pieces it is composed from: the structure helpers
(locale filter, the run-state inbox), the Translations inspector and its
components and hooks, the schedule gate, and the Studio-side engine wiring.

### [`@starter/l10n-studio/schemas`](./src/schemas/index.ts) — the schema types

`createL10n()` registers all seven types, so this entry is for doing it
yourself — extending a type, renaming a title, or taking the locale document
without the rest of the plugin.

These schemas import `defineType` / `defineField` / `defineArrayMember` from
`@sanity/types`, not `sanity`. They are the same runtime functions; importing
the leaf package is what keeps a schema registration from pulling the whole
Studio into a consumer's bundle. Measured: it was the reason the dashboard's
build carried the Studio at all.

## Usage

```ts
import {createL10n, withLocaleFilter} from '@starter/l10n-studio'

const l10n = createL10n({localizedSchemaTypes: ['article'], defaultLanguage: 'en-US'})

export default defineConfig({
  plugins: [l10n.plugin],
  schema: {types: l10n.injectLanguageField(schemaTypes)},
})
```

`studio/sanity.config.ts` is the worked example, including how the plugin composes
with `workflowStudioPlugin()` and where each tier's start behaviour is configured.

## Where the type contract lives

[`src/internationalizedArrayContract.test.ts`](./src/internationalizedArrayContract.test.ts)
holds `@starter/l10n`'s locally declared `internationalizedArray` shapes against
the plugins that own them. This is the only package that depends on both, so it is
the only place the check can live — and it is type-level, so drift fails
`typecheck` rather than a run.

## Tests

```sh
pnpm test
```
