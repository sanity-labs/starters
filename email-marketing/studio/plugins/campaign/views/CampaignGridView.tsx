import {useEffect, useState} from 'react'
import {Badge, Box, Card, Flex, Grid, Spinner, Stack, Text} from '@sanity/ui'
import {useClient, useWorkspace} from 'sanity'
import {defineQuery} from 'groq'
import {IntentLink} from 'sanity/router'

type ViewProps = {
  document: {
    displayed: {_id?: string; [key: string]: unknown} | null
  }
}

const PROMOTIONS_QUERY = defineQuery(`
  *[_type == "promotion" && campaign._ref == $id] | order(isBasePromotion desc, _createdAt asc) {
    _id,
    subjectLine,
    preheader,
    disruptor,
    isBasePromotion,
    "segment": segment->{name, engagementTier},
    "workflowStatus": *[_type == "workflow.state" && promotionId._ref == ^._id][0].status,
    "slotCount": count(emailSlots),
  }
`)

type Promotion = {
  _id: string
  subjectLine: string | null
  preheader: string | null
  disruptor: string | null
  isBasePromotion: boolean | null
  segment: {name: string | null; engagementTier: string | null} | null
  workflowStatus: string | null
  slotCount: number | null
}

const STATUS_TONE: Record<string, 'primary' | 'positive' | 'caution' | 'critical'> = {
  draft: 'primary',
  'in-review': 'caution',
  approved: 'positive',
  sent: 'positive',
  rejected: 'critical',
}

const TIER_TONE: Record<string, 'primary' | 'positive' | 'caution' | 'critical'> = {
  low: 'primary',
  mid: 'caution',
  high: 'positive',
  vip: 'positive',
}

export function CampaignGridView({document}: ViewProps) {
  const client = useClient({apiVersion: '2026-04-08'})
  useWorkspace()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)

  const campaignId = document.displayed?._id as string | undefined

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false

    const id = campaignId.replace(/^drafts\./, '')
    client.fetch<Promotion[]>(PROMOTIONS_QUERY, {id}).then((results) => {
      if (!cancelled) {
        setPromotions(results ?? [])
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [client, campaignId])

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
            No variants yet
          </Text>
          <Text size={1} muted>
            Use <strong>Generate Variants</strong> to create segment-variant promotions from this
            campaign brief.
          </Text>
        </Stack>
      </Box>
    )
  }

  return (
    <Box padding={4} overflow="auto">
      <Grid columns={[1, 1, 2, 3]} gap={3}>
        {promotions.map((p) => (
          <PromotionTile key={p._id} promotion={p} />
        ))}
      </Grid>
    </Box>
  )
}

function PromotionTile({promotion: p}: {promotion: Promotion}) {
  const status = p.workflowStatus ?? 'draft'
  const statusTone = STATUS_TONE[status] ?? 'primary'

  return (
    <Card border radius={2} padding={3} tone="default">
      <Stack space={3}>
        <Flex align="center" justify="space-between" gap={2}>
          <Text size={0} weight="semibold" muted>
            {p.isBasePromotion ? 'Base' : (p.segment?.name ?? 'Unassigned')}
          </Text>
          <Badge tone={statusTone} fontSize={0} padding={2} radius={2}>
            {status.replace('-', ' ')}
          </Badge>
        </Flex>

        {p.segment?.engagementTier && !p.isBasePromotion && (
          <Badge
            tone={TIER_TONE[p.segment.engagementTier] ?? 'primary'}
            fontSize={0}
            padding={1}
            radius={1}
          >
            {p.segment.engagementTier}
          </Badge>
        )}

        {p.disruptor && (
          <Text size={0} muted style={{textTransform: 'uppercase', letterSpacing: '0.08em'}}>
            {p.disruptor}
          </Text>
        )}

        {p.subjectLine ? (
          <Text size={1} weight="semibold">
            {p.subjectLine}
          </Text>
        ) : (
          <Text size={1} muted style={{fontStyle: 'italic'}}>
            No subject line
          </Text>
        )}

        {p.preheader && (
          <Text
            size={1}
            muted
            style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
          >
            {p.preheader}
          </Text>
        )}

        <Flex align="center" justify="space-between" gap={2} paddingTop={1}>
          <Text size={0} muted>
            {p.slotCount ?? 0} slot{p.slotCount !== 1 ? 's' : ''}
          </Text>
          <IntentLink
            intent="edit"
            params={{id: p._id, type: 'promotion'}}
            style={{fontSize: '12px', color: 'var(--card-link-color, inherit)'}}
          >
            Open →
          </IntentLink>
        </Flex>
      </Stack>
    </Card>
  )
}
