import type {ReleaseDocument} from '@sanity/sdk'

import {Card, Flex, Heading, Select, Stack, Text} from '@sanity/ui'

interface ReleaseSelectorProps {
  disabled?: boolean
  onSelectRelease: (releaseId: string) => void
  releases: ReleaseDocument[]
  selectedRelease: null | string
}

export function ReleaseSelector({
  disabled,
  onSelectRelease,
  releases,
  selectedRelease,
}: ReleaseSelectorProps) {
  // Empty state: no releases exist
  if (releases.length === 0 && !disabled) {
    return (
      <Card padding={4} radius={2} shadow={1} tone="caution">
        <Stack space={3}>
          <Text size={2} weight="semibold">
            No Active Releases
          </Text>
          <Text size={1}>
            No releases are available. Please contact an administrator to create releases for
            translation.
          </Text>
        </Stack>
      </Card>
    )
  }

  return (
    <Flex align="center" gap={2}>
      <Heading size={2}>Perspective:</Heading>
      <Select
        className="flex-1"
        disabled={disabled}
        onChange={(e) => {
          onSelectRelease(e.currentTarget.value)
        }}
        style={{backgroundColor: 'var(--card-background-color)'}}
        value={selectedRelease || ''}
      >
        <option value="">Drafts</option>
        {releases.map((release) => (
          <option key={release.name} value={release.name}>
            {release.metadata.title || release.name}
          </option>
        ))}
      </Select>
    </Flex>
  )
}
