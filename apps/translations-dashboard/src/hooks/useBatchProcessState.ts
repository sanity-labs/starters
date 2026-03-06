import type {SanityDocument} from 'sanity'

import {useApp} from '../contexts/AppContext'
import {useBulkSetDocumentLanguage} from './useBulkSetDocumentLanguage'

// Define comprehensive batch process states
export type BatchProcessState =
  | 'COMPLETE' // Process finished
  | 'LOCALES_SET_COMPLETE' // Locales set, ready to translate
  | 'READY_TO_SET_LOCALES' // Documents selected, some missing locales
  | 'READY_TO_TRANSLATE' // Documents ready for translation
  | 'SELECTING' // User selecting documents
  | 'SETTING_LOCALES' // Actively setting document locales
  | 'TRANSLATING' // Actively translating documents
  | 'VALIDATING' // System validating selected documents

export interface BatchProcessStateInfo {
  canUserInteract: boolean
  currentState: BatchProcessState
  isProcessingState: boolean
  shouldDisableBatchModeToggle: boolean
  shouldDisableDocumentSelection: boolean
  shouldShowTranslatePrompt: boolean
}

export const useBatchProcessState = (
  validDocuments: SanityDocument[] = [],
  invalidDocuments: SanityDocument[] = [],
  fullyTranslatedDocuments: SanityDocument[] = [],
  isValidating: boolean = false,
): BatchProcessStateInfo => {
  const {batchTranslationStatus, isBatchTranslating, selectedDocuments} = useApp()

  const {isBulkSettingLanguage} = useBulkSetDocumentLanguage()

  // Compute the current batch process state
  const getBatchProcessState = (): BatchProcessState => {
    if (selectedDocuments.length === 0) return 'SELECTING'
    if (isValidating) return 'VALIDATING'
    if (isBulkSettingLanguage) return 'SETTING_LOCALES'
    if (isBatchTranslating) return 'TRANSLATING'

    // Check for completion states
    if (batchTranslationStatus?.success === true || batchTranslationStatus?.success === false) {
      return 'COMPLETE'
    }

    // Check for locales just set (success undefined is our special flag)
    if (
      batchTranslationStatus?.success === undefined &&
      batchTranslationStatus?.message?.includes('locales have been set')
    ) {
      return 'LOCALES_SET_COMPLETE'
    }

    // After validation, determine what state we're in
    if (
      invalidDocuments.length > 0 &&
      validDocuments.length === 0 &&
      fullyTranslatedDocuments.length === 0
    ) {
      return 'READY_TO_SET_LOCALES'
    }
    if (invalidDocuments.length > 0) {
      return 'READY_TO_SET_LOCALES'
    }
    if (validDocuments.length > 0 || fullyTranslatedDocuments.length > 0) {
      return 'READY_TO_TRANSLATE'
    }

    return 'SELECTING'
  }

  const currentState = getBatchProcessState()

  // Determine what actions should be disabled based on current state
  const shouldDisableDocumentSelection = [
    'LOCALES_SET_COMPLETE',
    'READY_TO_SET_LOCALES',
    'READY_TO_TRANSLATE',
    'SETTING_LOCALES',
    'TRANSLATING',
    'VALIDATING',
  ].includes(currentState)

  const shouldDisableBatchModeToggle = [
    'LOCALES_SET_COMPLETE',
    'READY_TO_SET_LOCALES',
    'READY_TO_TRANSLATE',
    'SETTING_LOCALES',
    'TRANSLATING',
    'VALIDATING',
  ].includes(currentState)

  const shouldShowTranslatePrompt = currentState === 'LOCALES_SET_COMPLETE'

  const isProcessingState = ['SETTING_LOCALES', 'TRANSLATING', 'VALIDATING'].includes(currentState)

  const canUserInteract = currentState === 'SELECTING' || currentState === 'COMPLETE'

  return {
    canUserInteract,
    currentState,
    isProcessingState,
    shouldDisableBatchModeToggle,
    shouldDisableDocumentSelection,
    shouldShowTranslatePrompt,
  }
}
