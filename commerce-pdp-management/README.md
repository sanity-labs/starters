# Commerce PDP management

An editorial enrichment layer for **product detail pages**, built as a pull-only
Sanity layer on top of Shopify. Content teams differentiate every product page at
catalog scale — without a document per product or a developer ticket per update.

- **Tag-matched attribute rules** — author a care guide, fit descriptor, or
  lifestyle story once, and it resolves for every product whose Shopify tags match.
- **A control plane** — one priority-ordered list decides which rules win, so the
  content team changes thousands of PDPs by editing a single document.
- **SKU-specific enrichment** — bespoke storytelling (headline, editorial copy,
  lifestyle imagery, launch badge) layered on top for hero products.
- **Brand voice + AI review** — a brand voice singleton governs Content Agent
  generation; drafts land in a review queue before anything reaches a customer.
- **Presence-based** — a product with no matching rule and no SKU enrichment
  renders as pure Shopify. Every intervention is opt-in; the catalog never breaks.

> Sibling of the [`commerce-plp-management`](../commerce-plp-management) starter.
> The PLP starter **pushes** curated collection data to Shopify metaobjects; this
> PDP starter is **pull-only** — editorial overlay resolved at render time from
> Sanity's CDN, never written back to Shopify.

## Architecture

```
Content team authors in Studio           ┌─────────────────────────────┐
  attributeRule (tag-matched, 1:many)    │  SANITY CONTENT LAKE        │
  controlPlane  (priority singleton)     │  + Content Agent (AI drafts │
  skuEnrichment (SKU-specific, 1:1)      │    → review queue)          │
  brandVoice    (AI context singleton)   └──────────────┬──────────────┘
                                                        │ GROQ @ render time
                                                        ▼
                                    ┌───────────────────────────────────┐
Shopify (canonical: title, price,   │  STOREFRONT RESOLVER (pull-only)  │
inventory, variants, tags, media) ─▶│  1. product by handle (tags)      │
                                    │  2. control plane + SKU enrichment │
                                    │  3. tag-match rules, first-match   │
                                    │     wins per category, sort        │
                                    │  4. merge; no match → pure Shopify │
                                    └───────────────────┬───────────────┘
                                                        ▼
                                                  PDP in the browser
```

## Prerequisites

- Node `>=20.19 <22 || >=22.12` and pnpm `10.x`
- A Sanity project (`sanity.io/manage`)
- A Shopify store with Storefront API access

## Getting started

```sh
pnpm install

# 1. Env — three files, never committed
cp .env.example .env
cp studio/.env.example studio/.env
cp frontend/.env.example frontend/.env
# Fill in SANITY_STUDIO_PROJECT_ID / DATASET and your Shopify Admin creds in .env

# 2. Mint a public Storefront token (uses the Admin creds in root .env)
pnpm shopify:storefront-token
# Paste the printed token into studio/.env and frontend/.env

# 3. Bootstrap: deploy blueprint + schema, generate types, seed content
pnpm bootstrap

# 4. Run Studio (3333), storefront (3000), and functions
pnpm dev
```

The seed provisions the Sanity-side editorial layer (brand voice, five attribute
rules, the control plane, one example SKU enrichment). Products come from your
Shopify store — adjust each rule's `tags` to match your catalog, and open the SKU
enrichment in Studio to attach a real product with the picker.

## Environment variables

Three files, each scoped to a workspace. Admin credentials live **only** in the
root `.env` and are used solely to mint the public Storefront token — this starter
never pushes to Shopify.

| File            | Key vars                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `.env` (root)   | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SHOPIFY_*`, `STOREFRONT_REVALIDATE_URL`, `SANITY_REVALIDATE_SECRET` |
| `studio/.env`   | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_STUDIO_SHOPIFY_*`                                            |
| `frontend/.env` | `NEXT_PUBLIC_SANITY_*`, `NEXT_PUBLIC_SHOPIFY_*`, `SANITY_REVALIDATE_SECRET`                                               |

## Content model

| Type            | Kind      | Purpose                                                                             |
| --------------- | --------- | ----------------------------------------------------------------------------------- |
| `attributeRule` | document  | Reusable editorial block, tag-matched 1:many. `tags` / `excludedTags` decide match. |
| `controlPlane`  | singleton | Priority-ordered list of approved rules; optional per-product-type scopes.          |
| `skuEnrichment` | document  | SKU-specific, opt-in, 1:1 (matched by Shopify GID). Layered on top of rules.        |
| `brandVoice`    | singleton | AI generation context; `contextPrompt` wires to the org-level Content Agent prompt. |

**Resolution:** walk the control plane in priority order → a rule matches when ALL
its `tags` are present on the product and NO `excludedTags` are → first-match wins
within a `category` → sort matches by `order`. SKU enrichment layers on top.

## Project structure

```
commerce-pdp-management/
├── studio/                       # Sanity Studio v5
│   ├── schemaTypes/              #   attributeRule, controlPlane, skuEnrichment, brandVoice
│   ├── components/               #   ProductPickerInput
│   ├── structure.ts              #   Review queue, rules-by-category, singletons
│   └── seed/data.ndjson
├── frontend/                     # Next.js 16 + React 19 + Tailwind v4
│   ├── app/products/[handle]/    #   the PDP
│   ├── app/api/revalidate/       #   on-demand revalidation endpoint
│   ├── lib/product.ts            #   pull-only resolver + merge orchestration
│   └── sanity/queries.ts
├── functions/                    # Sanity Functions
│   ├── cache-revalidate/         #   invalidate the storefront CDN on publish
│   └── review-stamp/             #   stamp reviewedAt on approval
├── packages/@starter/
│   ├── commerce/                 #   Shopify adapter + resolvePdp + mergePdp (shared)
│   ├── eslint-config/  tsconfig/  sanity-types/
├── sanity.blueprint.ts
└── package.json
```

## Deploying

- **Studio & Functions** deploy to Sanity: `pnpm --filter studio run deploy` and
  `npx sanity blueprints deploy` (from the repo root).
- **Storefront** deploys to Vercel (dashboard import). Set
  `STOREFRONT_REVALIDATE_URL` in the root `.env` / Function env to the deployed
  `/api/revalidate` URL so publishes invalidate the live cache.

## Scripts

| Command                         | Description                                          |
| ------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                      | Studio, storefront, and functions concurrently       |
| `pnpm bootstrap`                | Deploy blueprint + schema, generate types, seed data |
| `pnpm seed`                     | Seed the PDP content model                           |
| `pnpm shopify:storefront-token` | Mint the public Storefront token                     |
| `pnpm typegen` / `typecheck`    | Regenerate / check Sanity types                      |
| `pnpm lint` / `format`          | Lint / format                                        |
| `pnpm validate`                 | Validate the starter template                        |
