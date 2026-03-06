import {Badge, Box, Card, Flex, Text} from '@sanity/ui'

import type {BatchProcessState} from './types'

type StatusIndicatorProps = {
  currentState: BatchProcessState
  selectedDocumentsCount: number
}

const getStateColorClass = (state: BatchProcessState): string => {
  switch (state) {
    case 'COMPLETE':
      return 'bg-green-500'
    case 'LOCALES_SET_COMPLETE':
      return 'bg-green-500'
    case 'READY_TO_SET_LOCALES':
      return 'bg-red-500'
    case 'READY_TO_TRANSLATE':
      return 'bg-blue-500'
    case 'SETTING_LOCALES':
      return 'bg-yellow-500'
    case 'TRANSLATING':
      return 'bg-yellow-500'
    case 'VALIDATING':
      return 'bg-yellow-500'
    default:
      return 'bg-gray-400'
  }
}

const getStateMessage = (state: BatchProcessState): string => {
  switch (state) {
    case 'COMPLETE':
      return 'Batch process completed'
    case 'READY_TO_TRANSLATE':
      return 'Documents ready for batch translation'
    case 'SETTING_LOCALES':
      return 'Setting document locales...'
    case 'TRANSLATING':
      return 'Translation in progress...'
    case 'VALIDATING':
      return 'Validating selected documents...'
    default:
      return 'Unknown state'
  }
}

const StatusIndicator = ({currentState, selectedDocumentsCount}: StatusIndicatorProps) => {
  return (
    <>
      <Flex align="center" gap={2}>
        <Badge padding={2} radius={2} tone="primary">
          {selectedDocumentsCount}
        </Badge>
        <Text size={1}>
          {selectedDocumentsCount === 1 ? 'document selected' : 'documents selected'}
        </Text>

        {currentState !== 'SELECTING' && (
          <Card className="border border-gray-200" padding={2} radius={1} tone="transparent">
            <Flex align="center" gap={2}>
              <Box
                className={`w-1.5 h-1.5 ${getStateColorClass(currentState)} rounded-full flex-shrink-0`}
              />
              <Text size={0} weight="medium">
                {getStateMessage(currentState)}
              </Text>
            </Flex>
          </Card>
        )}
      </Flex>
    </>
  )
}

export default StatusIndicator
