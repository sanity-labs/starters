# Agentic Localization Starter

Make AI translation match your brand voice and terminology standards.

Without structured context, AI translates "Releases" as "Veröffentlichungen" in German — but it's a product name that should stay in English. This starter stores glossaries, style guides, and locale rules as structured Sanity documents, assembles them into prompts at translation time, and includes an eval framework that proves the quality impact.

## What you get

- **Translation metadata as content** — Glossaries, style guides, and locale rules are Sanity documents that content teams manage in the Studio
- **Automated stale detection** — On publish, AI analyses what actually changed and retranslates only the locales it affects; cosmetic edits complete without involving a person
- **Durable localization runs** — Fan-out, review gates, retries, guards and audit are [Editorial Workflows](https://www.sanity.io/docs/editorial-workflows/concepts) definitions, dispatched by five Sanity Functions
- **A review gate that teaches** — What a reviewer corrects is distilled into draft glossary entries and style-guide rules for the next run
- **Translations inspector** — Studio UI for the open run: per-locale progress, source-versus-translation diff, approve or request changes
- **Translations dashboard** — Real-time overview of coverage, gaps, and stale documents across all locales (Sanity App SDK)
- **Localized frontend** — Next.js app with path-based i18n routing, locale switcher, and fallback content
- **Quality evals** — Translate with and without context, measure the delta with deterministic checks and an LLM judge
- **Journey tests** — Gherkin scenarios against a real project: real datasets, deployed definitions, the real engine

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

`pnpm bootstrap` consolidates env files, resolves the organization ID, deploys the blueprint (CORS, datasets, robot token, Functions), deploys the workflow definitions and the schema, generates types, seeds locale documents, and imports sample content.

<details>
<summary>Running bootstrap steps manually</summary>

```sh
# 1. Consolidate env — copy .env.example to .env if it doesn't exist, fill in project ID and dataset
cp .env.example .env

# 2. Resolve organization ID — find it at sanity.io/manage → project settings
# Uncomment SANITY_STUDIO_ORGANIZATION_ID in .env and set it to your org ID

# 3. Deploy blueprint (CORS, datasets, robot token, Functions)
pnpm --filter @starter/functions build
pnpm exec sanity blueprints init --stack-name production --project-id <your-project-id>
pnpm exec sanity blueprints deploy

# 4. Deploy the workflow definitions into the dataset the blueprint created
pnpm workflows:deploy

# 5. Deploy schema
pnpm --filter studio exec sanity schema deploy

# 6. Generate types
pnpm --filter studio exec sanity schema extract
pnpm --filter studio exec sanity typegen generate

# 7. Seed locale documents
pnpm --filter studio exec sanity migration run seed-locales --no-dry-run --no-confirm

# 8. Import sample content
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

1. **Context is content** — locales, glossaries (approved translations, do-not-translate terms, forbidden terms) and per-locale style guides are documents editors maintain
2. **Assembly** — the glossary is pruned to the terms the source actually contains, then assembled into one [Agent Actions Translate](https://www.sanity.io/docs/agent-actions) request; do-not-translate terms become the API's `protectedPhrases`
3. **The run** — a publish starts one durable [Editorial Workflows](https://www.sanity.io/docs/editorial-workflows/concepts) instance. Three definitions (`localize-campaign` → `localize-document` → `localize-locale`) own analysis, fan-out, retries, guards and the review gate. Run state lives on the instance; content documents carry content
4. **Review** — a reviewer diffs source against translation and approves, requests changes on named locales, or refreshes from a changed source
5. **Distill** — the diff between machine draft and approved text becomes draft glossary and style-guide proposals. Accepting one is a human act, and assembly reads only published, approved context
6. **Evaluate** — translate with and without context, score with deterministic checks and an LLM judge, compare the delta

Both localization tiers run the same three definitions: document tier (one document
per locale, `@sanity/document-internationalization`) and field tier (language-keyed
entries on one document, `sanity-plugin-internationalized-array`).

Editorial Workflows is a prerelease: every `@sanity/workflow-*` package is an
exact-version peer of the others and breaking changes ship in minor releases, so
they are pinned exactly in `pnpm-workspace.yaml` and must be upgraded as one set.

## Project structure

```
sanity.blueprint.ts              Infrastructure-as-code: datasets, CORS, robot token, Functions
sanity.workflow.ts               Which definitions deploy, and where the engine stores them
functions/                       The engine's runtime: five Functions — see docs/FUNCTIONS.md
packages/l10n/                   Node floor: primitives, prompt assembly, definitions, handlers
packages/l10n-studio/            Studio layer: plugin, schema types, Translations inspector
studio/                          Studio workspace: schemas, locale seeding, bootstrap
apps/translations-dashboard/     Real-time coverage overview (Sanity App SDK)
apps/frontend/                   Next.js frontend with path-based i18n routing
e2e/                             Journey tests against a real project
skills/                          Agent skills for the pattern and its adoption, plus their evals
docs/                            The Function map, decision records, the i18n gap analysis
```

The two packages document their own surface:
[`packages/l10n/README.md`](packages/l10n/README.md) and
[`packages/l10n-studio/README.md`](packages/l10n-studio/README.md).

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

## Tests, evals and journeys

```sh
pnpm test    # Unit tests, workflow bench specs, skill drift checks
pnpm eval    # Model evals — needs a project and consumes AI credits
pnpm e2e     # Journeys against a real project — see e2e/README.md
```

Workflow definitions are proven on `@sanity/workflow-engine-test`, which runs the
real engine in memory with no project or network. Never deploy a definition you
have not run on the bench.

## Learn more

- [Sanity Agent Actions](https://www.sanity.io/docs/agent-actions) — Translate API reference
- [`@sanity/document-internationalization`](https://github.com/sanity-io/plugins/tree/main/plugins/@sanity/document-internationalization) — Document-level i18n plugin
- [`skills/sanity-l10n/`](skills/sanity-l10n/) — The pattern, adopting it, extending it, operating it
- [docs/FUNCTIONS.md](docs/FUNCTIONS.md) — What each Function is for, and why the artifacts are pre-bundled
- [docs/decisions/](docs/decisions/) — Why the packages are shaped this way, and why the loop is an observer
- [docs/I18N_RESEARCH.md](docs/I18N_RESEARCH.md) — Gap analysis between enterprise TMSes and AI translation agents
