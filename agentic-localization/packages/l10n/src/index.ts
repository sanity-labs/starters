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

export {
  getStatusDisplay,
  type StatusDisplay,
  type StatusIconName,
  type StatusTone,
} from './core/getStatusDisplay'

export {
  getFlagFromCode,
  isValidLocale,
  prepareGlossary,
  prepareGlossaryEntry,
  regionToFlag,
  resolveLocaleDefaults,
  uniqueLocaleValidator,
} from './core/utils'

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
export {readSubjectRun, type SubjectRun} from './core/subjectRuns'

export {getTranslationMetadataId} from './core/ids'
export {sanitizeTranslationValue} from './core/sanitizeTranslationValue'
