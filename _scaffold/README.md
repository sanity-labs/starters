# Starter Scaffold

A minimal Sanity starter template with Sanity Studio, a Next.js frontend, and Sanity Functions.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.19 (< 22) or >= 22.12
- [pnpm](https://pnpm.io/) 10.x (`corepack enable` to activate)

## Quick Start

```bash
# Install dependencies
pnpm install

# Seed the dataset and generate types
pnpm run bootstrap

# Start all services (Studio, frontend, functions)
pnpm dev
```

The Studio runs at `http://localhost:3333`, and the Next.js frontend at `http://localhost:3000`.

## Project Structure

```
_scaffold/
├── studio/          # Sanity Studio v5
├── frontend/        # Next.js 16 + React 19 + Tailwind v4
├── functions/       # Sanity Functions (serverless event handlers)
├── packages/
│   └── @starter/
│       ├── eslint-config/   # Shared ESLint configuration
│       ├── tsconfig/        # Shared TypeScript base config
│       └── sanity-types/    # Auto-generated Sanity TypeGen types
└── sanity.blueprint.ts      # Infrastructure-as-code (datasets, functions, tokens)
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your project values:

| Variable                   | Description                                      |
| -------------------------- | ------------------------------------------------ |
| `SANITY_STUDIO_PROJECT_ID` | Your Sanity project ID                           |
| `SANITY_STUDIO_DATASET`    | Dataset name (e.g. `production`)                 |
| `SANITY_API_READ_TOKEN`    | API token with Viewer permissions (for frontend) |

The root `.env` file maps Studio variables to Next.js public variables via dotenv-expand.

## Available Scripts

| Command          | Description                                        |
| ---------------- | -------------------------------------------------- |
| `pnpm dev`       | Start Studio, frontend, and functions concurrently |
| `pnpm build`     | Build all workspaces                               |
| `pnpm test`      | Run tests across all workspaces                    |
| `pnpm lint`      | Lint the entire project                            |
| `pnpm format`    | Format code with oxfmt                             |
| `pnpm typegen`   | Regenerate Sanity TypeGen types                    |
| `pnpm typecheck` | Type-check all workspaces                          |
| `pnpm bootstrap` | Seed the dataset and generate types                |
| `pnpm validate`  | Validate the starter template                      |

## Adding Content

### Schemas

Add new schema types in `studio/schemaTypes/`. Register them in `studio/schemaTypes/index.ts`, then run `pnpm typegen` to regenerate types.

### Functions

Create a new directory under `functions/` with an `index.ts` exporting a handler. Add an entry to `functions/rolldown.config.ts` and register the function in `sanity.blueprint.ts`.

### Frontend Pages

Add new routes under `frontend/app/`. Use the shared Sanity client from `frontend/sanity/` to fetch content.
