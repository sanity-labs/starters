# Commerce PLP management — Agent Guide

Merchandiser-controlled category pages as a Sanity enrichment layer on top of
Shopify. Presence-based: a `collectionEnrichment` document activates the editorial
layer for a handle; no document means the storefront renders pure Shopify output.

## Stack

- **Studio** — Sanity Studio v5 (`studio/`): `collectionEnrichment` + `productBadge`, product picker, sync-status badge, merchandiser Structure views, Presentation.
- **Frontend** — Next.js 16 + React 19 + Tailwind v4 (`frontend/`): the Sanity Swag Store PLP with parallel fetch + merge.
- **Functions** — Sanity Functions (`functions/`): push-sync to Shopify metaobjects + badge re-sync.
- **Shared logic** — framework-agnostic package (`packages/@starter/commerce/`): Shopify adapter, merge logic, metaobject contract. Imported by both the frontend and the Functions.

## Commands (run from repo root)

- `pnpm install` — install all workspaces
- `pnpm shopify:setup` — create the Shopify metaobject definition (one time)
- `pnpm bootstrap` — deploy blueprint + schema, typegen, seed
- `pnpm dev` — Studio (3333), frontend (3000), functions
- `pnpm typegen` / `pnpm typecheck` / `pnpm lint` / `pnpm format` / `pnpm validate`

## Environment setup (three files, never committed)

```sh
cp .env.example .env
cp studio/.env.example studio/.env
cp frontend/.env.example frontend/.env
```

| File            | Who loads it                            | Must set                                                                                                                  |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `.env` (root)   | `sanity.blueprint.ts` (`dotenv/config`) | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` |
| `studio/.env`   | `studio/sanity.cli.ts`                  | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_STUDIO_SHOPIFY_*`                                            |
| `frontend/.env` | Next.js                                 | `NEXT_PUBLIC_SANITY_*`, `NEXT_PUBLIC_SHOPIFY_*`                                                                           |

**Admin credentials are sensitive** — root `.env` and Function runtime only, never
the browser. Dev Dashboard apps use `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET`
(exchanged for a short-lived token at runtime via the client credentials grant); a
legacy static `SHOPIFY_ADMIN_API_TOKEN` also works. **Storefront token** is public
(Studio picker + storefront reads).

## Code style

- ESM-first (`"type": "module"`), no semicolons, single quotes, no bracket spacing
- Format with `oxfmt`, lint with `eslint`
- Shared configs in `packages/@starter/` (eslint, tsconfig, sanity-types, commerce)

## Content model (the key decisions)

- **`collectionEnrichment`** — one per handle. `collectionType` is
  `shopify-native` (Shopify owns membership; Sanity layers editorial) or
  `sanity-custom` (Sanity owns membership + order via `productList`; Shopify
  supplies product data by GID batch). `handle` is immutable after first publish.
- **`productBadge`** — shared vocabulary. Referenced from
  `collectionEnrichment.badges` via `->`, so label/color edits are live on the pull
  path without republishing collections.
- **Product references are GIDs.** The `product` object stores `productGid` (the
  join key) plus a cached title/image for Studio display only. The storefront
  always reads live product data from Shopify by GID.
- **`syncStatus`** — system field written by the push-sync Function
  (`never | pending | synced | failed`). Read-only for merchandisers; rendered as a
  status card via `SyncStatusInput`.
- **`variantOverrides`** — AHEAD OF PRODUCT interim for audience-targeted PLPs,
  resolved at the storefront edge (`frontend/lib/audience.ts`). Non-sensitive
  segments only. Migration target: Content Variants — do not persist past GA.

## The merge (heart of the storefront)

`packages/@starter/commerce/src/merge.ts` → `mergeCollection({shopify, enrichment, audienceTag})`:

1. `enrichment == null` → return Shopify output untouched (`enriched: false`).
2. Resolve the audience variant, then build a badge map (date-gated by `now`).
3. Order products (custom → `productList` order; native → Shopify order).
4. Move the faceout to grid position 0; inject editorial tiles at their positions.
5. Reorder facets: promoted (from `facetConfig`) first, with label overrides.

The storefront calls it from `frontend/lib/collection.ts` after fetching the
enrichment (GROQ) and products (Shopify Storefront API) in parallel.

## The push-sync (Sanity → Shopify)

- `functions/collection-sync/` — on publish of a `collectionEnrichment`: mark
  `pending`, fetch the shaped enrichment, `ensureMetaobjectDefinition` +
  `upsertCollectionMetaobject` (Admin API), then stamp `synced` / `failed`.
- `functions/badge-resync/` — on publish of a `productBadge`: re-upsert the
  metaobject for every referencing collection (closes the push-path currency gap).
- The metaobject contract (`sanity_plp_collection`) lives in
  `packages/@starter/commerce/src/shopify/metaobject.ts` and is version-controlled.
  `pnpm shopify:setup` creates the definition idempotently.

## Deploying functions

Build from `functions/`, deploy the blueprint from the **repo root**:

```sh
pnpm --filter @starter/functions build
npx sanity blueprints deploy   # from repo root, not functions/
```

The blueprint injects `SHOPIFY_*` env onto the Function runtime from the root `.env`.

## Studio surfaces

- **Product picker** (`ProductPickerInput`) — searches the Shopify catalog by name
  via the public Storefront token; stores the GID. Reused by faceout, badges,
  productList, pinnedRecs.
- **Sync-status card** (`SyncStatusInput`) — green / yellow / red per document.
- **Structure** (`structure.ts`) — All collections, Enriched (native), Custom
  campaign collections, Badge vocabulary.
- **GID validation** — async warning when `productList` / faceout GIDs are inactive
  in Shopify (`lib/shopifyStudio.ts`).
- **Content Releases** — native; use for coordinated multi-collection campaigns.
