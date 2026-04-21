import {useState} from 'react'
import {Box, Stack, Text, Spinner, Flex} from '@sanity/ui'
import {SparklesIcon} from '@sanity/icons'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  type DocumentActionComponent,
  useClient,
  useWorkspaceSchemaId,
} from 'sanity'
import {defineQuery} from 'groq'
import {
  buildInstruction,
  fetchCampaignContext,
  fetchBrandVoice,
  fetchSegmentContext,
} from '../hooks/useAgentContext'

const CAMPAIGN_SEGMENTS_QUERY = defineQuery(`
  *[_type == "campaign" && (_id == $id || _id == $draftId)][0]{
    "segmentIds": segments[]._ref
  }
`)

export const GenerateVariantsAction: DocumentActionComponent = (props) => {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const agentClient = useClient({apiVersion: 'X'})
  const schemaId = useWorkspaceSchemaId()
  const [progress, setProgress] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRunning = progress !== null && !done && !error

  const onHandle = async () => {
    setProgress('Fetching campaign context...')
    setDone(false)
    setError(null)

    try {
      const campaignId = props.id

      const [campaignData, campaignBrief, brandVoice] = await Promise.all([
        client.fetch<{segmentIds: string[]} | null>(CAMPAIGN_SEGMENTS_QUERY, {
          id: campaignId,
          draftId: `drafts.${campaignId}`,
        }),
        fetchCampaignContext(client, campaignId),
        fetchBrandVoice(client),
      ])

      const segmentIds = campaignData?.segmentIds ?? []

      setProgress('Generating base promotion...')

      const basePromotionId = `promotion-${campaignId}-base`
      const baseInstruction = buildInstruction(campaignBrief, brandVoice, null)

      await agentClient.agent.action.generate({
        targetDocument: {
          operation: 'createOrReplace',
          _id: basePromotionId,
          _type: 'promotion',
          initialValues: {
            campaign: {_type: 'reference', _ref: campaignId},
            isBasePromotion: true,
          },
        },
        schemaId,
        instruction: baseInstruction,
        target: [{path: 'subjectLine'}, {path: 'preheader'}, {path: 'disruptor'}],
      })

      await client.createOrReplace({
        _id: `wf-${basePromotionId}`,
        _type: 'workflow.state',
        promotionId: {_type: 'reference', _ref: basePromotionId},
        status: 'draft',
        history: [
          {
            _key: `h-${Date.now()}`,
            _type: 'object',
            status: 'draft',
            timestamp: new Date().toISOString(),
          },
        ],
      })

      for (let i = 0; i < segmentIds.length; i++) {
        const segmentId = segmentIds[i]
        const segment = await fetchSegmentContext(client, segmentId)
        const segmentName = segment?.name ?? `Segment ${i + 1}`

        setProgress(`Generating variant ${i + 1} of ${segmentIds.length}: ${segmentName}...`)

        const variantId = `promotion-${campaignId}-${segmentId}`
        const variantInstruction = buildInstruction(campaignBrief, brandVoice, segment)

        await agentClient.agent.action.generate({
          targetDocument: {
            operation: 'createOrReplace',
            _id: variantId,
            _type: 'promotion',
            initialValues: {
              campaign: {_type: 'reference', _ref: campaignId},
              segment: {_type: 'reference', _ref: segmentId},
              isBasePromotion: false,
            },
          },
          schemaId,
          instruction: variantInstruction,
          target: [{path: 'subjectLine'}, {path: 'preheader'}, {path: 'disruptor'}],
        })

        await client.createOrReplace({
          _id: `wf-${variantId}`,
          _type: 'workflow.state',
          promotionId: {_type: 'reference', _ref: variantId},
          status: 'draft',
          history: [
            {
              _key: `h-${Date.now()}`,
              _type: 'object',
              status: 'draft',
              timestamp: new Date().toISOString(),
            },
          ],
        })
      }

      setProgress(
        `Generated ${segmentIds.length + 1} promotion${segmentIds.length !== 0 ? 's' : ''} (1 base + ${segmentIds.length} variants)`,
      )
      setDone(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    }
  }

  const hasPublished = Boolean(props.published)
  const hasDraft = Boolean(props.draft)

  return {
    label: 'Generate Variants',
    icon: SparklesIcon,
    disabled: !hasPublished && !hasDraft,
    onHandle,
    dialog:
      progress !== null
        ? {
            type: 'dialog' as const,
            header: 'Generate Variants',
            content: (
              <Box padding={4}>
                <Stack space={4}>
                  {isRunning && (
                    <Flex align="center" gap={3}>
                      <Spinner muted />
                      <Text size={2} muted>
                        {progress}
                      </Text>
                    </Flex>
                  )}
                  {done && (
                    <Text size={2} style={{color: 'var(--card-positive-fg-color)'}}>
                      ✓ {progress}
                    </Text>
                  )}
                  {error && (
                    <Text size={2} style={{color: 'var(--card-critical-fg-color)'}}>
                      Error: {error}
                    </Text>
                  )}
                </Stack>
              </Box>
            ),
            onClose: () => {
              setProgress(null)
              setDone(false)
              setError(null)
            },
          }
        : null,
  }
}
