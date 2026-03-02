import {Box, Card, Flex, Grid, Heading, Spinner, Stack, Text} from '@sanity/ui'
import {useEffect, useState} from 'react'
import {useClient} from 'sanity'

import {ViewLayout} from './ViewLayout'

interface Stats {
  total: number
  avgSuccess: number | null
  avgAgentConfusion: number | null
  avgUserConfusion: number | null
  contentGapRate: number | null
}

const QUERY = `{
  "total": count(*[_type == "agent.conversation"]),
  "avgSuccess": round(math::avg(*[_type == "agent.conversation"].classification.successRate)),
  "avgAgentConfusion": round(math::avg(*[_type == "agent.conversation"].classification.agentConfusion)),
  "avgUserConfusion": round(math::avg(*[_type == "agent.conversation"].classification.userConfusion)),
  "contentGapRate": round(count(*[_type == "agent.conversation" && defined(contentGap)]) / count(*[_type == "agent.conversation"]) * 100)
}`

interface StatCardProps {
  label: string
  value: string | number
  muted?: boolean
}

function StatCard(props: StatCardProps) {
  const {label, value, muted} = props

  return (
    <Card padding={4} radius={2} tone="transparent">
      <Stack space={3}>
        <Text size={1} muted>
          {label}
        </Text>

        <Heading size={2} muted={muted}>
          {value}
        </Heading>
      </Stack>
    </Card>
  )
}

export function OverviewView() {
  const client = useClient({apiVersion: '2026-01-01'})
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.fetch<Stats>(QUERY).then((data) => {
      setStats(data)
      setLoading(false)
    })
  }, [client])

  if (loading) {
    return (
      <ViewLayout title="Overview" description="Summary of agent conversations and performance">
        <Flex align="center" justify="center" padding={5}>
          <Spinner muted />
        </Flex>
      </ViewLayout>
    )
  }

  return (
    <ViewLayout title="Overview" description="Summary of agent conversations and performance">
      <Box>
        <Stack space={4}>
          <Grid columns={[1, 1, 1, 3, 5]} gap={4}>
            <StatCard label="Total Conversations" value={stats?.total ?? 0} />

            <StatCard
              label="Avg Success Rate"
              value={`${stats?.avgSuccess ?? 0}%`}
              muted={!stats?.avgSuccess}
            />

            <StatCard
              label="Avg Agent Confusion"
              value={`${stats?.avgAgentConfusion ?? 0}%`}
              muted={!stats?.avgAgentConfusion}
            />

            <StatCard
              label="Avg User Confusion"
              value={`${stats?.avgUserConfusion ?? 0}%`}
              muted={!stats?.avgUserConfusion}
            />

            <StatCard
              label="Content Gap Rate"
              value={`${stats?.contentGapRate ?? 0}%`}
              muted={!stats?.contentGapRate}
            />
          </Grid>
        </Stack>
      </Box>
    </ViewLayout>
  )
}
