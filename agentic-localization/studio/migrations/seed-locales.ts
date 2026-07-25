import {createOrReplace, defineMigration} from 'sanity/migrate'

import {localeTypeName, resolveLocaleDefaults} from '@starter/l10n'
import {SOURCE_LANGUAGE} from '@starter/l10n/workflows'

/**
 * Locale codes to seed. Edit this array before running to customize.
 * All metadata is auto-derived from the BCP-47 code via Intl APIs.
 *
 * The first entry is the source locale, so it reads `SOURCE_LANGUAGE` rather
 * than a literal: every other code is a translation target, and a run derives
 * its targets by excluding the source from this set.
 */
const LOCALE_CODES = [
  SOURCE_LANGUAGE, // the source locale — packages/l10n/src/workflows/config.ts
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
