# Contributing

## Adding a new starter

Start from the [`_scaffold/`](./_scaffold/) template — don't build from scratch:

```sh
cp -r _scaffold my-new-starter
cd my-new-starter
```

Then customize it:

1. **Rename** — update `name` in the root `package.json` to your starter name
2. **Schema** — replace the `post` schema in `studio/schemaTypes/` with your content model
3. **Frontend** — update pages, queries, and components in `frontend/` to match your schema
4. **Functions** — rename `hello-world/` and update the blueprint in `sanity.blueprint.ts`
5. **Seed data** — replace `studio/seed/data.ndjson` with sample content for your schema
6. **Env** — update `.env.example` files if your starter needs additional variables
7. **README** — rewrite `README.md` to describe your starter, not the scaffold
8. **AGENT.md** — update with your starter's stack and context

When it's ready, wire it into the monorepo:

- Add a job to `.github/workflows/ci.yml` (with `environment: <starter-name>`) — the starter's own workflows don't run here, so without this job the starter has no monorepo CI coverage
- Create a GitHub Environment in repo settings with `SANITY_PROJECT_ID` and `SANITY_DATASET` (add `SANITY_AUTH_TOKEN` as a secret, and `SANITY_STACK_ID` as a var, if the starter deploys)
- Add a row to the table in `README.md`

The `.husky/pre-commit` hook auto-discovers starters — no manual edit needed.

The starter must work standalone when cloned via `sanity init --template`. Run `pnpm validate` to check.

## Conventions

All starters share these baseline conventions to keep things consistent for users and maintainers. Every starter must work as a standalone project when cloned via `sanity init --template`.

The highlights:

- **pnpm monorepo** with `catalog:` for shared dep versions
- **ESM-first** (`"type": "module"`)
- **oxfmt** for formatting (`semi: false`, `singleQuote: true`, `printWidth: 100`)
- **Shared configs** in `packages/@starter/` (eslint, tsconfig)
- **Per-workspace `.env`** files — each workspace manages its own env, no cascading
- **AGENT.md** with `CLAUDE.md` symlink for AI agent context
- **Template validation** via `sanity-template-validate`

The full details follow.

### Project structure

A starter is a pnpm monorepo at the root level of this repo:

```
my-starter/
├── .github/workflows/       # CI, deploy, etc. (works standalone)
├── .env                      # dotenv-expand prefix mappings (safe to commit)
├── .env.example              # Template for .env.local (committed)
├── .gitignore                # Self-contained (no reliance on root)
├── .npmrc                    # enable-pre-post-scripts=true
├── .oxfmtrc.json             # Formatting config
├── AGENT.md                  # Agent instructions for this starter
├── CLAUDE.md -> AGENT.md     # Symlink
├── README.md                 # Setup instructions for users
├── package.json              # Root scripts, engines, packageManager
├── pnpm-workspace.yaml       # Workspace + catalog config
├── sanity.blueprint.ts       # Infrastructure-as-code (if applicable)
├── studio/                   # Sanity Studio workspace
├── apps/                     # Frontend apps, dashboards
├── packages/                 # Shared workspace packages
└── functions/                # Sanity Functions (if applicable)
```

### Required files

Every starter must have:

| File                  | Purpose                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| `package.json`        | `"type": "module"`, `engines`, `packageManager`, scripts                       |
| `pnpm-workspace.yaml` | Workspace packages + `catalog:` for shared dep versions                        |
| `.env.example`        | Template with comments, no real values                                         |
| `.gitignore`          | Self-contained, covers all starter concerns                                    |
| `.npmrc`              | `enable-pre-post-scripts=true` (required for pnpm 10.x)                        |
| `.oxfmtrc.json`       | `semi: false`, `singleQuote: true`, `printWidth: 100`, `bracketSpacing: false` |
| `README.md`           | Getting started, prerequisites, project structure                              |
| `AGENT.md`            | Agent context for Claude Code / Cursor / etc.                                  |
| `CLAUDE.md`           | Symlink to `AGENT.md`                                                          |

### Environment variables

Single root `.env.local` cascades to all workspaces. Never committed.

- `.env` — dotenv-expand prefix mappings (committed, no secrets)
- `.env.example` — template for users to copy to `.env.local`
- `.env.local` — actual values (gitignored)

Loading patterns by context:

| Context                           | Pattern                                                   |
| --------------------------------- | --------------------------------------------------------- |
| Studio CLI (`sanity.cli.ts`)      | `process.loadEnvFile()` pointing at the root `.env.local` |
| Blueprint (`sanity.blueprint.ts`) | `readFileSync` + manual parse (jiti quirk)                |
| Vite apps                         | `vite: { envDir: '..' }` pointing to root                 |

### Shared config packages

Use `packages/@starter/` scope for shared configs:

- **`@starter/eslint-config`** — flat config array (ESLint v9)
- **`@starter/tsconfig`** — `base.json` with ES2024, bundler resolution, strict mode

All workspaces extend these. Keeps config DRY without coupling starters to each other.

### pnpm catalog

Centralize shared dependency versions in `pnpm-workspace.yaml`:

```yaml
catalog:
  sanity: ^5.12.0
  '@sanity/client': ^7.16.0
  react: ^19.2
  # ...
```

Consumer packages reference as `"sanity": "catalog:"`. Prevents version drift.

### Typegen

Enable auto-typegen in `studio/sanity.cli.ts`:

```ts
typegen: {
  enabled: true,
  path: ['./src/**/*.{ts,tsx}', '../packages/*/src/**/*.{ts,tsx}'],
  generates: '../packages/@starter/sanity-types/sanity.types.ts',
}
```

The root `package.json` should have `"pretypecheck": "pnpm run typegen"` so typecheck works in CI and fresh clones where generated types don't exist yet.

### Scripts

Root `package.json` delegates to workspaces:

```json
{
  "dev": "concurrently ... pnpm --filter <pkg> dev",
  "build": "pnpm -r build",
  "test": "pnpm -r test",
  "lint": "eslint --cache --cache-location node_modules/.cache/eslint/ .",
  "format": "oxfmt .",
  "format:check": "oxfmt --check .",
  "typegen": "pnpm --filter studio typegen",
  "pretypecheck": "pnpm run typegen",
  "typecheck": "pnpm -r typecheck"
}
```

### GitHub workflows

Each starter ships its own workflows under `<starter>/.github/workflows/` for standalone use (they run when the starter is cloned via `sanity init --template`):

- **`ci.yml`** — format check, lint, typecheck, validate, and (if it has Functions) build + manifest extract + bundle-size check
- **`deploy.yml`** — deploy Studio, functions, and blueprint on push to main (path-filtered); build the frontend as a guard. The Next.js storefront itself deploys via Vercel (dashboard import), not this workflow.
- **`eval.yml`** — manual triggers for quality evals (if applicable)

### Wiring a new starter into the monorepo

The starter's own workflows do **not** run in this repo — the root `.github/workflows/ci.yml` runs CI for every starter. Adding a new starter is not complete until you do all of the following (it's easy to forget the root CI job — a starter with green local `pnpm validate` still has **zero** monorepo coverage without it):

1. **Add a job to the root `.github/workflows/ci.yml`.** Mirror an existing starter job (e.g. `knowledge-base`): a Node 20/22 matrix, `environment: <starter-name>`, `defaults.run.working-directory: <starter-name>`, then `pnpm install` + format check + lint + typecheck + validate (+ functions build, manifest extract, and bundle-size check if it has Functions). Steps that touch the Content Lake read `SANITY_STUDIO_PROJECT_ID`/`SANITY_STUDIO_DATASET` from `${{ vars.SANITY_PROJECT_ID }}` / `${{ vars.SANITY_DATASET }}`.
2. **Create a GitHub Environment** named exactly after the starter (repo Settings → Environments) with:
   - vars: `SANITY_PROJECT_ID`, `SANITY_DATASET` (add `SANITY_STACK_ID` if it deploys a blueprint)
   - secrets: `SANITY_AUTH_TOKEN` (only if the starter deploys)
3. **Add a row** to the starters table in the root `README.md`.
4. **Husky needs no edit** — the root `.husky/pre-commit` hook auto-discovers each starter by its own `package.json` / `eslint.config.*`, so formatting and lint-fix scope automatically.

Verify from the starter directory with `pnpm validate` (template compatibility) and confirm the new `<starter-name>` job appears in the PR's checks.

### Template validation

Starters must pass `sanity-template-validate` for compatibility with `sanity init --template`. Add `@sanity/template-validator` as a devDep and a `validate` script.

### Blueprint pattern

If the starter uses Sanity Functions, include `sanity.blueprint.ts` at the starter root:

- Use `readFileSync` for env loading (not `process.loadEnvFile` — jiti doesn't support it)
- Set `deletionPolicy: 'retain'` on datasets
- Reference robot tokens via `$.resources.<name>`

### Workspace package exports

Use sub-path exports to maintain clean boundaries:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./core": "./src/core/index.ts",
    "./core/types": "./src/core/types.ts"
  }
}
```

This lets serverless functions import pure utilities without pulling in React.

## Lock files

Starter lock files are gitignored at the root level. Users generate their own on `pnpm install`. The root lock file (for DX deps) is committed.

## Working on a single starter

You don't need every starter on disk. Use sparse checkout to scope your clone:

```sh
git clone --sparse --filter=blob:none https://github.com/sanity-labs/starters.git
cd starters
git sparse-checkout set agentic-localization   # only this starter + root files
pnpm install                                    # root DX tools (husky, oxfmt, eslint)
cd agentic-localization
pnpm install                                    # starter deps
```

To switch to or add another starter later:

```sh
git sparse-checkout add ai-shopping-assistant   # adds it alongside existing ones
```

Commits, pushes, and PRs work normally — git still tracks the full repo.

## Formatting and linting

The root husky hook auto-formats and lint-fixes staged files on commit. No lint-staged needed — each starter keeps `format`/`lint` scripts for standalone use.
