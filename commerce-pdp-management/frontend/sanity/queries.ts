import {defineQuery} from 'next-sanity'

// Attribute rule projection, shaped to match the @starter/commerce AttributeRule
// type so the resolver can consume it directly.
const RULE = `{
  _id,
  name,
  category,
  description,
  "iconUrl": icon.asset->url,
  "tags": coalesce(tags, []),
  "excludedTags": coalesce(excludedTags, []),
  language,
  "order": coalesce(order, 0),
  status
}`

/**
 * The control plane singleton: the prioritized list of active attribute rules.
 * References resolve to approved rules in array (priority) order. A null result
 * means no rules are active — every product renders as pure Shopify.
 */
export const controlPlaneQuery = defineQuery(`
  *[_type == "controlPlane" && _id == "controlPlane"][0]{
    "priorityList": priorityList[]->${RULE},
    "productTypeScopes": productTypeScopes[]{
      productType,
      "ruleIds": priorityList[]._ref
    }
  }
`)

/**
 * SKU-specific enrichment for a product, matched by Shopify GID. Only approved
 * enrichment reaches the storefront; a null result means no bespoke overlay.
 */
export const skuEnrichmentByGidQuery = defineQuery(`
  *[_type == "skuEnrichment" && status == "approved" && product.productGid == $gid][0]{
    "productGid": product.productGid,
    headline,
    editorialCopy,
    "lifestyleImages": lifestyleImages[]{
      "url": asset->url,
      "altText": asset->altText
    },
    launchBadge,
    status
  }
`)
