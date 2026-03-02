# Contributing

## Adding a new starter

1. Create a directory at the root with a descriptive kebab-case name
2. Follow the conventions in the [starter skill](./.agents/skills/starter/SKILL.md) — it covers required files, env management, shared configs, typegen, blueprints, and more
3. The starter must work standalone when cloned via `sanity init --template`
4. Wire it into the monorepo:
   - Add a job to `.github/workflows/ci.yml`
   - Add the starter name to the lint loop in `.husky/pre-commit`
   - Add a row to the table in `README.md`

## Conventions

All starters share these baseline conventions to keep things consistent for users and maintainers. The full details live in the [starter skill](./.agents/skills/starter/SKILL.md), but the highlights:

- **pnpm monorepo** with `catalog:` for shared dep versions
- **ESM-first** (`"type": "module"`)
- **oxfmt** for formatting (`semi: false`, `singleQuote: true`, `printWidth: 100`)
- **Shared configs** in `packages/@starter/` (eslint, tsconfig)
- **Single `.env.local`** at starter root, cascades to all workspaces
- **AGENT.md** with `CLAUDE.md` symlink for AI agent context
- **Template validation** via `sanity-template-validate`

## Lock files

Starter lock files are gitignored at the root level. Users generate their own on `pnpm install`. The root lock file (for DX deps) is committed.

## Formatting and linting

The root husky hook auto-formats and lint-fixes staged files on commit. No lint-staged needed — each starter keeps `format`/`lint` scripts for standalone use.
