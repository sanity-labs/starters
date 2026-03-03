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
  workflowStatesToMap,
  type DocumentState,
  type LocaleTranslation,
  type PreTranslatedSuggestion,
  type ResolvedTranslationsConfig,
  type ReviewProgress,
  type StaleAnalysisCache,
  type StaleAnalysisResult,
  type StaleAnalysisSuggestion,
  type SuggestionReasonCode,
  type TranslationInFlightStatus,
  type TranslationsConfig,
  type TranslationStatus,
  type TranslationWorkflowStatus,
  type WorkflowStateEntry,
} from './core/types'
export {
  getReviewProgress,
  getValidAnalysis,
  isAnalysisFresh,
  writeAnalysisCache,
  writeReviewProgress,
} from './core/staleAnalysisCache'
export {
  useTranslationPaneData,
  type TranslationPaneData,
  type TranslationPaneSnapshot,
} from './translations/useTranslationPaneData'
export {useTranslateActions, type TranslateActionsResult} from './translations/useTranslateActions'
export {InlineDiff} from './translations/InlineDiff'
export {extractBlockText} from './core/extractBlockText'
export {PortableTextDiff} from './translations/PortableTextDiff'
export {
  TranslatedDocTaskCard,
  type TranslatedDocTaskCardProps,
} from './translations/TranslatedDocTaskCard'
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
export {
  useDocumentWorkflowState,
  type UseDocumentWorkflowStateResult,
} from './translations/useDocumentWorkflowState'
export {useStaleAIAnalysis, type UseStaleAIAnalysisResult} from './translations/useStaleAIAnalysis'
export {useOpenTranslationsInspector} from './translations/useOpenTranslationsInspector'
export {useLocaleFilter} from './useLocaleFilter'
export {globalLocaleFilter$} from './localeFilterState'
export {buildFieldSummary, type TextExtracts} from './core/buildFieldSummary'
export {ANALYSIS_PROMPT_INSTRUCTION} from './core/staleAnalysisPrompt'
export {
  StaleAIAnalysis,
  StaleAIAnalysisStickyBar,
  AIAnalysisLoading,
  AIAnalysisError,
  type StaleAIAnalysisProps,
  type StaleAIAnalysisStickyBarProps,
} from './translations/StaleAIAnalysis'
