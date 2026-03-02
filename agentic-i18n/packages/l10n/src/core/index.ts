/**
 * @starter/l10n/core
 *
 * Pure translation logic — zero runtime browser dependencies.
 * Safe to import in Sanity Functions, Node.js scripts, and browser contexts.
 *
 * The rule: no `react`, no `sanity`, no `@sanity/ui`, no plugins.
 * Type-only imports from `@sanity/client` are fine (erased at compile time).
 */

// Types
export {
  resolveConfig,
  workflowStatesToMap,
  type DocumentState,
  type LegacyDocumentStatus,
  type LocaleTranslation,
  type PreTranslatedSuggestion,
  type ResolvedTranslationsConfig,
  type ReviewProgress,
  type StaleAnalysisCache,
  type StaleAnalysisResult,
  type StaleAnalysisSuggestion,
  type SuggestionReasonCode,
  type TranslationDataStatus,
  type TranslationInFlightStatus,
  type TranslationsConfig,
  type TranslationStatus,
  type TranslationWorkflowStatus,
  type WorkflowStateEntry,
} from './types'

// Field change computation
export {
  computeFieldChanges,
  computeMagnitude,
  detectFieldType,
  type FieldChange,
  type FieldChangeMagnitude,
  type FieldType,
} from './computeFieldChanges'

// Portable Text extraction
export {extractBlockText} from './extractBlockText'

// AI analysis prompt + field summary
export {buildFieldSummary, type TextExtracts} from './buildFieldSummary'
export {ANALYSIS_PROMPT_INSTRUCTION} from './staleAnalysisPrompt'

// Translation value sanitization
export {sanitizeTranslationValue} from './sanitizeTranslationValue'

// Analysis cache helpers
export {
  getReviewProgress,
  getValidAnalysis,
  isAnalysisFresh,
  writeAnalysisCache,
  writeReviewProgress,
} from './staleAnalysisCache'
