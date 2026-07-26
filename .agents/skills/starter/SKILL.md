---
name: starter
description: 'Conventions and patterns for building Sanity starter templates. Use when creating a new starter, modifying an existing one, or adding structure to one. Covers project structure, required files, env management, shared config packages, formatting, CI workflows, blueprints, typegen, pnpm workspace patterns, and the cross-starter anatomy map anchored to the reference starter. Trigger on: new starter, add a starter, starter conventions, or any task that modifies starter-level configuration. Auditing, scoring or refactoring an existing starter is the sibling starter-review skill, not this one.'
---

# Starter Conventions

Every starter in this repo must work as a standalone project when cloned via `sanity init --template`. These conventions keep starters consistent and maintainable.

Auditing or refactoring rather than building? Use the sibling **`starter-review`**
skill — it owns the rubric and the refactoring method, and this skill does not
restate them.

## The reference starter

`agentic-localization/` is the north star. This file is the baseline every
starter meets; **`references/map.md`** is the full anatomy — workspace shape and
dependency floors, the reference-architecture stance and its three operator
entry points, docs canon, skills, tests, CI, tooling, env cascade, blueprint,
ledger — with every rule anchored to a file in `agentic-localization/`.

## Enforcement tiers

Each section below and every rule in `references/map.md` carries a tier:

- **ENFORCED** — CI- or rubric-gated. Violating it fails a check.
- **DEFAULT** — follow unless an ADR in the starter's `docs/decisions/` says why not.
- **FREE** — per-starter choice; see `references/map.md` §11 for the list.

Rules cheap enough to violate that they are worth stating twice:

- **Point at canonical sources.** Never re-explain what Sanity's docs, a package
  README, or the code already says.
- **Deletion is progress.** A refactor with a net-positive diff needs a reason.
- **The headline claim must be exercised by the shipping code path.** An eval or
  demo that rebuilds what the runtime builds proves nothing.
- **Prefer upstream.** Adopt the Sanity-managed package by default; a
  first-party equivalent survives only as a stated exception.

## Project Structure — DEFAULT

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

## Required Files — ENFORCED

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

## Environment Variables — DEFAULT

Single root `.env.local` cascades to all workspaces. Never committed.

- `.env` — dotenv-expand prefix mappings (committed, no secrets)
- `.env.example` — template for users to copy to `.env.local`
- `.env.local` — actual values (gitignored)

Loading patterns by context:

| Context                           | Pattern                                                 |
| --------------------------------- | ------------------------------------------------------- |
| Studio CLI (`sanity.cli.ts`)      | `process.loadEnvFile(\`${\_\_dirname}/../.env.local\`)` |
| Blueprint (`sanity.blueprint.ts`) | `readFileSync` + manual parse (jiti quirk)              |
| Vite apps                         | `vite: { envDir: '..' }` pointing to root               |

## Shared Config Packages — DEFAULT

Use `packages/@starter/` scope for shared configs. All workspaces extend them —
DRY without coupling starters to each other.

| Package                                                    | State                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `@starter/tsconfig`                                        | `base.json` with ES2024, bundler resolution, strict mode. Current and correct.                                                        |
| `@starter/eslint-config`                                   | Flat config array (ESLint v9). Legacy; every remaining consumer is a migration target.                                                |
| oxlint extending `@sanity/plugin-kit/oxlint` via `extends` | **Ratified target** — plugin-kit is the canon and the preset is never copy-pasted. Landed in `agentic-localization/oxlint.config.ts`. |

Do not add a new `@starter/eslint-config` consumer expecting it to survive.
`references/map.md` §7 holds the tooling table.

## pnpm Catalog — DEFAULT

Centralize shared dependency versions in `pnpm-workspace.yaml`:

```yaml
catalog:
  sanity: ^5.12.0
  '@sanity/client': ^7.16.0
  react: ^19.2
  # ...
```

Consumer packages reference as `"sanity": "catalog:"`. Prevents version drift.

## Typegen — DEFAULT

Enable auto-typegen in `studio/sanity.cli.ts`:

```ts
typegen: {
  enabled: true,
  path: ['./src/**/*.{ts,tsx}', '../packages/*/src/**/*.{ts,tsx}'],
  generates: '../packages/@starter/sanity-types/sanity.types.ts',
}
```

The root `package.json` should have `"pretypecheck": "pnpm run typegen"` so typecheck works in CI and fresh clones where generated types don't exist yet.

## Scripts — ENFORCED

Root `package.json` delegates to workspaces:

```json
{
  "dev": "concurrently ... pnpm --filter <pkg> dev",
  "build": "pnpm -r build",
  "test": "pnpm -r test",
  "lint": "pnpm run oxlint",
  "oxlint": "oxlint --disable-nested-config",
  "format": "oxfmt .",
  "format:check": "oxfmt --check .",
  "typegen": "pnpm --filter studio typegen",
  "pretypecheck": "pnpm run typegen",
  "typecheck": "pnpm -r typecheck"
}
```

## GitHub Workflows — ENFORCED

**The root `.github/workflows/ci.yml` is the only thing GitHub executes in this
repo.** One job per starter, `working-directory` scoped. A check that is not
there does not gate — adding it to a nested workflow changes nothing here.

A starter's own `.github/workflows/*.yml` activate only in a clone made by
`sanity init --template`:

- **`ci.yml`** — format check, lint, typecheck, test, validate
- **`deploy.yml`** — deploy Studio, functions, apps on push to main (path-filtered)
- **`eval.yml`** / **`e2e.yml`** — manual or scheduled, credentialed runs

Known trap: nested workflows currently call `pnpm install --frozen-lockfile`
while starter lock files are gitignored, so the first clone that runs one fails
on a missing lockfile. Anything a nested workflow must actually enforce has to be
mirrored into the root file. Scoring the CI of an existing starter is the
`starter-review` skill's CI-reality dimension.

## Template Validation — ENFORCED

Starters must pass `sanity-template-validate` for compatibility with `sanity init --template`. Add `@sanity/template-validator` as a devDep and a `validate` script.

## Blueprint Pattern — DEFAULT

If the starter uses Sanity Functions, include `sanity.blueprint.ts` at the starter root:

- Use `readFileSync` for env loading (not `process.loadEnvFile` — jiti doesn't support it)
- Set `deletionPolicy: 'retain'` on datasets
- Reference robot tokens via `$.resources.<name>`

## Workspace Package Exports — DEFAULT

**Packages are dependency floors; entries are contracts within a floor.** Sub-path
exports do not narrow an install graph — a consumer installs the whole manifest
whatever entry it imports, and the north star's package-split verdict disproved
the opposite claim. What entries do is name a layer for a consumer class and keep
deep imports out.

```json
{
  "exports": {
    ".": {"source": "./src/index.ts", "default": "./src/index.ts"},
    "./workflows": {"source": "./src/workflows/index.ts", "default": "./src/workflows/index.ts"}
  }
}
```

So: put React/Studio dependencies in a _separate package_ from what Functions,
the CLI and frontends import, and enforce it — manifest, lint zone, and an
assertion over the resolved module graph. `references/map.md` §1 has the rule and
its anchors; `agentic-localization/docs/decisions/adr-001-package-shape.md` is
the reasoning.
