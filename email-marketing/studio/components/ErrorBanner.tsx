import {type StringInputProps, useFormValue} from 'sanity'
import {Card, Flex, Stack, Text} from '@sanity/ui'

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function ErrorBanner(props: StringInputProps) {
  const {value, schemaType} = props
  const isSendError = schemaType.name === 'sendErrorMessage'
  const syncState = useFormValue([isSendError ? 'sendState' : 'syncState']) as string | undefined
  const timestamp = useFormValue([isSendError ? 'lastSentAt' : 'lastSyncedAt']) as
    | string
    | undefined

  if (!value) {
    const isSuccess = isSendError ? syncState === 'sent' : syncState === 'synced'
    if (isSuccess) {
      return (
        <Card padding={3} radius={2} shadow={1} tone="positive">
          <Flex justify="space-between" align="center">
            <Text size={1} weight="bold">
              {isSendError ? 'Sent successfully' : 'Synced successfully'}
            </Text>
            {timestamp && (
              <Text size={1} muted>
                {formatTimestamp(timestamp)}
              </Text>
            )}
          </Flex>
        </Card>
      )
    }
    return null
  }

  return (
    <Card padding={3} radius={2} shadow={1} tone="critical">
      <Stack space={2}>
        <Flex justify="space-between" align="center">
          <Text size={1} weight="bold">
            {isSendError ? 'Send Failed' : 'Sync Failed'}
          </Text>
          {timestamp && (
            <Text size={1} muted>
              Last success: {formatTimestamp(timestamp)}
            </Text>
          )}
        </Flex>
        <Text size={1} muted>
          {value}
        </Text>
      </Stack>
    </Card>
  )
}
