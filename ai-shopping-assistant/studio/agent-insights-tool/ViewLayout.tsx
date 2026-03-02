import {Box, Card, Flex, Heading, Stack, Text} from '@sanity/ui'

interface ViewLayoutProps {
  title: string
  description: string
  children: React.ReactNode
  border?: boolean
}

export function ViewLayout(props: ViewLayoutProps) {
  const {title, description, children, border} = props

  return (
    <Flex direction="column" height="fill" overflow="auto" gap={2}>
      <Card padding={5}>
        <Stack space={4}>
          <Heading>{title}</Heading>

          <Text muted>{description}</Text>
        </Stack>
      </Card>

      <Box paddingX={5}>
        <Card border={border} radius={3} overflow="hidden">
          {children}
        </Card>

        {/* Spacer for bottom padding in scroll context */}
        <Box paddingY={3} />
      </Box>
    </Flex>
  )
}
