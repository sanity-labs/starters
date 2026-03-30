// Translation pane UI — inspector, pane, hooks, components.

export {createTranslationInspector} from './createTranslationPanePlugin'
export {ErrorBoundary} from './ErrorBoundary'
export {getStatusDisplay, type StatusDisplay} from './getStatusDisplay'
export {
  useTranslationPaneData,
  type TranslationPaneData,
  type TranslationPaneSnapshot,
} from './useTranslationPaneData'
export {useTranslateActions, type TranslateActionsResult} from './useTranslateActions'
export {InlineDiff} from './InlineDiff'
export {PortableTextDiff} from './PortableTextDiff'
export {TranslatedDocTaskCard, type TranslatedDocTaskCardProps} from './TranslatedDocTaskCard'
export {useReleases, type Release} from './useReleases'
export {
  useDocumentWorkflowState,
  type UseDocumentWorkflowStateResult,
} from './useDocumentWorkflowState'
export {useStaleAIAnalysis, type UseStaleAIAnalysisResult} from './useStaleAIAnalysis'
export {useOpenTranslationsInspector} from './useOpenTranslationsInspector'
export {
  StaleAIAnalysis,
  StaleAIAnalysisStickyBar,
  AIAnalysisLoading,
  AIAnalysisError,
  type StaleAIAnalysisProps,
  type StaleAIAnalysisStickyBarProps,
} from './StaleAIAnalysis'
export {useLocales, type Language} from './useLocales'
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
