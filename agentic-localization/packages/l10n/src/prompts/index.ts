/**
 * `@starter/l10n/prompts`
 *
 * Prompt assembly and the GROQ queries that feed it — the starter's hypothesis
 * in code: glossaries, style guides and protected phrases stored as content,
 * assembled into the parameters an Agent Actions translate call takes.
 *
 * `buildTranslateParams` returns a `TranslateDocument` straight from
 * `@sanity/client`, so a caller hands it to `client.agent.action.translate()`
 * unchanged.
 *
 * Quality is measured, not asserted: `evals/` runs the assembled prompts against
 * the live model (`pnpm --filter l10n eval`).
 */

export {
  assembleStyleGuide,
  buildGlossarySection,
  buildStyleGuideSection,
  buildTranslateParams,
  extractDocumentText,
  extractProtectedPhrases,
  filterGlossaryByContent,
  measureStyleGuide,
  STYLE_GUIDE_WARN_THRESHOLD,
  type Glossary,
  type GlossaryEntry,
  type StyleGuide,
} from './promptAssembly'

export {
  GLOSSARIES_QUERY,
  LOCALE_CODES_QUERY,
  LOCALES_BY_CODE_QUERY,
  STYLE_GUIDE_FOR_LOCALE_QUERY,
  SUPPORTED_LANGUAGES_QUERY,
  TRANSLATIONS_FOR_DOCUMENT_QUERY,
} from './queries'
