# Commerce PLP management

Give your merchandising team the keys to the category page. This Sanity starter
adds an **editorial enrichment layer on top of Shopify** so merchandisers control
product curation, in-grid storytelling, badges, facet order, and custom campaign
collections — without a developer ticket.

```sh
pnpm create sanity@latest --template sanity-labs/starters/commerce-plp-management --package-manager pnpm
```

> Using npm? Run `npm create sanity@latest -- --template sanity-labs/starters/commerce-plp-management` (note the extra `--`).

The demo is styled as the **Sanity Swag Store** ("Sanity Shop®") — a brutalist,
monospace storefront — running on top of your own Shopify catalog.

> Shopify stays canonical for products, pricing, and inventory. Sanity owns the
> layer on top: banners, faceouts, editorial tiles, badges, facet order, and the
> custom collections the rule-based model can't express.

## How it works

**Presence-based enrichment.** One `collectionEnrichment` document per collection
handle. If the document exists, the storefront merges it over the Shopify output.
If it doesn't, the collection renders as **pure Shopify** — so you enrich your
highest-traffic collections first and expand coverage as evidence accumulates.

```
Merchandiser edits collectionEnrichment in Studio
        │ publish
        ▼
Sanity Functions (push sync) ── writes sanity_plp_collection metaobject to Shopify
        │                     └─ stamps syncStatus (green / red) on the document
        ▼
┌───────────────┐        ┌──────────────────────────────┐
│ Shopify        │        │ Sanity CDN                   │
│ products,      │        │ collectionEnrichment doc     │
│ price,         │        │ (banner, tiles, badges,      │
│ inventory,     │        │  facets, faceout, variants)  │
│ metaobjects    │        └───────────────┬──────────────┘
└──────┬─────────┘                        │ GROQ (enrichment by handle)
       │ Storefront API                   │
       │ (by collection or GID batch)     │
       └──────────────┬───────────────────┘
                      ▼  parallel fetch + merge at render time
              Headless storefront (Next.js)
     null-check → pure Shopify, or merge faceout | tiles | badges | facets | banner
```

## What it demonstrates

| Persona                   | In this starter                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Digital Merchandiser**  | Enrich a collection: banner, faceout, editorial tiles, date-gated badges, promoted facets — in one document. |
| **Campaign Merchandiser** | Build a `sanity-custom` collection (gift guide) where Sanity owns membership and curation order.             |
| **Campaign coordinator**  | Stage many collections into a **Content Release** and publish the whole campaign at once.                    |
| **Commerce Developer**    | One-time setup: metaobject definition, push-sync Function, storefront merge. Then hands off.                 |
| **Shopper**               | The Sanity Swag Store PLP — faceout at position 0, editorial tiles interleaved, badges live on schedule.     |

## Getting started

Prerequisites: **Node ≥ 20.19**, **pnpm 10**, and a **Shopify store** (Storefront
API access; Admin API access for push-sync).

```sh
pnpm install

# 1. Create the three env files
cp .env.example .env
cp studio/.env.example studio/.env
cp frontend/.env.example frontend/.env

# 2. Fill them in (see "Environment variables" below)

# 3. Create the Shopify metaobject definition (one time)
pnpm shopify:setup

# 4. Deploy schema + functions, generate types, seed badges + example collections
pnpm bootstrap

# 5. Run Studio (:3333) + storefront (:3000) + functions
pnpm dev
```

Products live in Shopify, so the seed only provisions the Sanity side: the shared
badge vocabulary plus two store-agnostic example collections — `clothing`
(shopify-native) and `holiday-gift-guide-2026` (sanity-custom, empty to start).
Open them in Studio and use the **product picker** to attach real products from
your store. Point the `clothing` collection's handle at a real collection handle
in your store to see the merge.

> Want a fully-merchandised reference to explore? `pnpm seed:demo` imports the
> "Sanity Swag Store" demo (faceout, badges, editorial tiles, and a curated gift
> guide). Its product references use one specific catalog, so swap in your own
> product GIDs via the picker if items don't resolve.

## Environment variables

Each workspace loads its own env file (never committed).

| File            | Loaded by                                           | Key vars                                                                                                                                            |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env` (root)   | Blueprint deploy (`dotenv/config`), `shopify:setup` | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_API_WRITE_TOKEN`, `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` |
| `studio/.env`   | Studio CLI + `sanity dev`                           | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_STUDIO_SHOPIFY_STORE_DOMAIN`, `SANITY_STUDIO_SHOPIFY_STOREFRONT_TOKEN`                 |
| `frontend/.env` | Next.js                                             | `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`           |

The **Admin credentials are sensitive** — Dev Dashboard apps use a Client ID +
Secret that the client exchanges for a short-lived Admin token at runtime (see
[Shopify docs](https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens)).
They live only in the root `.env` and on the Function runtime (injected by the
blueprint), never in the browser. A legacy static `SHOPIFY_ADMIN_API_TOKEN` is
also supported. The **Storefront token** is public and safe in the Studio and frontend.

## Deploying

Three surfaces, deployed independently.

### Studio + Functions (Sanity-hosted)

```sh
# Studio → *.sanity.studio
pnpm --filter studio exec sanity deploy

# Functions (push-sync) via the blueprint
pnpm --filter @starter/functions build
npx sanity blueprints deploy   # from the repo root
```

CI can do this on push to `main` — see [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml), which needs `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_STACK_ID` (vars) and `SANITY_AUTH_TOKEN` (secret) on a GitHub Environment.

### Storefront (Vercel)

The Next.js storefront deploys to Vercel. Import the repo at
[vercel.com/new](https://vercel.com/new) and configure:

| Setting              | Value                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework Preset** | Next.js                                                                                                                                                                               |
| **Root Directory**   | `commerce-plp-management/frontend` (or just `frontend` if you cloned via `sanity init --template`) — enable _Include files outside the root directory_ so the pnpm workspace resolves |
| **Build Command**    | default (`next build`)                                                                                                                                                                |
| **Install Command**  | default (`pnpm install`)                                                                                                                                                              |

Add these **Environment Variables** (Production + Preview):

| Variable                                     | Notes                                              |
| -------------------------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`              |                                                    |
| `NEXT_PUBLIC_SANITY_DATASET`                 |                                                    |
| `NEXT_PUBLIC_SANITY_API_VERSION`             | e.g. `2025-07-13`                                  |
| `SANITY_API_READ_TOKEN`                      | Viewer token — enables draft mode / Visual Editing |
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`           | `your-store.myshopify.com`                         |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`       | public Storefront token                            |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_API_VERSION` | e.g. `2025-07`                                     |

After the first deploy, add your Vercel domain to the project's CORS origins at
[sanity.io/manage](https://www.sanity.io/manage) (API → CORS origins) so Sanity
Live and Presentation can connect.

> The **Shopify Admin** credentials (`SHOPIFY_CLIENT_ID/SECRET`) are **not** set on
> Vercel — push-sync runs in Sanity Functions, which get them from the blueprint.

## Project structure

```
commerce-plp-management/
├── studio/                       # Sanity Studio v5
│   ├── schemaTypes/
│   │   ├── documents/            #   collectionEnrichment, productBadge
│   │   └── objects/              #   banner, faceout, editorialTile, badgeAssignment, facetConfig, variantOverride, product, syncState
│   ├── components/               #   ProductPickerInput, SyncStatusInput
│   ├── structure.ts              #   merchandiser views (native / custom / vocabulary)
│   └── seed/                     #   badges + example collections
├── frontend/                     # Next.js 16 + React 19 + Tailwind v4 (Sanity Swag Store)
│   ├── app/collections/[handle]/ #   the PLP (parallel fetch + merge + null-check)
│   ├── lib/                      #   collection merge orchestration, audience, shopify client
│   └── components/               #   Banner, ProductGrid, ProductCard, EditorialTileCard, BadgePill, FacetRail
├── functions/                    # Sanity Functions (push sync)
│   ├── collection-sync/          #   collectionEnrichment publish → Shopify metaobject + syncStatus
│   └── badge-resync/             #   productBadge publish → re-sync affected collections
├── packages/@starter/commerce/   # framework-agnostic Shopify adapter + merge logic + metaobject contract
├── scripts/setup-metaobject.ts   # one-time Shopify metaobject definition
└── sanity.blueprint.ts           # functions + robot token
```

## Scripts

| Command                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `pnpm dev`             | Studio + storefront + functions concurrently             |
| `pnpm shopify:setup`   | Create the `sanity_plp_collection` metaobject definition |
| `pnpm bootstrap`       | Deploy blueprint + schema, typegen, seed                 |
| `pnpm seed`            | Seed badge vocabulary + example collections              |
| `pnpm seed:demo`       | Seed the fully-merchandised "Sanity Swag Store" demo     |
| `pnpm build`           | Build all workspaces                                     |
| `pnpm typegen`         | Regenerate Sanity TypeGen types                          |
| `pnpm typecheck`       | Type-check all workspaces                                |
| `pnpm lint` / `format` | Lint / format                                            |
| `pnpm validate`        | Validate the starter template structure                  |

## Key design decisions

- **One metaobject per collection, not per-product metafields.** The push-sync
  writes a single `sanity_plp_collection` metaobject so the whole payload lands in
  one Admin API call and is readable by the Shopify ecosystem. The definition is
  version-controlled in `@starter/commerce` and treated as a contract.
- **Sanity is the authority for custom collection membership.** For
  `sanity-custom` collections, Sanity owns which products are in the collection and
  in what order; Shopify supplies live product data by GID batch.
- **Interim `variantOverrides` for personalization.** Audience-targeted PLPs use an
  inline override array resolved at the storefront edge from a first-party cookie —
  the designed interim ahead of Content Variants. Non-sensitive segments only.

See [`AGENT.md`](./AGENT.md) for the full agent-facing guide.
