---
name: starter
description: 'Conventions and patterns for building Sanity starter templates. Use when creating a new starter, modifying an existing one, or reviewing a starter PR. Covers project structure, env management, shared config packages, formatting, CI workflows, blueprints, typegen, and pnpm workspace patterns. Trigger on: new starter, add a starter, starter conventions, or any task that modifies starter-level configuration.'
---

# Starter Conventions

Every starter in this repo must work as a standalone project when cloned via `sanity init --template`. These conventions keep starters consistent and maintainable.

## Project Structure

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
├── skills/                   # Starter-specific skills (if applicable)
├── studio/                   # Sanity Studio workspace
├── apps/                     # Frontend apps, dashboards
├── packages/                 # Shared workspace packages
└── functions/                # Sanity Functions (if applicable)
```

## Required Files

Every starter must have:

| File | Purpose |
| --- | --- |
| `package.json` | `"type": "module"`, `engines`, `packageManager`, scripts |
| `pnpm-workspace.yaml` | Workspace packages + `catalog:` for shared dep versions |
| `.env.example` | Template with comments, no real values |
| `.gitignore` | Self-contained, covers all starter concerns |
| `.npmrc` | `enable-pre-post-scripts=true` (required for pnpm 10.x) |
| `.oxfmtrc.json` | `semi: false`, `singleQuote: true`, `printWidth: 100`, `bracketSpacing: false` |
| `README.md` | Getting started, prerequisites, project structure |
| `AGENT.md` | Agent context for Claude Code / Cursor / etc. |
| `CLAUDE.md` | Symlink to `AGENT.md` |

## Environment Variables

Single root `.env.local` cascades to all workspaces. Never committed.

- `.env` — dotenv-expand prefix mappings (committed, no secrets)
- `.env.example` — template for users to copy to `.env.local`
- `.env.local` — actual values (gitignored)

Loading patterns by context:

| Context | Pattern |
| --- | --- |
| Studio CLI (`sanity.cli.ts`) | `process.loadEnvFile(\`${__dirname}/../.env.local\`)` |
| Blueprint (`sanity.blueprint.ts`) | `readFileSync` + manual parse (jiti quirk) |
| Vite apps | `vite: { envDir: '..' }` pointing to root |

## Shared Config Packages

Use `packages/@starter/` scope for shared configs:

- **`@starter/eslint-config`** — flat config array (ESLint v9)
- **`@starter/tsconfig`** — `base.json` with ES2024, bundler resolution, strict mode

All workspaces extend these. Keeps config DRY without coupling starters to each other.

## pnpm Catalog

Centralize shared dependency versions in `pnpm-workspace.yaml`:

```yaml
catalog:
  sanity: ^5.12.0
  '@sanity/client': ^7.16.0
  react: ^19.2
  # ...
```

Consumer packages reference as `"sanity": "catalog:"`. Prevents version drift.

## Typegen

Enable auto-typegen in `studio/sanity.cli.ts`:

```ts
typegen: {
  enabled: true,
  path: ['./src/**/*.{ts,tsx}', '../packages/*/src/**/*.{ts,tsx}'],
  generates: '../packages/@starter/sanity-types/sanity.types.ts',
}
```

The root `package.json` should have `"pretypecheck": "pnpm run typegen"` so typecheck works in CI and fresh clones where generated types don't exist yet.

## Scripts

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

## GitHub Workflows

Each starter ships its own workflows for standalone use:

- **`ci.yml`** — format check, lint, typecheck, test, validate
- **`deploy.yml`** — deploy Studio, functions, apps on push to main (path-filtered)
- **`eval.yml`** — manual triggers for quality evals (if applicable)

These also exist in the root `.github/workflows/ci.yml` for monorepo CI but scoped with `working-directory` and `cache-dependency-path`.

## Template Validation

Starters must pass `sanity-template-validate` for compatibility with `sanity init --template`. Add `@sanity/template-validator` as a devDep and a `validate` script.

## Blueprint Pattern

If the starter uses Sanity Functions, include `sanity.blueprint.ts` at the starter root:

- Use `readFileSync` for env loading (not `process.loadEnvFile` — jiti doesn't support it)
- Set `deletionPolicy: 'retain'` on datasets
- Reference robot tokens via `$.resources.<name>`

## Workspace Package Exports

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
