import {useCallback, useEffect, useState} from 'react'
import {Badge, Box, Button, Card, Dialog, Flex, Grid, Spinner, Stack, Text} from '@sanity/ui'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient, useWorkspace, useWorkspaceSchemaId} from 'sanity'
import {defineQuery} from 'groq'
import {IntentLink} from 'sanity/router'
import {FilterIcon, LaunchIcon, SparklesIcon, TrashIcon, UsersIcon} from '@sanity/icons'
import {
  buildInstruction,
  fetchBrandVoice,
  fetchCampaignContext,
  fetchSegmentContext,
} from '../hooks/useAgentContext'

const previewUrl = process.env.SANITY_STUDIO_PREVIEW_URL ?? 'http://localhost:3000'

type ViewProps = {
  document: {
    displayed: {_id?: string; [key: string]: unknown} | null
  }
}

const PROMOTIONS_QUERY = defineQuery(`
  *[_type == "promotion" && campaign._ref == $id] | order(_createdAt asc) {
    _id,
    subjectLine,
    preheader,
    disruptor,
    "segment": segment->{name, engagementTier, type},
    "campaignRef": campaign._ref,
    "segmentRef": segment._ref,
    "workflowStatus": *[_type == "workflow.state" && promotionId._ref == ^._id][0].status,
    "blockCount": count(emailSlots),
  }
`)

type Promotion = {
  _id: string
  subjectLine: string | null
  preheader: string | null
  disruptor: string | null
  segment: {name: string | null; engagementTier: string | null; type: string | null} | null
  campaignRef: string | null
  segmentRef: string | null
  workflowStatus: string | null
  blockCount: number | null
}

const STATUS_TONE: Record<string, 'primary' | 'positive' | 'caution' | 'critical'> = {
  draft: 'primary',
  'in-review': 'caution',
  approved: 'positive',
  sent: 'positive',
  rejected: 'critical',
  error: 'critical',
}

const TIER_LABEL: Record<string, string> = {
  low: 'Low engagement',
  mid: 'Mid engagement',
  high: 'High engagement',
  vip: 'VIP',
}

export function CampaignGridView({document}: ViewProps) {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const agentClient = useClient({apiVersion: 'X'})
  const schemaId = useWorkspaceSchemaId()
  useWorkspace()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)

  const campaignId = document.displayed?._id as string | undefined
  const cleanCampaignId = campaignId?.replace(/^drafts\./, '')

  const fetchPromotions = useCallback(() => {
    if (!cleanCampaignId) return
    client
      .fetch<Promotion[]>(
        PROMOTIONS_QUERY,
        {id: cleanCampaignId},
        {perspective: 'previewDrafts', tag: 'campaign.grid.list'},
      )
      .then((results) => {
        setPromotions(results ?? [])
        setLoading(false)
      })
  }, [client, cleanCampaignId])

  useEffect(() => {
    fetchPromotions()
  }, [fetchPromotions])

  if (loading) {
    return (
      <Flex align="center" justify="center" padding={6}>
        <Spinner muted />
      </Flex>
    )
  }

  if (promotions.length === 0) {
    return (
      <Box padding={6}>
        <Stack space={3}>
          <Text size={2} weight="semibold">
            No promotions yet
          </Text>
          <Text size={1} muted>
            Use <strong>Generate Promotions</strong> to create segment promotions from this campaign
            brief.
          </Text>
        </Stack>
      </Box>
    )
  }

  return (
    <Box padding={4} overflow="auto">
      <Grid columns={1} gap={4}>
        {promotions.map((p) => (
          <PromotionTile
            key={p._id}
            promotion={p}
            client={client}
            agentClient={agentClient}
            schemaId={schemaId}
            onRefresh={fetchPromotions}
          />
        ))}
      </Grid>
    </Box>
  )
}

type TileProps = {
  promotion: Promotion
  client: ReturnType<typeof useClient>
  agentClient: ReturnType<typeof useClient>
  schemaId: string
  onRefresh: () => void
}

function PromotionTile({promotion: p, client, agentClient, schemaId, onRefresh}: TileProps) {
  const status = p.workflowStatus ?? 'draft'
  const statusTone = STATUS_TONE[status] ?? 'primary'
  const tierLabel = p.segment?.engagementTier
    ? (TIER_LABEL[p.segment.engagementTier] ?? p.segment.engagementTier)
    : null

  const SegmentIcon = p.segment?.type === 'list' ? UsersIcon : FilterIcon

  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState<'delete' | 'regenerate' | null>(null)

  const handleDelete = useCallback(async () => {
    setBusy('delete')
    try {
      // Find any workflow.state docs referencing this promotion (id naming convention is not stable)
      const wfIds = await client.fetch<string[]>(
        `*[_type == "workflow.state" && promotionId._ref == $id]._id`,
        {id: p._id},
        {tag: 'campaign.grid.delete'},
      )
      for (const wfId of wfIds) {
        await client.delete(wfId, {tag: 'campaign.grid.delete'}).catch(() => {})
        await client.delete(`drafts.${wfId}`, {tag: 'campaign.grid.delete'}).catch(() => {})
      }
      await client.delete(`drafts.${p._id}`, {tag: 'campaign.grid.delete'}).catch(() => {})
      await client.delete(p._id, {tag: 'campaign.grid.delete'})
      setDialogOpen(false)
      onRefresh()
    } catch (err) {
      console.error('Failed to delete promotion:', err)
      setBusy(null)
    }
  }, [client, p._id, onRefresh])

  const handleRegenerate = useCallback(async () => {
    setBusy('regenerate')
    try {
      const campaignId = p.campaignRef
      const segmentId = p.segmentRef
      if (!campaignId || !segmentId) return

      // Delete existing promotion + any referencing workflow.state docs
      const wfIds = await client.fetch<string[]>(
        `*[_type == "workflow.state" && promotionId._ref == $id]._id`,
        {id: p._id},
        {tag: 'campaign.grid.regenerate'},
      )
      for (const wfId of wfIds) {
        await client.delete(wfId, {tag: 'campaign.grid.regenerate'}).catch(() => {})
        await client.delete(`drafts.${wfId}`, {tag: 'campaign.grid.regenerate'}).catch(() => {})
      }
      await client.delete(`drafts.${p._id}`, {tag: 'campaign.grid.regenerate'}).catch(() => {})
      await client.delete(p._id, {tag: 'campaign.grid.regenerate'})

      // Build instruction from context
      const [campaignBrief, brandVoice, segment] = await Promise.all([
        fetchCampaignContext(client, campaignId),
        fetchBrandVoice(client),
        fetchSegmentContext(client, segmentId),
      ])
      const {instruction, instructionParams} = buildInstruction(campaignBrief, brandVoice, segment)
      const promotionId = `promotion-${campaignId}-${segmentId}`

      // Generate via AI agent
      await agentClient.agent.action.generate({
        targetDocument: {
          operation: 'createOrReplace',
          _id: promotionId,
          _type: 'promotion',
          initialValues: {
            campaign: {_type: 'reference', _ref: campaignId},
            segment: {_type: 'reference', _ref: segmentId},
          },
        },
        schemaId,
        instruction,
        instructionParams,
        target: [
          {path: 'subjectLine'},
          {path: 'preheader'},
          {path: 'disruptor'},
          {path: 'emailSlots'},
        ],
      })

      // Publish the generated draft
      await client.action(
        {
          actionType: 'sanity.action.document.publish',
          draftId: `drafts.${promotionId}`,
          publishedId: promotionId,
        },
        {tag: 'campaign.grid.regenerate'},
      )

      // Create workflow state
      await client.createOrReplace(
        {
          _id: `wf-${promotionId}`,
          _type: 'workflow.state',
          promotionId: {_type: 'reference', _ref: promotionId},
          status: 'draft',
          history: [
            {
              _key: `h-${Date.now()}`,
              _type: 'object',
              status: 'draft',
              timestamp: new Date().toISOString(),
            },
          ],
        },
        {tag: 'campaign.grid.regenerate'},
      )

      setDialogOpen(false)
      onRefresh()
    } catch (err) {
      console.error('Failed to regenerate promotion:', err)
      setBusy(null)
    }
  }, [client, agentClient, schemaId, p._id, p.campaignRef, p.segmentRef, onRefresh])

  return (
    <Card border radius={3} padding={4} tone="default">
      <Stack space={4}>
        {/* Header: icon + segment name + tier badge + status badge */}
        <Flex align="center" justify="space-between" gap={2}>
          <Flex align="center" gap={2} style={{minWidth: 0}}>
            <Text size={1}>
              <SegmentIcon />
            </Text>
            <Text size={1} weight="bold" textOverflow="ellipsis">
              {p.segment?.name ?? 'Unassigned'}
            </Text>
          </Flex>
          <Flex align="center" gap={2} style={{flexShrink: 0}}>
            {tierLabel && (
              <Badge tone="default" fontSize={0} padding={2} radius={2}>
                {tierLabel}
              </Badge>
            )}
            <Badge tone={statusTone} fontSize={0} padding={2} radius={2}>
              {status.replace('-', ' ')}
            </Badge>
          </Flex>
        </Flex>

        {/* Email preview */}
        <Card border radius={2} padding={3} tone="transparent">
          <Stack space={3}>
            {p.disruptor && (
              <Text
                size={0}
                weight="bold"
                style={{textTransform: 'uppercase', letterSpacing: '0.1em'}}
              >
                {p.disruptor}
              </Text>
            )}
            {p.subjectLine ? (
              <Text size={2} weight="semibold">
                {p.subjectLine}
              </Text>
            ) : (
              <Text size={2} muted style={{fontStyle: 'italic'}}>
                No subject line
              </Text>
            )}
            {p.preheader && (
              <Text size={1} muted>
                {p.preheader}
              </Text>
            )}
          </Stack>
        </Card>

        {/* Footer: block count + action buttons */}
        <Flex align="center" justify="space-between" gap={2}>
          <Text size={0} muted>
            {p.blockCount ?? 0} block{p.blockCount !== 1 ? 's' : ''}
          </Text>
          <Flex align="center" gap={2}>
            <Button
              as="a"
              href={`${previewUrl}/api/preview/klaviyo/${p._id}`}
              target="_blank"
              rel="noopener noreferrer"
              icon={LaunchIcon}
              text="Open preview"
              mode="ghost"
              fontSize={0}
              padding={2}
            />
            <IntentLink
              intent="edit"
              params={{id: p._id, type: 'promotion'}}
              style={{textDecoration: 'none'}}
            >
              <Button
                as="span"
                text="Edit promotion"
                tone="primary"
                mode="default"
                fontSize={0}
                padding={2}
              />
            </IntentLink>
            <Button
              icon={TrashIcon}
              mode="bleed"
              tone="critical"
              fontSize={0}
              padding={2}
              onClick={() => setDialogOpen(true)}
            />
          </Flex>
        </Flex>
      </Stack>

      {/* Delete / Regenerate dialog */}
      {dialogOpen && (
        <Dialog
          header="Manage promotion"
          id={`manage-dialog-${p._id}`}
          onClose={() => {
            if (!busy) setDialogOpen(false)
          }}
          width={1}
        >
          <Box padding={4}>
            <Stack space={4}>
              <Text size={1} muted>
                Choose an action for the <strong>{p.segment?.name}</strong> promotion.
              </Text>
              {busy && (
                <Flex align="center" gap={3}>
                  <Spinner muted />
                  <Text size={1} muted>
                    {busy === 'delete' ? 'Deleting promotion…' : 'Regenerating promotion…'}
                  </Text>
                </Flex>
              )}
              <Flex gap={3}>
                <Button
                  icon={TrashIcon}
                  text={busy === 'delete' ? 'Deleting…' : 'Delete'}
                  tone="critical"
                  mode="ghost"
                  onClick={handleDelete}
                  disabled={busy !== null}
                />
                <Button
                  icon={SparklesIcon}
                  text={busy === 'regenerate' ? 'Regenerating…' : 'Regenerate'}
                  tone="caution"
                  mode="ghost"
                  onClick={handleRegenerate}
                  disabled={busy !== null}
                />
              </Flex>
            </Stack>
          </Box>
        </Dialog>
      )}
    </Card>
  )
}
