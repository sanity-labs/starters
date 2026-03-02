import type {DocumentBadgeComponent} from 'sanity'
import {getFlagFromCode, resolveLocaleDefaults} from '../utils'
import {languageFieldName} from '../types'

export const LocaleBadge: DocumentBadgeComponent = ({version, draft, published}) => {
  const doc = version || draft || published
  const language = doc?.[languageFieldName] as string | undefined

  if (!language) return null

  const flag = getFlagFromCode(language)
  const {title: displayName} = resolveLocaleDefaults(language)
  const label = flag ? `${flag} ${displayName}` : displayName

  return {label, title: language}
}
