# Angular Blog Starter

Sanity + Angular v22 blog starter with Presentation tool visual editing. Built from the [starters `_scaffold`](https://github.com/sanity-labs/starters/tree/main/_scaffold) template.

## Stack

- **Sanity Studio v6** (`studio/`) — blog schema, Presentation tool, TypeGen
- **Angular v22 SSR** (`frontend/`) — `@sanity/visual-editing`, `@sanity/preview-url-secret`, `@sanity/client`
- **Sanity Functions** (`functions/`) — hello-world function + blueprint

## Prerequisites

- Node.js 20.19+ or 22.12+
- pnpm 10.x

## Quick start

```bash
pnpm install
cp .env.example .env.local
pnpm bootstrap   # links Sanity project + dataset
pnpm dev         # Studio :3333 + blog :4200
```

`pnpm bootstrap` deploys the Sanity blueprint and functions before seeding content. It also adds a CORS origin for the blog preview (`http://localhost:4200`, or `SANITY_STUDIO_PREVIEW_URL` if set). That step can take a minute or more — you may see a message like “No new activity for 60 seconds” while deployment continues on Sanity’s servers. That’s normal; you can wait for it to finish or exit and check status later with `npx sanity blueprints info`.

### Environment

Copy `.env.example` to `.env.local` at the **starter root**:

| Variable                    | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `SANITY_STUDIO_PROJECT_ID`  | Sanity project ID                                                 |
| `SANITY_STUDIO_DATASET`     | Dataset name                                                      |
| `SANITY_API_READ_TOKEN`     | Viewer token for draft preview (create in manage.sanity.io → API) |
| `SANITY_STUDIO_PREVIEW_URL` | Blog origin for Presentation (`http://localhost:4200`)            |
| `SANITY_STUDIO_URL`         | Studio URL for stega overlays (`http://localhost:3333`)           |

### Create a read token

1. Go to [manage.sanity.io](https://manage.sanity.io) → your project → API → Tokens
2. Create a token with **Viewer** permissions
3. Add to `.env.local` as `SANITY_API_READ_TOKEN`

## Scripts

| Command               | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `pnpm dev`            | Studio + Angular blog + functions dev                      |
| `pnpm build`          | Build all workspaces                                       |
| `pnpm typegen`        | Generate types from schema + GROQ queries                  |
| `pnpm validate`       | Run `sanity-template-validate`                             |
| `pnpm bootstrap`      | Deploy blueprint, schema, CORS, typegen, and seed content  |
| `pnpm bootstrap:seed` | Import seed ndjson + upload images only (skips if present) |

## Visual editing

1. Open Studio at `http://localhost:3333`
2. Open the **Presentation** tool
3. The blog preview loads at `http://localhost:4200`
4. Draft mode activates via `/api/draft-mode/enable` (validated with `@sanity/preview-url-secret`)

The Angular SSR server reads env from the **starter root** `.env.local` (not `studio/.env.local`). `SANITY_API_READ_TOKEN` must be set there for draft mode to work. If Presentation shows a 500 on `/api/draft-mode/enable`, check that token and restart `pnpm dev`.

Transient WebSocket warnings in the Studio console are usually harmless Studio reconnect noise and not related to preview setup.

## Project structure

```
angular-blog/
├── studio/          # Sanity Studio
├── frontend/        # Angular SSR blog
├── functions/       # Sanity Functions
├── packages/@starter/
└── skills/          # Agent skills (install separately)
```

## Agent skills

```bash
npx skills add sanity-io/agent-toolkit
npx skills add https://github.com/angular/skills
```

## Deploy

- **Studio:** `pnpm --filter studio deploy`
- **Blog:** deploy `frontend` SSR build (see Angular deployment docs)
