import type {SanityDocument} from 'sanity'

import {Button, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'

import type {BulkLanguageProgress} from './types'

type BulkLanguageCardProps = {
  bulkLanguageProgress: {current: number; currentDocId?: string; total: number} | null
  defaultLanguage: null | string
  invalidDocuments: SanityDocument[]
  isBulkSettingLanguage: boolean
  onBulkSetLanguage: () => void
}

const BulkLanguageCard = ({
  bulkLanguageProgress,
  defaultLanguage,
  invalidDocuments,
  isBulkSettingLanguage,
  onBulkSetLanguage,
}: BulkLanguageCardProps) => {
  if (invalidDocuments.length === 0 || isBulkSettingLanguage || !defaultLanguage) return null

  return (
    <Card padding={3} radius={1} tone="caution">
      <Stack space={3}>
        <Text size={1} weight="medium">
          💡 Bulk Language Setting Available
        </Text>
        <Text size={1}>
          {invalidDocuments.length} document{invalidDocuments.length > 1 ? 's' : ''} missing base
          language. Set them all to <strong>{defaultLanguage}</strong> to enable translation.
        </Text>
        <Button
          disabled={isBulkSettingLanguage}
          onClick={onBulkSetLanguage}
          size={1}
          text={`Set ${invalidDocuments.length} document${invalidDocuments.length > 1 ? 's' : ''} to ${defaultLanguage}`}
          tone="primary"
        />
      </Stack>
    </Card>
  )
}

const BulkLanguageProgressCard = ({
  bulkLanguageProgress,
}: {
  bulkLanguageProgress: BulkLanguageProgress
}) => (
  <Card padding={3} radius={1} tone="default">
    <Stack space={2}>
      <Flex align="center" gap={2}>
        <Spinner size={0} />
        <Text size={1}>
          Setting language for document {bulkLanguageProgress.current} of{' '}
          {bulkLanguageProgress.total}...
        </Text>
      </Flex>
      {bulkLanguageProgress.currentDocId && (
        <Text className="font-mono" muted size={0}>
          {bulkLanguageProgress.currentDocId.substring(0, 8)}...
        </Text>
      )}
    </Stack>
  </Card>
)

export {BulkLanguageCard, BulkLanguageProgressCard as BulkLanguageProgress}
