# \_scaffold

> **This is not a starter.** It's the template you copy to _create_ a new starter.

The scaffold gives you a working Sanity project with all the conventions, configs, and CI wiring that every starter in this repo needs — so you can focus on building your content model and frontend instead of setting up boilerplate.

## Creating a new starter

```sh
# From the repo root
cp -r _scaffold my-new-starter
cd my-new-starter
```

Then customize — see [CONTRIBUTING.md](../CONTRIBUTING.md) for the full checklist.

## What you get

| Layer              | What's included                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| **Studio**         | Sanity Studio v5 with a sample `post` schema, Presentation Tool, Vision Tool, and auto-updating TypeGen |
| **Frontend**       | Next.js 16, React 19, Tailwind v4, `next-sanity` v12 with live previews, draft mode, and visual editing |
| **Functions**      | A hello-world `documentEventHandler` with Blueprint registration and Rolldown bundler                   |
| **Shared configs** | `@starter/eslint-config`, `@starter/tsconfig`, `@starter/sanity-types` — shared across all workspaces   |
| **Bootstrap**      | One-command setup: deploy blueprint, deploy schema, extract types, seed sample data                     |
| **CI**             | GitHub Actions workflow for type-checking, template validation, and function bundle verification        |
| **Agent context**  | `AGENT.md` + `CLAUDE.md` symlink for AI-assisted development                                            |
| **Skills**         | Placeholder for Claude Code skills                                                                      |

## Running the scaffold locally

If you want to verify the scaffold works before customizing:

```sh
pnpm install
# Create studio/.env and frontend/.env from their .env.example files
pnpm bootstrap
pnpm dev
```

Studio runs at `http://localhost:3333`, frontend at `http://localhost:3000`.

## Project structure

```
my-new-starter/
├── studio/                # Sanity Studio v5
│   ├── schemaTypes/       #   ← Replace with your content model
│   ├── seed/              #   ← Replace with your sample data
│   └── scripts/bootstrap.ts
├── frontend/              # Next.js 16 + React 19 + Tailwind v4
│   ├── app/               #   ← Replace with your pages
│   └── sanity/            #   Client, queries, live preview setup
├── functions/             # Sanity Functions
│   └── hello-world/       #   ← Rename and customize
├── packages/@starter/     # Shared configs (usually no changes needed)
├── sanity.blueprint.ts    #   ← Update function registrations
├── pnpm-workspace.yaml    #   Workspace definitions + dependency catalog
└── package.json           #   Root scripts: dev, build, bootstrap, etc.
```

## Environment variables

Each workspace manages its own `.env` file — no cascading from root. Copy each `.env.example`:

- `studio/.env.example` → `studio/.env`
- `frontend/.env.example` → `frontend/.env`

See each `.env.example` for required values.

## Available scripts

| Command          | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `pnpm dev`       | Start Studio, frontend, and functions concurrently   |
| `pnpm build`     | Build all workspaces                                 |
| `pnpm bootstrap` | Deploy blueprint + schema, generate types, seed data |
| `pnpm typegen`   | Regenerate Sanity TypeGen types                      |
| `pnpm typecheck` | Type-check all workspaces                            |
| `pnpm lint`      | Lint the entire project                              |
| `pnpm format`    | Format code with oxfmt                               |
| `pnpm validate`  | Validate the starter template structure              |
