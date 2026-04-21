import {campaign} from '../plugins/campaign'
import {promotion} from '../plugins/promotion/schemaTypes/promotion'
import {emailSlot} from '../plugins/promotion/schemaTypes/emailSlot'
import {workflowState} from './workflow.state'
import {klaviyoImport} from './klaviyoImport'
import {product} from './product'

import {store} from './reference-data/store'
import {urgencyStage} from './reference-data/urgencyStage'
import {segment} from './reference-data/segment'
import {brandVoice} from './reference-data/brandVoice'
import {enticement} from './reference-data/enticement'
import {promoCode} from './reference-data/promoCode'
import {termsAndConditions} from './reference-data/termsAndConditions'

export const schemaTypes = [
  campaign,
  promotion,
  emailSlot,
  workflowState,
  klaviyoImport,
  product,
  store,
  urgencyStage,
  segment,
  brandVoice,
  enticement,
  promoCode,
  termsAndConditions,
]
