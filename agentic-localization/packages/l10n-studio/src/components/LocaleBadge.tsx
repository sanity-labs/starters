import type {DocumentBadgeComponent} from 'sanity'
import {getFlagFromCode, languageFieldName, resolveLocaleDefaults} from '@starter/l10n'

export const LocaleBadge: DocumentBadgeComponent = ({version, draft, published}) => {
  const doc = version || draft || published
  const language = doc?.[languageFieldName] as string | undefined

  if (!language) return null

  const flag = getFlagFromCode(language)
  const {title: displayName} = resolveLocaleDefaults(language)
  const label = flag ? `${flag} ${displayName}` : displayName

  return {label, title: language}
}
