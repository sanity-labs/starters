import {ChartUpwardIcon, WarningOutlineIcon} from '@sanity/icons'
import {Badge, Box, Card, Container, Flex, Grid, Heading, Spinner, Stack, Text} from '@sanity/ui'
import {useEffect, useState} from 'react'
import {useClient} from 'sanity'

const CONTENT_TYPES = ['helpArticle', 'faq', 'playbook', 'policy']

const HEALTH_QUERY = `{
  "byType": {
    "helpArticle": count(*[_type == "helpArticle"]),
    "faq": count(*[_type == "faq"]),
    "playbook": count(*[_type == "playbook"]),
    "policy": count(*[_type == "policy"])
  },
  "overdue": count(*[_type in $types && defined(reviewByDate) && reviewByDate < now()]),
  "fresh": count(*[_type in $types && defined(reviewByDate) && reviewByDate >= now()]),
  "missing": count(*[_type in $types && !defined(reviewByDate)]),
  "overdueItems": *[_type in $types && defined(reviewByDate) && reviewByDate < now()]
    | order(reviewByDate asc)[0...12]{
      _id, _type, reviewByDate, "title": coalesce(title, question)
    }
}`

interface HealthData {
  byType: Record<string, number>
  overdue: number
  fresh: number
  missing: number
  overdueItems: {_id: string; _type: string; title: string; reviewByDate: string}[]
}

function MetricCard(props: {
  label: string
  value: number
  tone?: 'critical' | 'positive' | 'caution' | 'default'
}) {
  return (
    <Card padding={4} radius={3} shadow={1} tone={props.tone ?? 'default'}>
      <Stack space={3}>
        <Text size={1} muted>
          {props.label}
        </Text>
        <Heading size={4}>{props.value}</Heading>
      </Stack>
    </Card>
  )
}

export function ContentHealthDashboard() {
  const client = useClient({apiVersion: '2025-03-01'})
  const [data, setData] = useState<HealthData | null>(null)

  useEffect(() => {
    let active = true
    client
      .fetch<HealthData>(HEALTH_QUERY, {types: CONTENT_TYPES})
      .then((result) => active && setData(result))
    return () => {
      active = false
    }
  }, [client])

  if (!data) {
    return (
      <Flex align="center" justify="center" padding={6}>
        <Spinner muted />
      </Flex>
    )
  }

  const total = Object.values(data.byType).reduce((sum, n) => sum + n, 0)

  return (
    <Container width={3}>
      <Box padding={4}>
        <Stack space={5}>
          <Stack space={2}>
            <Heading size={3}>Content Health</Heading>
            <Text muted size={1}>
              Governance status across the knowledge base. Overdue content is surfaced before it
              reaches agents.
            </Text>
          </Stack>

          <Grid columns={[2, 2, 4]} gap={3}>
            <MetricCard label="Total content" value={total} />
            <MetricCard
              label="Needs review"
              value={data.overdue}
              tone={data.overdue > 0 ? 'critical' : 'positive'}
            />
            <MetricCard label="Fresh" value={data.fresh} tone="positive" />
            <MetricCard
              label="No review date"
              value={data.missing}
              tone={data.missing > 0 ? 'caution' : 'default'}
            />
          </Grid>

          <Card padding={4} radius={3} shadow={1}>
            <Stack space={4}>
              <Heading size={1}>Content by type</Heading>
              <Grid columns={[2, 4]} gap={3}>
                {Object.entries(data.byType).map(([type, n]) => (
                  <Stack key={type} space={2}>
                    <Text size={3} weight="semibold">
                      {n}
                    </Text>
                    <Text size={1} muted>
                      {type}
                    </Text>
                  </Stack>
                ))}
              </Grid>
            </Stack>
          </Card>

          <Card
            padding={4}
            radius={3}
            shadow={1}
            tone={data.overdueItems.length ? 'critical' : 'positive'}
          >
            <Stack space={4}>
              <Flex align="center" gap={2}>
                <Text size={2}>
                  <WarningOutlineIcon />
                </Text>
                <Heading size={1}>Action required</Heading>
              </Flex>
              {data.overdueItems.length === 0 ? (
                <Text size={1} muted>
                  Nothing overdue. The knowledge base is current.
                </Text>
              ) : (
                <Stack space={3}>
                  {data.overdueItems.map((item) => (
                    <Flex key={item._id} align="center" justify="space-between" gap={3}>
                      <Text size={1}>{item.title}</Text>
                      <Flex align="center" gap={2}>
                        <Badge tone="default" fontSize={0}>
                          {item._type}
                        </Badge>
                        <Text size={0} muted>
                          due {new Date(item.reviewByDate).toLocaleDateString()}
                        </Text>
                      </Flex>
                    </Flex>
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>
        </Stack>
      </Box>
    </Container>
  )
}

ContentHealthDashboard.icon = ChartUpwardIcon
