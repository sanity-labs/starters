// Object types (embedded)
// Document types (reusable)
import {agentConfig} from './documents/agentConfig'
import {agentConversation} from './documents/agentConversation'
import {brand} from './documents/brand'
import {category} from './documents/category'
import {color} from './documents/color'
import {material} from './documents/material'
import {product} from './documents/product'
import {size} from './documents/size'
import {price} from './objects/price'
import {productVariant} from './objects/productVariant'
import {seo} from './objects/seo'

export const schemaTypes = [
  // Objects (must be registered before documents that use them)
  seo,
  price,
  productVariant,

  // Documents
  brand,
  color,
  size,
  category,
  material,
  product,

  // Agent
  agentConfig,
  agentConversation,
]
