import {segment} from './audience'
import {campaign} from './campaign'
import {email, emailCTA, emailDivider, emailFooter, emailHeader, emailSection} from './email'
import {emailSettings} from './emailSettings'
import {klaviyoImport} from './klaviyoImport'
import {list} from './list'
import {product} from './product'

export const schemaTypes = [
  campaign,
  email,
  emailHeader,
  emailSection,
  emailCTA,
  emailDivider,
  emailFooter,
  emailSettings,
  klaviyoImport,
  product,
  list,
  segment,
]
