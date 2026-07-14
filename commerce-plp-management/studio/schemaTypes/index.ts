import {blockContent} from './blockContent'
import {collectionEnrichment} from './documents/collectionEnrichment'
import {productBadge} from './documents/productBadge'
import {product} from './objects/product'
import {banner} from './objects/banner'
import {faceout} from './objects/faceout'
import {editorialTile} from './objects/editorialTile'
import {badgeAssignment} from './objects/badgeAssignment'
import {facetConfig} from './objects/facetConfig'
import {variantOverride} from './objects/variantOverride'
import {syncState} from './objects/syncState'

export const schemaTypes = [
  // Documents
  collectionEnrichment,
  productBadge,
  // Objects
  product,
  banner,
  faceout,
  editorialTile,
  badgeAssignment,
  facetConfig,
  variantOverride,
  syncState,
  blockContent,
]
