# Operating the pipeline

Deploying, observing, and getting a stuck run moving again.

## Deploy order

Four artifacts, and the order matters:

```sh
pnpm --filter @starter/functions build   # blueprint points at functions/dist/<name>
pnpm exec sanity blueprints deploy       # datasets, robot token, Function resources
pnpm --filter studio exec sanity schema deploy   # Agent Actions resolves against this
pnpm workflows:deploy                    # sanity-workflows deploy, per sanity.workflow.ts
```

Skipping the build ships the previous bundle — the Functions CLI is handed a
prebuilt `index.js` on purpose (see
[`docs/FUNCTIONS.md`](../../../docs/FUNCTIONS.md)), so nothing rebuilds it for
you. Blueprint and definition deploys are independent: a new subject type needs
both.

Run blueprint and Function commands from the repo root. The CLI finds the
blueprint by walking **up** from cwd, and `sanity.config.ts` is not required.

## Observing a run

`sanity-workflows` is the engine's CLI, and `diagnose` is the one command worth
memorising — it explains why an instance is or is not progressing and what would
unstick it.

| Command                            | Use                                                   |
| ---------------------------------- | ----------------------------------------------------- |
| `sanity-workflows list`            | In-flight instances in the configured dataset         |
| `sanity-workflows show`            | One instance: state, activities, effects              |
| `sanity-workflows diagnose`        | Why it is stuck, and what would move it               |
| `sanity-workflows tail`            | Stream history entries as they land                   |
| `sanity-workflows definition diff` | In-code definition against what is actually deployed  |
| `sanity-workflows fire-action`     | Fire an action to unstick a waiting activity          |
| `sanity-workflows reset-activity`  | Re-run or `--skip` a failed activity                  |
| `sanity-workflows abort`           | Hard stop: cancel effects, drop guards, mark terminal |

`--help` on any of them for flags. In the Studio, every localization subject has
a Workflows view (`workflowDefaultDocumentNode()`) and the Translations inspector
renders the open run; `apps/translations-dashboard/` shows coverage across
locales. Raw instances are queryable as `sanity.workflow.instance` documents in
the **workflows** dataset — not the content dataset.

## Nothing happened after publishing

Walk it in this order; each step rules out one layer.

1. **Was the run even started?** `sanity-workflows list`. If there is no
   instance, the trigger did not fire: check the `start-localization` event filter
   in `sanity.blueprint.ts` matches the document's `_type` and language, and that
   the blueprint deploy actually succeeded.
2. **Is the reader looking at the right partition?** `WORKFLOWS_DATASET` and
   `WORKFLOW_TAG` must match across `sanity.workflow.ts`, `sanity.blueprint.ts`
   env, the Studio plugin and the dashboard. A mismatch is silent — the reader
   sees an empty partition, not an error.
3. **Is the definition deployed at the version the code expects?**
   `sanity-workflows definition diff`. A parent cannot spawn a child that is not
   deployed.
4. **Is an effect pending but never dispatched?** `sanity-workflows show`. A
   pending effect with no progress means `drain-effects` is not running: check its
   filter (`count(pendingEffects) > 0`), the robot token, and the Function logs.
5. **Is it waiting on a person?** `review` is not stuck. It is the gate.

## A translation failed

`sanity-workflows show` names the failed activity;
`sanity-workflows reset-activity` re-runs it. Then look at the cause:

- **Agent Actions rejects the request.** The schema is not deployed, or was
  deployed from a different workspace. The schema id derives from the workspace
  name — `_.schemas.default` for the `default` workspace in
  `studio/sanity.config.ts`.
- **Empty or partial translation.** The target type or field is not in the
  deployed schema, so the API had nothing to resolve.
- **Style guide too large.** `measureStyleGuide` warns past
  `STYLE_GUIDE_WARN_THRESHOLD` (12,000 characters). Prune with
  `filterGlossaryByContent`, shorten `additionalInstructions`, or split the
  glossary by domain and pass only the relevant one.
- **A locale failed but the document run continued.** By design. A failed child
  settles its cohort slot so one bad locale cannot hang the document;
  `hasFailedLocales` surfaces it to the reviewer.

## Publish or schedule is disabled

A run is open. `localize-document` guards its subject against `publish` while
translating and in review, and `createLocalizationScheduleGate` holds `schedule`
— which sits outside the workflow Studio plugin's lock map. Finish the run,
request changes, or abort it. Do not unwrap either guard.

## A run restarts itself after approval

Only field-tier symptoms look like this. Field-tier runs write into the subject
itself, so a run reading `drafts` would see its own writes as source drift.
`startPerspectiveFor` in `packages/l10n/src/core/fieldTier.ts` starts them on
`published`, and analysis diffs the source-locale projection rather than the whole
document. `packages/l10n/src/workflows/localizeDocument.fieldTier.test.ts` holds
that invariant.

Note the gap the Studio picker has here: the workflow plugin's Start action only
offers `perspectiveField`, so a field-tier run started from the picker reads
drafts. Start those from the publish Function or the dashboard. The inspector says
so when it sees one.

## Field-tier specifics

- **A locale never shows as covered.** Coverage is all-or-nothing:
  `coveredLocales()` counts a locale only when **every** registered field carries
  a value for it. So check the quiet fields, not the obvious one — an empty
  `seo.metaTitle` hides a translated `bio`. The two adjacent causes are the next
  two bullets: a path that was never registered is never filled, and a nested
  path whose `containers` are missing silently loses its write.
- **A field is never translated.** Its path is not in `FIELD_TIER`. The registry
  is static because a handler runs in a Function with no compiled schema to walk.
- **A nested field is written but disappears.** Its ancestor `containers` are
  missing from the registry entry. A Sanity patch does not create missing parents,
  so the patch lands nowhere and the locale never counts as covered.

## Schema and Studio errors

- **"SchemaError: Unknown type"** — `localizedSchemaTypes` names a type that does
  not exist in the Studio's schema.
- **Duplicate type definitions** — `createL10n()` already registers
  `l10n.locale`, `l10n.glossary`, `l10n.styleGuide`, `l10n.proposal` and their
  object types. Do not add them to `studio/schemaTypes/` as well.
- **`useFormValue` returns nothing in the inspector** — it renders outside form
  context. Read the document through `useEditState`, as
  `packages/l10n-studio/src/translations/FieldTierContent.tsx` does.

## Tests, evals and credentials

```sh
pnpm test                                  # every workspace: unit + bench specs
pnpm --filter @starter/l10n test           # the definitions and handlers alone
pnpm --filter @starter/l10n eval           # live model evals — consumes AI credits
pnpm e2e                                   # deployed-stack journeys, needs a project
```

A suite that talks to a real project resolves its token through
`@starter/l10n/credentials` (`getUserToken`): `SANITY_AUTH_TOKEN` first, then a
local `sanity login` session. `getCliClient` from `sanity/cli` does **not**
resolve a token outside the CLI process — under vitest its internal getter
returns undefined. Pass a token explicitly.

Eval scores are noisy by nature: each case draws multiple translations and
asserts on the aggregate, and the judge averages several trials. A single draw is
not a signal. If a case scores low despite a correct-looking translation, check
that the fixture's `sourceText` is the text actually being translated — a
mismatch scores the judge against the wrong source.

## Env loading gotcha

`sanity.blueprint.ts` and `sanity.workflow.ts` are loaded by **jiti**, where
`process.loadEnvFile()` silently succeeds without setting anything. Both parse
`.env` by hand for that reason. `import.meta.dirname` is synthesized correctly;
`process.cwd()` reflects the pnpm filter's cwd, not the file's directory. Copy the
existing pattern rather than reintroducing `loadEnvFile`.
