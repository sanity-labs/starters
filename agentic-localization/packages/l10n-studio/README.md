# @starter/l10n-studio

The Studio surface of the localization pattern: the plugin, the schema types, and
the Translations pane where a human reviews what the engine produced.

This is the only layer allowed `react`, `sanity`, `@sanity/ui`, `@sanity/icons`
and `styled-components`. Everything that is not UI — the status vocabulary,
instance readers, prompt assembly, the workflow definitions — comes from
[`@starter/l10n`](../l10n) and is deliberately **not** re-exported here, so a
Function or a frontend never reaches it through this package.

## Entries

### `@starter/l10n-studio` — the plugin and its UI

| Export                                                                                                   | What it is                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `createL10n({localizedSchemaTypes, defaultLanguage})`                                                    | Returns `{plugin, injectLanguageField}`. `plugin` registers the schema types, i18n bundle, navbar, locale badge and Translations inspector |
| `withLocaleFilter(list)`                                                                                 | Scopes a structure document list to the active locale                                                                                      |
| `createTranslationInspector(config)`                                                                     | The Translations inspector on its own, for a custom plugin composition                                                                     |
| `createLocalizationScheduleGate()`                                                                       | The document action that gates scheduling on an open run                                                                                   |
| `ReviewMatrix`, `ReviewActions`, `TranslationCompare`, `InlineDiff`, `PortableTextDiff`, `ErrorBoundary` | The pane's components, reusable in a custom pane                                                                                           |
| `useTranslationTargets`, `useBaseDocumentId`, `useReleases`, `useOpenTranslationsInspector`              | Hooks the pane is built from                                                                                                               |
| `useLocalizationEngine`, `useLocalizationInstance`, `LOCALIZE_DOCUMENT_DEFINITION`                       | Studio-side engine wiring. The definition name comes from the definition itself, so config cannot drift                                    |
| `buildEditIntent`                                                                                        | The intent link that opens a locale's document at the right field and perspective                                                          |
| `useLocales`, `useLocaleFilter`, `globalLocaleFilter$`                                                   | Locale context and the cross-pane filter                                                                                                   |

### `@starter/l10n-studio/schemas` — the schema types

| Export                                                              | What it is                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `translationLocale`, `translationGlossary`, `translationStyleGuide` | The three document types (`l10n.locale`, `l10n.glossary`, `l10n.styleGuide`)                                       |
| `proposal({subjectTypes})`                                          | The learning loop's `l10n.proposal` type — a factory, because `subject` references the project's own subject types |
| `glossaryEntry`, `localeTranslation`                                | The object types a glossary is built from                                                                          |
| `injectLanguageField(types)`                                        | Adds the `language` field to every localized document type                                                         |
| `validateLocaleCode`, `LOCALE_EXISTS_QUERY`                         | The async validator behind that field                                                                              |
| `isUniqueOtherThanLanguage`, `SLUG_UNIQUE_QUERY`                    | Slug uniqueness across locales, version-id-safe (`isUnique` for localized slug fields)                             |

`createL10n()` registers all six types, so this entry is for doing it yourself —
extending a type, renaming a title, or taking the locale document without the rest
of the plugin.

These schemas import `defineType` / `defineField` / `defineArrayMember` from
`@sanity/types`, not `sanity`. They are the same runtime functions; importing the
leaf package is what keeps a schema registration from pulling the whole Studio
into a consumer's bundle. Measured: it was the reason the dashboard's build carried
the Studio at all.

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
