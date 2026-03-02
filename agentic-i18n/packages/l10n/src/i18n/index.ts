import {defineLocaleResourceBundle} from 'sanity'

export const l10nLocaleNamespace = 'l10n' as const

export const l10nUsEnglishLocaleBundle = defineLocaleResourceBundle({
  locale: 'en-US',
  namespace: l10nLocaleNamespace,
  resources: () => import('./resources'),
})
