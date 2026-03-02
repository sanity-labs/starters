import {type BadgeTone, Badge, Box, Flex, Text, Tooltip} from '@sanity/ui'

type StatusBadgeProps = {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  minWidth?: string
  text: string
  tone: BadgeTone
  tooltip?: string
}

export const StatusBadge = ({
  icon: Icon,
  minWidth = '4rem',
  text,
  tone,
  tooltip,
}: StatusBadgeProps) => {
  const badgeContent = (
    <span className="no-underline">
      <Badge style={{minWidth, padding: '12px 8px'}} tone={tone}>
        <Flex align="center" gap={2}>
          {Icon && <Icon className="size-6 text-inherit" />}
          <Text size={1}>{text}</Text>
        </Flex>
      </Badge>
    </span>
  )

  if (tooltip) {
    return (
      <Tooltip
        animate
        content={
          <Box padding={1}>
            <Text muted size={1}>
              {tooltip}
            </Text>
          </Box>
        }
        delay={500}
        placement="bottom"
        portal
      >
        {badgeContent}
      </Tooltip>
    )
  }

  return badgeContent
}
