# Agent Guide for Sanity Starters

This guide is for AI agents working on this repo. Each top-level directory is a standalone Sanity starter template.

## Quick Reference

| Task | Command |
| --- | --- |
| Install root DX tools | `pnpm install` |
| Install a starter's deps | `cd <starter> && pnpm install` |
| Format code | `npx oxfmt .` |
| Run a starter locally | `cd <starter> && pnpm dev` |

## Repo Structure

This is a flat collection of independent projects — not a shared monorepo. Each starter has its own `package.json`, workspace config, and dependencies.

```
starters/
├── .github/workflows/ci.yml   # Monorepo CI (runs all starters)
├── .husky/pre-commit           # Format + lint fix on commit
├── package.json                # Root DX tools only (husky, oxfmt, eslint)
├── agentic-localization/       # Each starter is self-contained
├── ai-shopping-assistant/
└── ...
```

The root provides DX for maintainers. Each starter works standalone when cloned via `sanity init --template`.

## Working on a Starter

Always `cd` into the starter directory first. Each has its own pnpm workspace, lock file (generated on install), and scripts.

## Conventions

All starters should follow the patterns documented in the `starter` skill. Run `/starter` or read `.agents/skills/starter/SKILL.md` before creating or modifying a starter.

## Adding a New Starter

See [CONTRIBUTING.md](./CONTRIBUTING.md).
