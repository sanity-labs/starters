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
9. **Skills** — add Claude Code skills under `skills/` or remove the placeholder

When it's ready, wire it into the monorepo:

- Add a job to `.github/workflows/ci.yml` (with `environment: <starter-name>`)
- Create a GitHub Environment in repo settings with `SANITY_PROJECT_ID` and `SANITY_DATASET` (add `SANITY_AUTH_TOKEN` as a secret if the starter deploys)
- Add the starter name to the lint loop in `.husky/pre-commit`
- Add a row to the table in `README.md`

The starter must work standalone when cloned via `sanity init --template`. Run `pnpm validate` to check.

## Conventions

All starters share these baseline conventions to keep things consistent for users and maintainers. The full details live in the [starter skill](./.agents/skills/starter/SKILL.md), but the highlights:

- **pnpm monorepo** with `catalog:` for shared dep versions
- **ESM-first** (`"type": "module"`)
- **oxfmt** for formatting (`semi: false`, `singleQuote: true`, `printWidth: 100`)
- **Shared configs** in `packages/@starter/` (eslint, tsconfig)
- **Per-workspace `.env`** files — each workspace manages its own env, no cascading
- **AGENT.md** with `CLAUDE.md` symlink for AI agent context
- **Template validation** via `sanity-template-validate`

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
