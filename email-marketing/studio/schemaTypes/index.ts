import {campaign} from '../plugins/campaign'
import {promotion} from '../plugins/promotion/schemaTypes/promotion'
import {
  emailHeader,
  emailSection,
  emailCTA,
  emailDivider,
  emailFooter,
} from '../plugins/promotion/schemaTypes/emailBlocks'
import {workflowState} from './workflow.state'
import {espImport} from './espImport'
import {product} from './product'

import {urgencyStage} from './reference-data/urgencyStage'
import {segment} from './reference-data/segment'
import {brandVoice} from './reference-data/brandVoice'

export const schemaTypes = [
  campaign,
  promotion,
  emailHeader,
  emailSection,
  emailCTA,
  emailDivider,
  emailFooter,
  workflowState,
  espImport,
  product,
  urgencyStage,
  segment,
  brandVoice,
]
