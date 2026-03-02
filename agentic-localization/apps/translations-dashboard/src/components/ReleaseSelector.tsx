/**
 * Release picker dropdown for batch translation CTAs.
 *
 * Simplified for inline use next to batch CTAs. Shows "Drafts" as default
 * + active releases from useReleases().
 *
 * Disabled during batch translation to prevent mid-batch target changes.
 * In-flight translations complete to the originally selected release;
 * picker change only affects the next action.
 */

import type {ReleaseDocument} from '@sanity/sdk'

import {Flex, Label, Select, Text} from '@sanity/ui'

interface ReleaseSelectorProps {
  disabled?: boolean
  onSelectRelease: (releaseId: string) => void
  releases: ReleaseDocument[]
  selectedRelease: string
}

function ReleaseSelector({
  disabled,
  onSelectRelease,
  releases,
  selectedRelease,
}: ReleaseSelectorProps) {
  if (releases.length === 0) {
    return (
      <Text muted size={1}>
        → Drafts
      </Text>
    )
  }

  return (
    <Flex direction="column" gap={2}>
      <Label size={2}>Perspective</Label>
      <Select
        disabled={disabled}
        fontSize={2}
        onChange={(e) => onSelectRelease(e.currentTarget.value)}
        padding={3}
        radius={3}
        value={selectedRelease}
      >
        <option value="">Drafts</option>
        {releases.map((release) => (
          <option key={release.name} value={release.name}>
            → {release.metadata.title || release.name}
          </option>
        ))}
      </Select>
    </Flex>
  )
}

export default ReleaseSelector
