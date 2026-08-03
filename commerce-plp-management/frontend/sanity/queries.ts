import {defineQuery} from 'next-sanity'

// Banner / faceout / tile projections, reused by the base doc and variant overrides.
const BANNER = `{"imageUrl": image.asset->url, headline, subhead, ctaLabel, ctaHref, theme}`
const FACEOUT = `{
  "productGid": product.productGid,
  variantGid,
  editorialHeadline,
  "imageUrlOverride": imageOverride.asset->url
}`
const TILES = `{position, "imageUrl": image.asset->url, headline, body, ctaLabel, ctaHref, theme}`

/**
 * Enrichment for a single collection handle. Presence of this document activates
 * the editorial layer; a null result means the storefront renders pure Shopify.
 * Badges resolve the shared vocabulary via `->` so label/color edits are live.
 */
export const collectionEnrichmentQuery = defineQuery(`
  *[_type == "collectionEnrichment" && handle.current == $handle][0]{
    "handle": handle.current,
    collectionType,
    title,
    banner ${BANNER},
    faceout ${FACEOUT},
    editorialTiles[] ${TILES},
    badges[]{
      "productGid": product.productGid,
      "badge": badge->{"slug": slug.current, label, color, icon},
      customLabel,
      startDate,
      endDate
    },
    facetConfig[]{facetHandle, labelOverride},
    productList[]{"productGid": productGid},
    variantOverrides[]{
      audienceTag,
      banner ${BANNER},
      faceout ${FACEOUT},
      editorialTiles[] ${TILES}
    },
    "syncStatus": syncStatus.status
  }
`)

/** All enrichment documents, for the store landing page and route generation. */
export const allCollectionsQuery = defineQuery(`
  *[_type == "collectionEnrichment" && defined(handle.current)] | order(handle.current asc){
    "handle": handle.current,
    "title": coalesce(title, handle.current),
    collectionType,
    "bannerImageUrl": banner.image.asset->url,
    "theme": coalesce(banner.theme, "yellow")
  }
`)

export const collectionHandlesQuery = defineQuery(`
  *[_type == "collectionEnrichment" && defined(handle.current)]{"handle": handle.current}
`)
