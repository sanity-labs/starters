/**
 * `@starter/l10n` — the core primitives every localization surface shares.
 *
 * The node floor: no `react`, no `sanity`, no `@sanity/ui`. A Sanity Function,
 * the CLI, a frontend and the Studio plugin all import from here at the same
 * cost, which is the whole reason the package is split this way.
 *
 * Siblings: `./prompts` (prompt assembly + queries), `./workflows` (the
 * definitions), `./effects` (the handlers that satisfy them). Studio UI lives in
 * `@starter/l10n-studio`.
 */

// --- Schema type names ---

export {
  distillationTypeName,
  glossaryEntryTypeName,
  glossaryTypeName,
  languageFieldName,
  localeTranslationTypeName,
  localeTypeName,
  proposalTypeName,
  styleGuideTypeName,
} from './core/typeNames'

/** What the learning loop may propose. The schema and the Accept action share it. */
export {
  isProposalKind,
  MODEL_PROPOSAL_KINDS,
  PROPOSAL_KINDS,
  type ModelProposalKind,
  type ProposalKind,
} from './core/proposalKinds'

// --- Configuration and status vocabulary ---

export {
  resolveConfig,
  type InternationalizedArrayItem,
  type LocalizedObject,
  type ResolvedTranslationsConfig,
  type StaleAnalysisResult,
  type StaleAnalysisSuggestion,
  type SuggestionReasonCode,
  type TranslationInFlightStatus,
  type TranslationReference,
  type TranslationsConfig,
  type TranslationStatus,
  type TranslationWorkflowStatus,
} from './core/types'

/** Status → icon name, tone and label. The surface binds the icon component. */
export {
  getStatusDisplay,
  type StatusDisplay,
  type StatusIconName,
  type StatusTone,
} from './core/getStatusDisplay'

// --- Locale utilities (Intl-powered, no data source) ---

export {
  getFlagFromCode,
  isValidLocale,
  prepareGlossary,
  prepareGlossaryEntry,
  regionToFlag,
  resolveLocaleDefaults,
  uniqueLocaleValidator,
} from './core/utils'

// --- The field-level localization tier ---

export {
  coveredLocales,
  entriesOf,
  entryFor,
  fieldTierTypes,
  internationalizedFields,
  isFieldTier,
  sourceProjection,
  startPerspectiveFor,
  type InternationalizedField,
} from './core/fieldTier'

// --- Change detection and summarization ---

export {
  computeFieldChanges,
  computeMagnitude,
  detectFieldType,
  type FieldChange,
  type FieldChangeMagnitude,
  type FieldType,
} from './core/computeFieldChanges'
export {buildDiffAwareExtract, buildFieldSummary, type TextExtracts} from './core/buildFieldSummary'
export {diffBlockTexts, diffTextSegments, type BlockChange, type TextSegment} from './core/textDiff'
export {ANALYSIS_PROMPT_INSTRUCTION} from './core/staleAnalysisPrompt'
export {extractBlockText} from './core/extractBlockText'
export {compareSides, type CompareSides, type CompareSidesArgs} from './core/compareSides'

// --- Reading workflow instance state ---

export {
  readDocumentId,
  readFlag,
  readLocaleRequests,
  readMateriality,
  readProgress,
  readReleaseName,
  readText,
  type FieldSource,
  type LocaleRequest,
  type Materiality,
} from './core/instanceFields'
export {
  buildLocaleRuns,
  childInstanceIds,
  toChildRun,
  type ChildRun,
  type LocaleRun,
  type LocaleRunStage,
} from './core/localeRuns'

// --- Deterministic ids and value hygiene ---

export {getTranslationMetadataId} from './core/ids'
export {sanitizeTranslationValue} from './core/sanitizeTranslationValue'
