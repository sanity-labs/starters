/**
 * `@starter/l10n-studio` — the Studio surface of the localization pattern.
 *
 * The only layer allowed `react`, `sanity` and `@sanity/ui`. Everything that is
 * not UI — status tables, instance readers, prompt assembly, the workflow
 * definitions — comes from `@starter/l10n` and its entries, and is not
 * re-exported here.
 *
 * Schemas live at `@starter/l10n-studio/schemas`.
 */

// --- The plugin and its structure helpers ---

export {createL10n} from './plugin'
export {withLocaleFilter} from './structure'

// --- The Translations pane ---

export {createTranslationInspector} from './translations'
export {
  useTranslationTargets,
  useBaseDocumentId,
  type TranslationTargets,
} from './translations/useTranslationTargets'
export {InlineDiff} from './translations/InlineDiff'
export {PortableTextDiff} from './translations/PortableTextDiff'
export {TranslationCompare, type TranslationCompareProps} from './translations/TranslationCompare'
export {LocalizationRun, type LocalizationRunProps} from './translations/LocalizationRun'
export {buildEditIntent, type EditIntent, type EditTarget} from './translations/editIntent'
export {ReviewActions, type ReviewActionsProps} from './translations/ReviewActions'
export {ErrorBoundary} from './translations/ErrorBoundary'
export {useOpenTranslationsInspector} from './translations/useOpenTranslationsInspector'
export {useReleases, type Release} from './translations/useReleases'

// --- Engine wiring ---

export {
  LOCALIZE_DOCUMENT_DEFINITION,
  useLocalizationEngine,
  useLocalizationInstance,
  type LocalizationInstanceLookup,
} from './translations/workflowEngine'
export {createLocalizationScheduleGate} from './translations/scheduleGate'

// --- Locale context and filtering ---

export {useLocales, type Language, type Locale} from './L10nProvider'
export {useLocaleFilter} from './useLocaleFilter'
export {globalLocaleFilter$} from './localeFilterState'
