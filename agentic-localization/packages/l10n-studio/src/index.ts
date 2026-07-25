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

// --- The learning loop's reviewer surface ---

export {
  ACCEPT_TARGETS_QUERY,
  acceptBlocker,
  acceptedKey,
  acceptProposal,
  acceptProposalAction,
  glossaryEntryFor,
  proposalActions,
  readAcceptTargets,
  readProposal,
  rejectProposal,
  rejectProposalAction,
  styleRuleBlockFor,
  type AcceptableProposal,
  type AcceptTargets,
} from './proposals'

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
