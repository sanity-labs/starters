// Translation pane UI — inspector, pane, hooks, components.

export {createTranslationInspector} from './createTranslationPanePlugin'
export {ErrorBoundary} from './ErrorBoundary'
export {getStatusDisplay, type StatusDisplay} from './getStatusDisplay'
export {
  useTranslationTargets,
  useBaseDocumentId,
  type TranslationTargets,
} from './useTranslationTargets'
export {InlineDiff} from './InlineDiff'
export {PortableTextDiff} from './PortableTextDiff'
export {TranslationCompare, type TranslationCompareProps} from './TranslationCompare'
export {LocalizationRun, type LocalizationRunProps} from './LocalizationRun'
export {buildEditIntent, type EditIntent, type EditTarget} from './editIntent'
export {ReviewActions, type ReviewActionsProps} from './ReviewActions'
export {
  LOCALIZATION_WORKFLOW_DATASET,
  LOCALIZATION_WORKFLOW_TAG,
  useLocalizationEngine,
  useLocalizationInstance,
  type LocalizationInstanceLookup,
} from './workflowEngine'
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
} from './instanceFields'
export {
  buildLocaleRuns,
  liveChildInstanceIds,
  toChildRun,
  type ChildRun,
  type LocaleRun,
  type LocaleRunStage,
} from './localeRuns'
export {useReleases, type Release} from './useReleases'
export {useOpenTranslationsInspector} from './useOpenTranslationsInspector'
export {useLocales, type Language, type Locale} from '../L10nProvider'
export {
  useFieldTranslationData,
  type FieldLocaleStatus,
  type FieldTranslationSnapshot,
} from './useFieldTranslationData'
export {
  useFieldTranslateActions,
  type CellInFlightState,
  type FieldTranslateActionsResult,
} from './useFieldTranslateActions'
export {FieldTranslationContent} from './FieldTranslationContent'
export {useFieldWorkflowMetadata, type FieldWorkflowMetadata} from './useFieldWorkflowMetadata'
export {deriveFieldCellStates, findNewlyStaleEntries} from './deriveFieldCellStates'
export {useStaleSyncEffect} from './useStaleSyncEffect'
export {StaleDiffPopover} from './StaleDiffPopover'
export {createFieldTranslationPublishGate} from './useFieldTranslationPublishGate'
