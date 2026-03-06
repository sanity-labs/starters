import {ArrowRightIcon, LockIcon} from '@sanity/icons'
import {Badge, Box, Flex, Text, Tooltip} from '@sanity/ui'

export function DestinationInfo({
  effectiveReleaseName,
  isLockedToRelease,
}: {
  effectiveReleaseName: null | string
  isLockedToRelease: boolean
}) {
  const destinationName = effectiveReleaseName || 'Drafts'
  const isDraftsMode = !effectiveReleaseName

  const tooltipText = isLockedToRelease
    ? `This locale is in a release. Translation will automatically go into "${destinationName}"`
    : isDraftsMode
      ? 'Translation will be created as a draft'
      : `Translation will go into "${destinationName}"`

  return (
    <Tooltip
      content={
        <Box padding={2}>
          <Text size={1}>{tooltipText}</Text>
        </Box>
      }
    >
      <Badge padding={3} radius={3} tone={isDraftsMode ? 'default' : undefined}>
        <Flex align="center" gap={2}>
          {isLockedToRelease ? <LockIcon /> : <ArrowRightIcon />}
          <Text size={1}>{destinationName}</Text>
        </Flex>
      </Badge>
    </Tooltip>
  )
}
