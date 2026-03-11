import {Button, Card, Stack, Text} from '@sanity/ui'
import {LaunchIcon} from '@sanity/icons'

export function KlaviyoImportDescription() {
  return (
    <Card padding={4} radius={2} tone="primary" border>
      <Stack space={3}>
        <Text size={1} weight="semibold">
          Sync lists and segments from Klaviyo
        </Text>
        <Text size={1} muted>
          Lists and segments are managed in Klaviyo. Use the &ldquo;Refresh from Klaviyo&rdquo;
          button below to pull the latest lists and segments into the Studio. You can then reference
          them when setting up campaign targeting.
        </Text>
        <Text size={1} muted>
          To create new lists or segments, open your Klaviyo dashboard, then refresh here to import
          them.
        </Text>
        <Button
          icon={LaunchIcon}
          text="Open Klaviyo"
          tone="primary"
          fontSize={2}
          padding={3}
          as="a"
          href="https://www.klaviyo.com/lists"
          target="_blank"
          rel="noopener noreferrer"
        />
      </Stack>
    </Card>
  )
}
