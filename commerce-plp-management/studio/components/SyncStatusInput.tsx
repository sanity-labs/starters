import {type ObjectInputProps} from 'sanity'
import {Badge, Card, Flex, Stack, Text} from '@sanity/ui'
import {CheckmarkCircleIcon, ClockIcon, WarningOutlineIcon} from '@sanity/icons'

type SyncState = {
  status?: 'never' | 'pending' | 'synced' | 'failed'
  lastSyncedAt?: string
  error?: string
}

const CONFIG = {
  synced: {tone: 'positive', icon: CheckmarkCircleIcon, label: 'Synced to Shopify'},
  pending: {tone: 'caution', icon: ClockIcon, label: 'Sync pending'},
  failed: {tone: 'critical', icon: WarningOutlineIcon, label: 'Sync failed'},
  never: {tone: 'default', icon: ClockIcon, label: 'Not yet synced'},
} as const

/**
 * Read-only status card written by the push-sync Function. Surfaces the Shopify
 * metaobject sync state (green / yellow / red) and any error, without the
 * merchandiser leaving Studio. The Sanity CDN pull path is unaffected by push
 * failures — the storefront still serves enrichment correctly.
 */
export function SyncStatusInput(props: ObjectInputProps<SyncState>) {
  const value = props.value
  const status = value?.status ?? 'never'
  const config = CONFIG[status]
  const Icon = config.icon

  return (
    <Card padding={3} radius={2} tone={config.tone} border>
      <Stack space={3}>
        <Flex align="center" gap={2}>
          <Text size={2}>
            <Icon />
          </Text>
          <Badge tone={config.tone} mode="outline">
            {config.label}
          </Badge>
        </Flex>
        {value?.lastSyncedAt ? (
          <Text size={1} muted>
            Last synced {new Date(value.lastSyncedAt).toLocaleString()}
          </Text>
        ) : null}
        {status === 'failed' && value?.error ? <Text size={1}>{value.error}</Text> : null}
      </Stack>
    </Card>
  )
}
