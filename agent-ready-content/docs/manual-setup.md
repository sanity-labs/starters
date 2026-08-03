# Manual setup

Every step `pnpm bootstrap` automates, by hand. Useful when the script fails partway or when you are wiring the starter into an existing project.

## 1. Create a project and dataset

Create a project at [sanity.io/manage](https://www.sanity.io/manage) or from the CLI:

```bash
pnpm dlx sanity projects create
```

Create the dataset (skip if `production` already exists):

```bash
cd studio
pnpm exec sanity dataset create production --visibility public
```

## 2. Environment files

`studio/.env`:

```bash
SANITY_STUDIO_PROJECT_ID=<your-project-id>
SANITY_STUDIO_DATASET=production
```

`apps/next/.env.local`:

```bash
NEXT_PUBLIC_SANITY_PROJECT_ID=<your-project-id>
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`apps/astro/.env`:

```bash
SANITY_PROJECT_ID=<your-project-id>
SANITY_DATASET=production
SITE_URL=http://localhost:4321
```

## 3. Deploy the schema

```bash
cd studio
pnpm exec sanity schema deploy
```

## 4. Import seed content

```bash
cd studio
pnpm exec sanity dataset import ../seed/seed.ndjson production --missing
```

`--missing` leaves existing documents alone. Use `--replace` to overwrite previously imported seed documents.

## 5. CORS

```bash
cd studio
pnpm exec sanity cors add http://localhost:3000 --no-credentials
pnpm exec sanity cors add http://localhost:4321 --no-credentials
```

## 6. Run

```bash
pnpm dev
```

Studio on 3333, Next.js on 3000, Astro on 4321.
