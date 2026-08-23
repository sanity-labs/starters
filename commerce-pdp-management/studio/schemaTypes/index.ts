import {blockContent} from './blockContent'
import {attributeRule} from './documents/attributeRule'
import {controlPlane} from './documents/controlPlane'
import {skuEnrichment} from './documents/skuEnrichment'
import {brandVoice} from './documents/brandVoice'
import {product} from './objects/product'
import {aiEnrichment} from './objects/aiEnrichment'
import {examplePhrase} from './objects/examplePhrase'
import {productTypeScope} from './objects/productTypeScope'

export const schemaTypes = [
  // Documents
  attributeRule,
  controlPlane,
  skuEnrichment,
  brandVoice,
  // Objects
  product,
  aiEnrichment,
  examplePhrase,
  productTypeScope,
  blockContent,
]

/** Document types managed as singletons (one instance, fixed id). */
export const singletonTypes = new Set(['controlPlane', 'brandVoice'])
