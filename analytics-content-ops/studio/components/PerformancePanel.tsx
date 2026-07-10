import {useEffect, useId, useMemo, useState} from 'react'
import {Badge, Box, Card, Flex, Inline, Label, Spinner, Stack, Text} from '@sanity/ui'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, useClient} from 'sanity'
import {defineQuery} from 'groq'
import {
  TIER_LABELS,
  editorialCue,
  type LifecycleState,
  type PerformanceTier,
  type TopReferrer,
  type TrendDirection,
} from '../lib/performance'

const PERFORMANCE_QUERY = defineQuery(`*[_type == "articlePerformance" && article._ref == $id][0]{
  performanceTier,
  trendDirection,
  lifecycleState,
  topReferrer,
  catalogPercentile,
  sessions30d,
  sessionsVsCatalogAvgPct,
  dailySessions[]{date, sessions},
  syncedAt
}`)

type DailySession = {date?: string; sessions?: number}

type Performance = {
  performanceTier?: PerformanceTier
  trendDirection?: TrendDirection
  lifecycleState?: LifecycleState
  topReferrer?: TopReferrer
  catalogPercentile?: number
  sessions30d?: number
  sessionsVsCatalogAvgPct?: number
  dailySessions?: DailySession[]
  syncedAt?: string
} | null

const TIER_TONE: Record<PerformanceTier, 'positive' | 'caution' | 'critical' | 'primary'> = {
  trending: 'positive',
  stable: 'primary',
  stale: 'caution',
  new: 'primary',
}

const TREND_GLYPH: Record<TrendDirection, string> = {
  rising: '↑ Rising',
  flat: '→ Flat',
  falling: '↓ Falling',
}

function formatSessions(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function formatShortDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'})
}

function formatAxisValue(n: number): string {
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`
  return String(Math.round(n))
}

function vsAverageCopy(pct?: number): {arrow: string; label: string; tone: 'positive' | 'caution' | 'default'} {
  if (typeof pct !== 'number' || pct === 0) {
    return {arrow: '→', label: 'in line with catalog average', tone: 'default'}
  }
  const abs = Math.abs(pct)
  if (pct > 0) {
    return {arrow: '↑', label: `${abs}% above average`, tone: 'positive'}
  }
  return {arrow: '↓', label: `${abs}% below average`, tone: 'caution'}
}

function Row({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <Flex align="center" justify="space-between" gap={3}>
      <Label size={1} muted>
        {label}
      </Label>
      <Box>{children}</Box>
    </Flex>
  )
}

function TrafficChart({series}: {series: DailySession[]}) {
  const gradientId = useId().replace(/:/g, '')
  const points = series.filter((d) => d.date && typeof d.sessions === 'number') as {
    date: string
    sessions: number
  }[]

  if (points.length < 2) {
    return (
      <Card padding={4} radius={2} tone="transparent" border>
        <Text size={1} muted>
          Not enough daily data to chart yet.
        </Text>
      </Card>
    )
  }

  const width = 560
  const height = 220
  const pad = {top: 16, right: 12, bottom: 28, left: 40}
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const maxY = Math.max(...points.map((p) => p.sessions), 1)
  const niceMax = Math.ceil(maxY / 4) * 4 || 4
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => niceMax * t)

  const xAt = (i: number) => pad.left + (i / (points.length - 1)) * innerW
  const yAt = (v: number) => pad.top + innerH - (v / niceMax) * innerH

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.sessions).toFixed(1)}`)
    .join(' ')
  const areaPath = `${linePath} L ${xAt(points.length - 1).toFixed(1)} ${yAt(0).toFixed(1)} L ${xAt(0).toFixed(1)} ${yAt(0).toFixed(1)} Z`

  const xLabels = [
    {i: 0, label: formatShortDate(points[0].date)},
    {i: Math.floor((points.length - 1) / 2), label: formatShortDate(points[Math.floor((points.length - 1) / 2)].date)},
    {i: points.length - 1, label: formatShortDate(points[points.length - 1].date)},
  ]

  return (
    <Card padding={3} radius={2} border style={{overflow: 'hidden'}}>
      <Stack space={3}>
        <Flex align="baseline" justify="space-between">
          <Text size={1} weight="semibold">
            Sessions over time
          </Text>
          <Text size={1} muted>
            Last 30 days
          </Text>
        </Flex>
        <Box style={{width: '100%', overflowX: 'auto'}}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            role="img"
            aria-label="30-day sessions chart"
            style={{display: 'block', minWidth: 320}}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a73e8" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#1a73e8" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {gridYs.map((v) => (
              <g key={v}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={yAt(v)}
                  y2={yAt(v)}
                  stroke="var(--card-border-color)"
                  strokeWidth={1}
                />
                <text
                  x={pad.left - 8}
                  y={yAt(v) + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--card-muted-fg-color)"
                  fontFamily="system-ui, sans-serif"
                >
                  {formatAxisValue(v)}
                </text>
              </g>
            ))}

            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path
              d={linePath}
              fill="none"
              stroke="#1a73e8"
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* End-point marker, GA-style */}
            <circle
              cx={xAt(points.length - 1)}
              cy={yAt(points[points.length - 1].sessions)}
              r={3.5}
              fill="#1a73e8"
            />

            {xLabels.map(({i, label}) => (
              <text
                key={`${i}-${label}`}
                x={xAt(i)}
                y={height - 8}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                fontSize={10}
                fill="var(--card-muted-fg-color)"
                fontFamily="system-ui, sans-serif"
              >
                {label}
              </text>
            ))}
          </svg>
        </Box>
      </Stack>
    </Card>
  )
}

// Read-only Performance panel. Subscribes to the companion document so the tier
// updates live after a nightly sync — without ever mutating the article.
export function PerformancePanel(props: {documentId?: string; document?: {documentId?: string}}) {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const id = (props.documentId ?? props.document?.documentId ?? '').replace(/^drafts\./, '')
  const [data, setData] = useState<Performance>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = () =>
      client
        .fetch<Performance>(PERFORMANCE_QUERY, {id}, {tag: 'article.panel.performance'})
        .then((r) => {
          if (!cancelled) {
            setData(r)
            setLoading(false)
          }
        })
        .catch(() => !cancelled && setLoading(false))

    load()
    // Live-update when the sync writes a new companion document.
    const sub = client
      .listen(
        '*[_type == "articlePerformance" && article._ref == $id]',
        {id},
        {visibility: 'query'},
      )
      .subscribe(() => load())

    return () => {
      cancelled = true
      sub.unsubscribe()
    }
  }, [client, id])

  const cue = useMemo(
    () => editorialCue(data?.performanceTier, data?.lifecycleState),
    [data?.performanceTier, data?.lifecycleState],
  )

  const vsAvg = useMemo(() => vsAverageCopy(data?.sessionsVsCatalogAvgPct), [data?.sessionsVsCatalogAvgPct])

  if (loading) {
    return (
      <Flex align="center" justify="center" padding={5}>
        <Spinner muted />
      </Flex>
    )
  }

  if (!data) {
    return (
      <Box padding={4}>
        <Card padding={4} radius={2} tone="transparent" border>
          <Stack space={3}>
            <Text weight="semibold">No performance data yet</Text>
            <Text size={1} muted>
              This article has no <code>articlePerformance</code> companion document. Run the
              analytics sync (<code>pnpm analytics-sync</code>) to populate it. Analytics stay in
              your analytics platform — Sanity only stores derived, action-enabling signal.
            </Text>
          </Stack>
        </Card>
      </Box>
    )
  }

  return (
    <Box padding={4}>
      <Stack space={4}>
        <Card
          padding={4}
          radius={2}
          tone={data.performanceTier ? TIER_TONE[data.performanceTier] : 'transparent'}
          border
        >
          <Stack space={3}>
            <Inline space={2}>
              <Badge
                tone={data.performanceTier ? TIER_TONE[data.performanceTier] : 'default'}
                fontSize={1}
              >
                {data.performanceTier ? TIER_LABELS[data.performanceTier] : 'Unclassified'}
              </Badge>
              {data.trendDirection && (
                <Badge fontSize={1}>{TREND_GLYPH[data.trendDirection]}</Badge>
              )}
            </Inline>
            <Text size={1}>{cue}</Text>
          </Stack>
        </Card>

        {/* GA-style traffic hero */}
        <Card padding={4} radius={2} border>
          <Stack space={3}>
            <Label size={1} muted>
              30-day traffic
            </Label>
            <Flex align="baseline" gap={3} wrap="wrap">
              <Text size={4} weight="bold" style={{fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em'}}>
                {typeof data.sessions30d === 'number' ? formatSessions(data.sessions30d) : '—'}
              </Text>
              <Inline space={2}>
                <Text
                  size={1}
                  weight="semibold"
                  style={{
                    color:
                      vsAvg.tone === 'positive'
                        ? 'var(--card-badge-positive-fg-color)'
                        : vsAvg.tone === 'caution'
                          ? 'var(--card-badge-caution-fg-color)'
                          : undefined,
                  }}
                >
                  {vsAvg.arrow} {vsAvg.label}
                </Text>
              </Inline>
            </Flex>
            <Text size={1} muted>
              Compared to average-performing content across the catalog
            </Text>
          </Stack>
        </Card>

        <TrafficChart series={data.dailySessions ?? []} />

        <Card padding={4} radius={2} border>
          <Stack space={4}>
            <Row label="Lifecycle state">
              <Text size={1}>{data.lifecycleState?.replace('_', ' ') ?? '—'}</Text>
            </Row>
            <Row label="Top referrer">
              <Text size={1}>{data.topReferrer ?? '—'}</Text>
            </Row>
            <Row label="Catalog percentile">
              <Text size={1} weight="semibold">
                {typeof data.catalogPercentile === 'number'
                  ? `p${Math.round(data.catalogPercentile)}`
                  : '—'}
              </Text>
            </Row>
            <Row label="Last synced">
              <Text size={1}>
                {data.syncedAt ? new Date(data.syncedAt).toLocaleString() : 'never'}
              </Text>
            </Row>
          </Stack>
        </Card>

        <Text size={1} muted align="center">
          Synced display snapshot · analytics platform remains the system of record
        </Text>
      </Stack>
    </Box>
  )
}
