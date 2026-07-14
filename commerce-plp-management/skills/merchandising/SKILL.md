---
name: merchandising
description: 'Workflows for enriching Shopify collections and coordinating campaigns in this commerce-plp-management starter. Use when adding a banner/faceout/badge/tile to a collection, building a custom campaign collection, scheduling a multi-collection launch via Content Releases, or debugging the Shopify metaobject push-sync.'
---

# Merchandising workflows

Concrete, starter-specific recipes for the `collectionEnrichment` model.

## Enrich an existing Shopify collection

1. Create a `collectionEnrichment` document; set `handle` to the exact Shopify
   collection handle. Keep `collectionType` as `shopify-native`.
2. Add a `banner` (headline + color block), a `faceout` (pick the hero product),
   `editorialTiles` (set 1-based `position`), and `badges` (pick product + badge +
   optional start/end dates).
3. Publish. The storefront merges immediately (pull path). The push-sync Function
   writes the Shopify metaobject and stamps `syncStatus`.

Absence of a document = pure Shopify output. Delete the document to fully revert.

## Build a custom campaign collection (gift guide)

1. New `collectionEnrichment`; set `collectionType` to `sanity-custom` and choose a
   fresh `handle` (e.g. `holiday-gift-guide-2026`). Handle is immutable after
   publish.
2. Add products to `productList` with the picker; drag to set curation order
   (array order is the order). Sanity owns membership; Shopify supplies live data.
3. Add editorial tiles at positions, and an optional `variantOverrides` entry for
   a segment (e.g. `loyalty-member`).
4. Publish. The storefront routes `/collections/<handle>` to the custom path and
   batch-fetches products by GID.

## Coordinate a multi-collection campaign

Use native **Content Releases**: add every affected `collectionEnrichment` to one
release, preview, then schedule. All documents publish atomically; the push-sync
runs per document within seconds. No custom code.

## Debug the push-sync

- Check the **Shopify sync** card on the document: `synced` (green), `pending`
  (yellow), `failed` (red with error).
- The pull path (storefront) is unaffected by push failures.
- Metaobject definition drift → run `pnpm shopify:setup` to reconcile the
  `sanity_plp_collection` definition. The contract lives in
  `packages/@starter/commerce/src/shopify/metaobject.ts`.
- Badge label changed but Shopify metaobject stale? The `badge-resync` Function
  re-syncs referencing collections on `productBadge` publish.
