import {createOrReplace, defineMigration} from 'sanity/migrate'

import {localeTypeName, resolveLocaleDefaults} from '@starter/l10n'

/**
 * Locale codes to seed. Edit this array before running to customize.
 * All metadata is auto-derived from the BCP-47 code via Intl APIs.
 */
const LOCALE_CODES = [
  'en-US', // American English — source locale
  'de-DE', // German (Germany)
  'fr-FR', // French (France)
  'ja-JP', // Japanese (Japan)
  'es-ES', // Spanish (Spain)
  'pt-BR', // Portuguese (Brazil)
  'zh-CN', // Chinese (Simplified)
  'ar-SA', // Arabic (Saudi Arabia) — RTL
]

function buildLocaleDocument(code: string) {
  const {title, nativeName} = resolveLocaleDefaults(code)
  return {
    _id: `locale-${code}`,
    _type: localeTypeName,
    code,
    title,
    nativeName,
  }
}

export default defineMigration({
  title: 'Seed locale documents',

  async *migrate() {
    for (const code of LOCALE_CODES) {
      yield createOrReplace(buildLocaleDocument(code))
    }
  },
})
