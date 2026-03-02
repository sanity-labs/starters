import {Button, Flex, Spinner} from '@sanity/ui'
import type {SanityDocument} from 'sanity'

import type {BatchProcessState} from './types'

type ActionButtonsProps = {
  canTranslate: boolean
  currentState: BatchProcessState
  fullyTranslatedDocuments: SanityDocument[]
  hasWorkToDo: boolean
  invalidDocuments: SanityDocument[]
  isBatchTranslating: boolean
  onBatchTranslate: () => void
  validDocuments: SanityDocument[]
}

const ActionButtons = ({
  canTranslate,
  currentState,
  fullyTranslatedDocuments,
  hasWorkToDo,
  invalidDocuments,
  isBatchTranslating,
  onBatchTranslate,
  validDocuments,
}: ActionButtonsProps) => {
  const getButtonText = () => {
    if (currentState === 'LOCALES_SET_COMPLETE') {
      return '🚀 Start Batch Translation'
    }
    if (invalidDocuments.length > 0) {
      return `Fix ${invalidDocuments.length} document${invalidDocuments.length > 1 ? 's' : ''} first`
    }
    if (!hasWorkToDo && fullyTranslatedDocuments.length > 0) {
      return 'All documents fully translated'
    }
    if (validDocuments.length > 0 && fullyTranslatedDocuments.length > 0) {
      return `Translate ${validDocuments.length}, skip ${fullyTranslatedDocuments.length}`
    }
    return 'Bulk Auto Translate'
  }

  const getButtonTone = (): 'default' | 'positive' | 'primary' => {
    if (currentState === 'LOCALES_SET_COMPLETE') return 'positive'
    if (canTranslate && hasWorkToDo) return 'primary'
    return 'default'
  }

  const getButtonClassName = () => {
    const baseClass = 'flex-1'
    const pulseClass = currentState === 'LOCALES_SET_COMPLETE' ? 'animate-pulse' : ''
    return `${baseClass} ${pulseClass}`.trim()
  }

  return (
    <Flex align="center" className="relative" gap={2}>
      <Button
        className={getButtonClassName()}
        disabled={!canTranslate || !hasWorkToDo || isBatchTranslating}
        onClick={onBatchTranslate}
        text={getButtonText()}
        tone={getButtonTone()}
      />
      {isBatchTranslating && (
        <Spinner className="!absolute !right-1/2 !-translate-x-1/2" size={1} />
      )}
    </Flex>
  )
}

export default ActionButtons
