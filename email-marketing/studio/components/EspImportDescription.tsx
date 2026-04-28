import {Button, Card, Stack, Text} from '@sanity/ui'
import {LaunchIcon} from '@sanity/icons'

export function EspImportDescription() {
  return (
    <Card padding={4} radius={2} tone="primary" border>
      <Stack space={3}>
        <Text size={1} weight="semibold">
          Sync segments from Resend
        </Text>
        <Text size={1} muted>
          Segments are managed in Resend. Use the &ldquo;Sync with Resend&rdquo; button below to
          pull the latest segments into the Studio. You can then reference them when setting up
          campaign targeting.
        </Text>
        <Text size={1} muted>
          To create new segments, open your Resend dashboard, then refresh here to import them.
        </Text>
        <Button
          icon={LaunchIcon}
          text="Open Resend"
          tone="primary"
          fontSize={2}
          padding={3}
          as="a"
          href="https://resend.com/segments"
          target="_blank"
          rel="noopener noreferrer"
        />
      </Stack>
    </Card>
  )
}
