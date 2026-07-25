/**
 * The Translations pane — inspector, hooks and components.
 *
 * Nothing here re-exports `@starter/l10n`. Status tables, instance-field
 * readers and locale-run projections are node-floor primitives; take them from
 * the package that owns them.
 */

export {createTranslationInspector} from './createTranslationPanePlugin'
export {ErrorBoundary} from './ErrorBoundary'
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
  LOCALIZE_DOCUMENT_DEFINITION,
  useLocalizationEngine,
  useLocalizationInstance,
  type LocalizationInstanceLookup,
} from './workflowEngine'
export {useReleases, type Release} from './useReleases'
export {useOpenTranslationsInspector} from './useOpenTranslationsInspector'
export {useLocales, type Language, type Locale} from '../L10nProvider'
export {createLocalizationScheduleGate} from './scheduleGate'
