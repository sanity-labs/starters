import {useFormValue} from 'sanity'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {LaunchIcon, SyncIcon} from '@sanity/icons'

export function KlaviyoDocumentDescription() {
  const docType = useFormValue(['_type']) as string | undefined
  const externalId = useFormValue(['externalId']) as string | undefined

  const typeLabel = docType === 'list' ? 'list' : 'segment'
  const klaviyoUrl = externalId ? `https://www.klaviyo.com/list/${externalId}` : null

  return (
    <Card padding={4} radius={2} tone="primary" border>
      <Stack space={3}>
        <Text size={1} weight="semibold">
          Managed in Klaviyo
        </Text>
        <Text size={1} muted>
          This {typeLabel} is synced from Klaviyo. To edit its name or membership criteria, make
          changes in Klaviyo, then refresh to pull updates into the Studio.
        </Text>
        <Flex gap={2} wrap="wrap">
          {klaviyoUrl && (
            <Button
              icon={LaunchIcon}
              text="Open in Klaviyo"
              tone="primary"
              fontSize={2}
              padding={3}
              as="a"
              href={klaviyoUrl}
              target="_blank"
              rel="noopener noreferrer"
            />
          )}
          <Button
            icon={SyncIcon}
            text="Sync with Klaviyo"
            mode="ghost"
            tone="primary"
            fontSize={2}
            padding={3}
            as="a"
            href="/structure/klaviyo;import"
          />
        </Flex>
      </Stack>
    </Card>
  )
}
