# Commerce PDP management — Agent Guide

An editorial enrichment layer for product detail pages, as a **pull-only** Sanity
layer on top of Shopify. Presence-based: if no attribute rule matches a product
and no SKU enrichment exists, the PDP renders as pure Shopify output; when
enrichment applies, it is merged over the Shopify data at render time. Nothing is
written back to Shopify.

## Stack

- **Studio** — Sanity Studio v5 (`studio/`): `attributeRule`, `skuEnrichment`,
  `controlPlane` (singleton), `brandVoice` (singleton), product picker, review
  queue + control-plane Structure, Presentation.
- **Frontend** — Next.js 16 + React 19 + Tailwind v4 (`frontend/`): the Sanity
  Swag Store PDP with a pull-only resolver + merge.
- **Functions** — Sanity Functions (`functions/`): `cache-revalidate` (invalidate
  the storefront CDN on publish) + `review-stamp` (stamp `reviewedAt` on approval).
- **Shared logic** — framework-agnostic package (`packages/@starter/commerce/`):
  Shopify Storefront adapter, the attribute-rule resolver, and the merge. Imported
  by both the frontend and the Functions.

## Commands (run from repo root)

- `pnpm install` — install all workspaces
- `pnpm shopify:storefront-token` — mint the public Storefront token (one time)
- `pnpm bootstrap` — deploy blueprint + schema, typegen, seed
- `pnpm dev` — Studio (3333), frontend (3000), functions
- `pnpm seed` — seed the PDP content model
- `pnpm typegen` / `pnpm typecheck` / `pnpm lint` / `pnpm format` / `pnpm validate`

## Environment setup (three files, never committed)

```sh
cp .env.example .env
cp studio/.env.example studio/.env
cp frontend/.env.example frontend/.env
```

| File            | Who loads it                            | Must set                                                                                        |
| --------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `.env` (root)   | `sanity.blueprint.ts` (`dotenv/config`) | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SHOPIFY_*` (mint script), revalidate vars |
| `studio/.env`   | `studio/sanity.cli.ts`                  | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, `SANITY_STUDIO_SHOPIFY_*`                  |
| `frontend/.env` | Next.js                                 | `NEXT_PUBLIC_SANITY_*`, `NEXT_PUBLIC_SHOPIFY_*`, `SANITY_REVALIDATE_SECRET`                     |

**Admin credentials are sensitive** — root `.env` only, used solely by
`pnpm shopify:storefront-token`. The **Storefront token** is public (Studio picker

- storefront reads). This starter never pushes to Shopify.

## Code style

- ESM-first (`"type": "module"`), no semicolons, single quotes, no bracket spacing
- Format with `oxfmt`, lint with `eslint`
- Shared configs in `packages/@starter/` (eslint, tsconfig, sanity-types, commerce)

## Content model (the key decisions)

- **`attributeRule`** — reusable editorial block, tag-matched 1:many. `tags` (ALL
  must be present) + `excludedTags` (ANY disqualifies) decide which products match.
  `category` (care/fit/lifestyle/spec/launch) drives first-match-wins per category.
  `status` gates the control plane — only `approved` rules are eligible.
- **`controlPlane`** — singleton. A priority-ordered `priorityList` of approved
  rules (drag to reprioritize). Optional `productTypeScopes` override order per
  Shopify product type. Editing this one list changes thousands of PDPs.
- **`skuEnrichment`** — SKU-specific, opt-in, 1:1 (matched by Shopify GID). Layered
  on top of rule-resolved content: headline, editorial copy, lifestyle images,
  launch badge.
- **`brandVoice`** — singleton. AI generation context; `contextPrompt` is wired to
  the org-level Content Agent prompt at setup.
- **Separate types over a unified enrichment type** — rules (1:many) and SKU
  enrichment (1:1) have different workflows and Studio surfaces. The Review Queue
  spans both via a `status` filter.

## The resolver + merge (heart of the storefront)

`packages/@starter/commerce/src/resolvePdp.ts` → `resolveAttributeRules`:

1. Pick the priority list (a matching `productTypeScope` overrides the global list).
2. Walk in priority order; a rule matches when ALL `tags` are present and NO
   `excludedTags` are.
3. First-match wins within a `category`.
4. Sort the matched set by `order` for display.

`packages/@starter/commerce/src/mergePdp.ts` → `mergeProduct({shopify, controlPlane, skuEnrichment})`:

- No rule matches and no SKU enrichment → return Shopify untouched (`enriched: false`).
- Otherwise layer resolved attributes + SKU enrichment; Shopify stays authoritative
  for identity, price, inventory, variants, and base media.

The storefront calls it from `frontend/lib/product.ts`: fetch the Shopify product
by handle, then the control plane + SKU enrichment (GROQ) in parallel, then merge.

## Cache invalidation (pull-only)

- `functions/cache-revalidate/` — on publish of a `controlPlane` / `attributeRule`
  / `skuEnrichment`, POST the storefront `/api/revalidate` endpoint (secret-guarded)
  so cached PDPs re-pull from Sanity's CDN. No push to Shopify.
- `functions/review-stamp/` — on `attributeRule` approval, stamp
  `aiEnrichment.reviewedAt` (only when missing, so it does not loop).

## Deploying functions

Build from `functions/`, deploy the blueprint from the **repo root**:

```sh
pnpm --filter @starter/functions build
npx sanity blueprints deploy   # from repo root, not functions/
```

The blueprint injects the revalidate + Sanity env onto the Function runtime from
the root `.env`.

## Studio surfaces

- **Review queue** — spans `attributeRule` (in-review) and `skuEnrichment` (draft).
- **Attribute rules** — browsable by category for large rule sets.
- **Control plane / Brand voice** — pinned singletons (can't be created/deleted).
- **Product picker** (`ProductPickerInput`) — searches Shopify by name via the
  public Storefront token; stores the GID for `skuEnrichment`.
- **Content Agent** — AI generation writes drafts (`aiGenerated: true`,
  `status: in-review`) governed by the `brandVoice` context prompt.
