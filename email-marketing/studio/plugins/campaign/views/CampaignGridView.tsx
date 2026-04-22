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
  *[_type == "promotion" && campaign._ref == $id] | order(_createdAt asc) {
    _id,
    subjectLine,
    preheader,
    disruptor,
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

const TIER_LABEL: Record<string, string> = {
  low: 'Low engagement',
  mid: 'Mid engagement',
  high: 'High engagement',
  vip: 'VIP',
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
      <Grid columns={[1, 1, 2]} gap={4}>
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
  const tierLabel = p.segment?.engagementTier
    ? (TIER_LABEL[p.segment.engagementTier] ?? p.segment.engagementTier)
    : null

  return (
    <Card border radius={3} padding={4} tone="default">
      <Stack space={4}>
        {/* Header: segment name + status */}
        <Flex align="center" justify="space-between" gap={2}>
          <Text size={1} weight="bold">
            {p.segment?.name ?? 'Unassigned'}
          </Text>
          <Badge tone={statusTone} fontSize={0} padding={2} radius={2}>
            {status.replace('-', ' ')}
          </Badge>
        </Flex>

        {/* Tier badge */}
        {tierLabel && (
          <Text size={0} muted>
            {tierLabel}
          </Text>
        )}

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

        {/* Footer: slot count + open link */}
        <Flex align="center" justify="space-between" gap={2}>
          <Text size={0} muted>
            {p.slotCount ?? 0} slot{p.slotCount !== 1 ? 's' : ''}
          </Text>
          <IntentLink
            intent="edit"
            params={{id: p._id, type: 'promotion'}}
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--card-link-color, inherit)',
              textDecoration: 'none',
            }}
          >
            Edit promotion →
          </IntentLink>
        </Flex>
      </Stack>
    </Card>
  )
}
