# Agentic Localization Starter

Make AI translation match your brand voice and terminology standards.

Without structured context, AI translates "Releases" as "Veröffentlichungen" in German — but it's a product name that should stay in English. This starter stores glossaries, style guides, and locale rules as structured Sanity documents, assembles them into prompts at translation time, and includes an eval framework that proves the quality impact.

## What you get

- **Translation metadata as content** — Glossaries, style guides, and locale rules are Sanity documents that content teams manage in the Studio
- **Automated stale detection** — Serverless functions mark translations stale on publish, run AI analysis on what changed, and pre-translate affected fields
- **Translation pane and inspector** — Studio UI for reviewing translation status, applying pre-translations, and triggering new translations
- **Translations dashboard** — Real-time overview of coverage, gaps, and stale documents across all locales (Sanity App SDK)
- **Localized frontend** — Next.js app with path-based i18n routing, locale switcher, and fallback content
- **Quality evals** — Translate with and without context, measure the delta with deterministic checks and an LLM judge

## Getting started

**Prerequisites:** Node.js (>=20.19 or >=22.12), pnpm, a [Sanity account](https://www.sanity.io/get-started)

### 1. Create the project

```sh
pnpm create sanity@latest --template sanity-labs/starters/agentic-localization
cd agentic-localization
```

This prompts you to select (or create) a Sanity project and dataset, then writes your `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` to a root `.env.local`. All workspaces in the monorepo read from this single file — a checked-in `.env` maps the values to the prefixes each workspace expects.

> **Cloning manually?** Copy `.env.example` to `.env.local` and fill in your project ID and dataset from [sanity.io/manage](https://www.sanity.io/manage).

### 2. Install and bootstrap

```sh
pnpm install
pnpm bootstrap
```

`pnpm bootstrap` deploys the schema, seeds locale documents, imports sample content, and adds CORS for the dashboard dev server.

### 3. Deploy functions

```sh
pnpm exec sanity blueprints deploy
```

This deploys the two serverless functions that power the automation: one marks translations as stale when a source document is published, the other runs AI analysis on stale translations.

### 4. Start developing

```sh
pnpm dev
```

Opens the Studio at [localhost:3333](http://localhost:3333), the translations dashboard at [localhost:3334](http://localhost:3334), and the Next.js frontend at [localhost:3000](http://localhost:3000).

> **Frontend env:** The frontend inherits `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` from the root `.env.local` automatically. For server-side data fetching with a private dataset, add a `SANITY_API_READ_TOKEN` (create one at [sanity.io/manage](https://www.sanity.io/manage) → API → Tokens).

## How it works

1. **Define metadata** in the Studio: locales, glossaries (approved translations, do-not-translate terms, forbidden terms), and style guides (formality, tone, audience instructions per locale)
2. **Assemble prompt**: `assembleStyleGuide()` converts structured metadata into an instruction string; `filterGlossaryByContent()` prunes to relevant terms
3. **Translate**: `buildTranslateParams()` packages everything for the [Agent Actions Translate API](https://www.sanity.io/docs/agent-actions), including protected phrases extracted from do-not-translate entries
4. **Evaluate**: translate with and without context, score with deterministic checks and an LLM judge, compare the quality delta

Only glossary entries whose terms appear in the source document are injected (content-aware filtering), so prompts stay focused.

## Project structure

```
sanity.blueprint.ts              Infrastructure-as-code: dataset, robot token, functions
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
  evals/                           Quality evals: with-context vs without-context scoring
apps/translations-dashboard/     Real-time translation overview (Sanity App SDK)
apps/frontend/                   Next.js frontend with path-based i18n routing
```

## Deploying

Deploy the Studio:

```sh
pnpm --filter studio exec sanity deploy
```

To deploy the dashboard app, add your organization ID to `.env.local` (find it at [sanity.io/manage](https://www.sanity.io/manage) → organization settings), then deploy:

```sh
echo 'SANITY_STUDIO_ORGANIZATION_ID=your-org-id' >> .env.local
pnpm --filter @starter/translations-dashboard exec sanity deploy
```

If you want "Open in Studio" links in the deployed dashboard to point to your production Studio, also add:

```sh
echo 'SANITY_STUDIO_URL=https://your-studio.sanity.studio' >> .env.local
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
