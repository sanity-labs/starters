import {faq} from './documents/faq'
import {helpArticle} from './documents/helpArticle'
import {internalCategory} from './documents/internalCategory'
import {playbook} from './documents/playbook'
import {policy} from './documents/policy'
import {product} from './documents/product'
import {topic} from './documents/topic'
import {blockContent} from './objects/blockContent'

export const schemaTypes = [
  // External content
  helpArticle,
  faq,
  // Internal content
  playbook,
  policy,
  // Shared taxonomy
  product,
  topic,
  internalCategory,
  // Objects
  blockContent,
]
