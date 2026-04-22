import {campaign} from '../plugins/campaign'
import {promotion} from '../plugins/promotion/schemaTypes/promotion'
import {emailSlot} from '../plugins/promotion/schemaTypes/emailSlot'
import {workflowState} from './workflow.state'
import {klaviyoImport} from './klaviyoImport'
import {product} from './product'

import {urgencyStage} from './reference-data/urgencyStage'
import {segment} from './reference-data/segment'
import {brandVoice} from './reference-data/brandVoice'

export const schemaTypes = [
  campaign,
  promotion,
  emailSlot,
  workflowState,
  klaviyoImport,
  product,
  urgencyStage,
  segment,
  brandVoice,
]
