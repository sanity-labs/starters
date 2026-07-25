/**
 * Every localization run currently in flight — campaigns and standalone
 * document runs. Live through the engine's instance list, so there is nothing
 * to refresh and nothing to poll.
 */

import {Badge, Box, Button, Card, Flex, Heading, Stack, Text} from '@sanity/ui'
import {useWorkflowInstances} from '@sanity/workflow-sdk'
import {localizeCampaign, localizeDocument} from '@starter/l10n/workflows'
import {useNavigate} from 'react-router-dom'

import {useL10nEngine} from '../hooks/useL10nEngine'

const DEFINITION_LABELS: Record<string, string> = {
  [localizeCampaign.name]: 'Campaign',
  [localizeDocument.name]: 'Document',
}

const MAX_ROWS = 8

function ActiveRunsSection() {
  const engine = useL10nEngine()
  const navigate = useNavigate()
  const {instances, loading} = useWorkflowInstances({
    engine,
    filter: {includeCompleted: false, limit: MAX_ROWS},
  })

  // An empty list once loading has settled is a confirmed "nothing running".
  if (loading || !instances || instances.length === 0) return null

  return (
    <Card border padding={4} radius={2}>
      <Stack space={4}>
        <Flex align="center" gap={2}>
          <Heading size={1}>In flight</Heading>
          <Badge tone="primary">{instances.length}</Badge>
        </Flex>
        <Stack space={2}>
          {instances.map((instance) => (
            <Card key={instance._id} padding={3} radius={2}>
              <Flex align="center" gap={3}>
                <Box flex={1}>
                  <Text size={1} weight="medium">
                    {DEFINITION_LABELS[instance.definition] ?? instance.definition}
                  </Text>
                </Box>
                <Badge mode="outline" tone="default">
                  {instance.currentStage}
                </Badge>
                <Button
                  fontSize={1}
                  mode="bleed"
                  onClick={() => navigate(`/runs/${instance._id}`)}
                  padding={2}
                  text="Open"
                />
              </Flex>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Card>
  )
}

export default ActiveRunsSection
