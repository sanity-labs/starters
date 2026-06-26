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

`pnpm bootstrap` deploys the Sanity blueprint and functions before seeding content. That step can take a minute or more — you may see a message like “No new activity for 60 seconds” while deployment continues on Sanity’s servers. That’s normal; you can wait for it to finish or exit and check status later with `npx sanity blueprints info`.

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

| Command          | Description                                 |
| ---------------- | ------------------------------------------- |
| `pnpm dev`       | Studio + Angular blog + functions dev       |
| `pnpm build`     | Build all workspaces                        |
| `pnpm typegen`   | Generate types from schema + GROQ queries   |
| `pnpm validate`  | Run `sanity-template-validate`              |
| `pnpm bootstrap` | Create/link Sanity project and seed content |

## Visual editing

1. Open Studio at `http://localhost:3333`
2. Open the **Presentation** tool
3. The blog preview loads at `http://localhost:4200`
4. Draft mode activates via `/api/draft-mode/enable` (validated with `@sanity/preview-url-secret`)

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
