export {createL10n} from './plugin'
export {withLocaleFilter} from './structure'
export {
  localeTypeName,
  glossaryTypeName,
  styleGuideTypeName,
  glossaryEntryTypeName,
  localeTranslationTypeName,
  languageFieldName,
} from './types'
export {resolveLocaleDefaults, isValidLocale, getFlagFromCode} from './utils'
export {GLOSSARIES_QUERY, STYLE_GUIDE_FOR_LOCALE_QUERY, SUPPORTED_LANGUAGES_QUERY} from './queries'

// --- Re-exports from translations pane (UI) ---

export {createTranslationInspector} from './translations'
export {getStatusDisplay, type StatusDisplay} from './translations/getStatusDisplay'
export {
  resolveConfig,
  type LocalizedObject,
  type ResolvedTranslationsConfig,
  type StaleAnalysisResult,
  type StaleAnalysisSuggestion,
  type SuggestionReasonCode,
  type TranslationInFlightStatus,
  type TranslationsConfig,
  type TranslationStatus,
  type TranslationWorkflowStatus,
} from './core/types'
export {
  useTranslationTargets,
  useBaseDocumentId,
  type TranslationTargets,
} from './translations/useTranslationTargets'
export {InlineDiff} from './translations/InlineDiff'
export {extractBlockText} from './core/extractBlockText'
export {PortableTextDiff} from './translations/PortableTextDiff'
export {TranslationCompare, type TranslationCompareProps} from './translations/TranslationCompare'
export {LocalizationRun, type LocalizationRunProps} from './translations/LocalizationRun'
export {buildEditIntent, type EditIntent, type EditTarget} from './translations/editIntent'
export {ReviewActions, type ReviewActionsProps} from './translations/ReviewActions'
export {
  LOCALIZATION_WORKFLOW_DATASET,
  LOCALIZATION_WORKFLOW_TAG,
  LOCALIZE_DOCUMENT_DEFINITION,
  useLocalizationEngine,
  useLocalizationInstance,
  type LocalizationInstanceLookup,
} from './translations/workflowEngine'
export {
  readDocumentId,
  readFlag,
  readLocaleRequests,
  readMateriality,
  readProgress,
  readReleaseName,
  readText,
  type LocaleRequest,
  type Materiality,
} from './translations/instanceFields'
export {
  buildLocaleRuns,
  childInstanceIds,
  toChildRun,
  type ChildRun,
  type LocaleRun,
  type LocaleRunStage,
} from './translations/localeRuns'
export {
  computeMagnitude,
  computeFieldChanges,
  detectFieldType,
  type FieldChange,
  type FieldChangeMagnitude,
  type FieldType,
} from './core/computeFieldChanges'
export {useReleases, type Release} from './translations/useReleases'
export {ErrorBoundary} from './translations/ErrorBoundary'
export {useOpenTranslationsInspector} from './translations/useOpenTranslationsInspector'
export {useLocaleFilter} from './useLocaleFilter'
export {globalLocaleFilter$} from './localeFilterState'
export {buildFieldSummary, type TextExtracts} from './core/buildFieldSummary'
export {ANALYSIS_PROMPT_INSTRUCTION} from './core/staleAnalysisPrompt'
export {useLocales, type Language, type Locale} from './L10nProvider'
export {createLocalizationScheduleGate} from './translations/scheduleGate'
