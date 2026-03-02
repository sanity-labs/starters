import {CommentIcon, DashboardIcon} from '@sanity/icons'
import {Box, Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {useRouter, useRouterState} from 'sanity/router'

import {ConversationsView} from './ConversationsView'
import {OverviewView} from './OverviewView'

export function AgentInsightsTool() {
  const router = useRouter()
  const routerState = useRouterState()

  // Get the current path from router state
  const currentPath = routerState?.path

  const navigateTo = (path: string) => {
    router.navigate({path})
  }

  const renderContent = () => {
    switch (currentPath) {
      case 'conversations':
        return <ConversationsView />
      case 'overview':
      default:
        return <OverviewView />
    }
  }

  return (
    <Flex height="fill" overflow="hidden">
      <Card padding={4} style={{width: 250}} borderRight height="fill">
        <Flex direction="column" gap={4}>
          <Box>
            <Text muted size={1} weight="medium">
              Agent Insights
            </Text>
          </Box>

          <Stack space={2} flex={1}>
            <Button
              icon={DashboardIcon}
              justify="flex-start"
              mode="bleed"
              onClick={() => navigateTo('overview')}
              selected={currentPath === 'overview'}
              text="Overview"
              tone={currentPath === 'overview' ? 'primary' : undefined}
            />

            <Button
              icon={CommentIcon}
              justify="flex-start"
              mode="bleed"
              onClick={() => navigateTo('conversations')}
              selected={currentPath === 'conversations'}
              text="Conversations"
              tone={currentPath === 'conversations' ? 'primary' : undefined}
            />
          </Stack>
        </Flex>
      </Card>

      <Flex direction="column" flex={1} overflow="hidden" height="fill">
        {renderContent()}
      </Flex>
    </Flex>
  )
}
