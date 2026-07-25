# Agentic Localization Starter

Make AI translation match your brand voice and terminology standards.

Without structured context, AI translates "Releases" as "Veröffentlichungen" in German — but it's a product name that should stay in English. This starter stores glossaries, style guides, and locale rules as structured Sanity documents, assembles them into prompts at translation time, and includes an eval framework that proves the quality impact.

## What you get

- **Translation metadata as content** — Glossaries, style guides, and locale rules are Sanity documents that content teams manage in the Studio
- **Automated stale detection** — On publish, AI analyses what actually changed and retranslates only the locales it affects; cosmetic edits complete without involving a person
- **Durable localization runs** — Fan-out, review gates, retries and audit are [Editorial Workflows](https://www.sanity.io/docs/editorial-workflows/concepts) definitions rather than hand-rolled orchestration ([migration in progress](docs/WORKFLOW_ENGINE_MIGRATION.md))
- **Translation pane and inspector** — Studio UI for reviewing translation status, applying pre-translations, and triggering new translations
- **Translations dashboard** — Real-time overview of coverage, gaps, and stale documents across all locales (Sanity App SDK)
- **Localized frontend** — Next.js app with path-based i18n routing, locale switcher, and fallback content
- **Quality evals** — Translate with and without context, measure the delta with deterministic checks and an LLM judge

## Getting started

**Prerequisites:** Node.js >=22.12, pnpm, a [Sanity account](https://www.sanity.io/get-started)

### 1. Create the project

```sh
pnpm create sanity@latest --template sanity-labs/starters/agentic-localization --package-manager pnpm
```

This prompts you to select (or create) a Sanity project and dataset, then writes your `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` to `.env`. All workspaces in the monorepo read from this single file — prefix mappings at the bottom resolve the values to each workspace's expected env var names.

> **Cloning manually?** Copy `.env.example` to `.env` and fill in your project ID and dataset from [sanity.io/manage](https://www.sanity.io/manage).

### 2. Install and bootstrap

```sh
cd your-project
pnpm bootstrap
```

`pnpm bootstrap` consolidates env files, resolves the organization ID, deploys the blueprint (CORS, dataset, robot token, serverless functions), deploys the schema, generates types, seeds locale documents, and imports sample content.

<details>
<summary>Running bootstrap steps manually</summary>

```sh
# 1. Consolidate env — copy .env.example to .env if it doesn't exist, fill in project ID and dataset
cp .env.example .env

# 2. Resolve organization ID — find it at sanity.io/manage → project settings
# Uncomment SANITY_STUDIO_ORGANIZATION_ID in .env and set it to your org ID

# 3. Deploy blueprint (CORS, dataset, robot token, serverless functions)
pnpm --filter @starter/functions build
pnpm exec sanity blueprints init --stack-name production --project-id <your-project-id>
pnpm exec sanity blueprints deploy

# 4. Deploy schema
pnpm --filter studio exec sanity schema deploy

# 5. Generate types
pnpm --filter studio exec sanity schema extract
pnpm --filter studio exec sanity typegen generate

# 6. Seed locale documents
pnpm --filter studio exec sanity migration run seed-locales --no-dry-run --no-confirm

# 7. Import sample content
pnpm --filter studio exec sanity dataset import sample-data.ndjson <your-dataset> --replace
```

</details>

### 3. Start developing

```sh
pnpm dev
```

Opens the Studio at [localhost:3333](http://localhost:3333), the translations dashboard at [localhost:3334](http://localhost:3334), and the Next.js frontend at [localhost:3000](http://localhost:3000).

> **Frontend env:** The frontend inherits `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` from the root `.env` automatically. For server-side data fetching with a private dataset, add a `SANITY_API_READ_TOKEN` (create one at [sanity.io/manage](https://www.sanity.io/manage) → API → Tokens).

## How it works

1. **Define metadata** in the Studio: locales, glossaries (approved translations, do-not-translate terms, forbidden terms), and style guides (formality, tone, audience instructions per locale)
2. **Assemble prompt**: `assembleStyleGuide()` converts structured metadata into an instruction string; `filterGlossaryByContent()` prunes to relevant terms
3. **Translate**: `buildTranslateParams()` packages everything for the [Agent Actions Translate API](https://www.sanity.io/docs/agent-actions), including protected phrases extracted from do-not-translate entries
4. **Evaluate**: translate with and without context, score with deterministic checks and an LLM judge, compare the quality delta

Only glossary entries whose terms appear in the source document are injected (content-aware filtering), so prompts stay focused.

## Orchestration: moving to Editorial Workflows

Steps 1–4 above are the quality half of the starter and are stable. The half that
coordinates the work — deciding which locales need retranslating, fanning out,
tracking status, gating review — is being rebuilt on [Sanity Editorial Workflows](https://www.sanity.io/docs/editorial-workflows/concepts)
so that a localization job is one durable, resumable, auditable run instead of
status spread across metadata arrays, React reducers and duplicated pipelines.

Three definitions live in `packages/l10n/src/workflows/`:

| Definition          | Scope                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `localize-campaign` | A batch of documents shipped together as one Content Release                             |
| `localize-document` | One source document across every locale that needs work, including the human review pass |
| `localize-locale`   | One target locale of one document; machine-only                                          |

They are authored and covered by an in-memory spec suite that runs the real engine
with no project or network (`pnpm --filter @starter/l10n test`). **They are not yet
driving translation** — the serverless functions below still do that until the
effect handlers and runtime land.

Editorial Workflows is a prerelease: every `@sanity/workflow-*` package is an
exact-version peer of the others and breaking changes ship in minor releases, so
they are pinned exactly in `pnpm-workspace.yaml` and must be upgraded as one set.

See [docs/WORKFLOW_ENGINE_MIGRATION.md](docs/WORKFLOW_ENGINE_MIGRATION.md) for the
remaining stages and the engine behaviour verified along the way.

## Project structure

```
sanity.blueprint.ts              Infrastructure-as-code: dataset, CORS, robot token, functions
functions/                       Serverless automation (Sanity Functions)
  mark-translations-stale.ts       Detects source changes, flags affected translations
  analyze-stale-translations.ts    AI-analyzes what changed, pre-translates affected fields
studio/                          Sanity Studio workspace
  schemaTypes/                     Article, person, topic, tag schemas
  migrations/                      Deterministic locale seeding
packages/l10n/                   Core plugin: schemas, prompt assembly, UI, evals
  src/schemas/                     Locale, glossary, style guide, entry types
  src/core/                        Pure utilities for serverless (zero React)
  src/translations/                Translation pane, inspector, hooks
  src/workflows/                   Editorial Workflows definitions + bench specs
  evals/                           Quality evals: with-context vs without-context scoring
apps/translations-dashboard/     Real-time translation overview (Sanity App SDK)
apps/frontend/                   Next.js frontend with path-based i18n routing
```

## Deploying

Deploy the Studio:

```sh
pnpm --filter studio exec sanity deploy
```

To deploy the dashboard app (`pnpm bootstrap` already wrote your organization ID to `.env`):

```sh
pnpm --filter @starter/translations-dashboard exec sanity deploy
```

If you want "Open in Studio" links in the deployed dashboard to point to your production Studio, also add:

```sh
echo 'SANITY_STUDIO_URL=https://your-studio.sanity.studio' >> .env
```

## Tests and evals

```sh
pnpm test                    # Unit tests (schema, prompt assembly, locale utils)
pnpm --filter l10n eval      # Model evals — requires sanity login, consumes AI credits
```

## Learn more

- [Sanity Agent Actions](https://www.sanity.io/docs/agent-actions) — Translate API reference
- [`@sanity/document-internationalization`](https://github.com/sanity-io/plugins/tree/main/plugins/@sanity/document-internationalization) — Document-level i18n plugin
- [docs/I18N_RESEARCH.md](docs/I18N_RESEARCH.md) — Gap analysis between enterprise TMSes and AI translation agents
