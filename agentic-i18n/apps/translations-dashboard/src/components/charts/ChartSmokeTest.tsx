'use client'

import {Bar, BarChart, XAxis, YAxis} from 'recharts'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '#components/ui/chart'

/**
 * Smoke test component to verify shadcn/ui charts + Recharts integration.
 * Remove this file once real chart components are built.
 */

const SMOKE_TEST_DATA = [
  {draft: 3, locale: 'es-MX', missing: 5, published: 12},
  {draft: 5, locale: 'fr-FR', missing: 7, published: 8},
  {draft: 2, locale: 'fr-CA', missing: 8, published: 10},
  {draft: 4, locale: 'de-DE', missing: 10, published: 6},
  {draft: 2, locale: 'ja-JP', missing: 15, published: 3},
]

const chartConfig = {
  draft: {
    color: 'var(--chart-2)',
    label: 'Draft',
  },
  missing: {
    color: 'var(--chart-3)',
    label: 'Missing',
  },
  published: {
    color: 'var(--chart-1)',
    label: 'Published',
  },
} satisfies ChartConfig

export function ChartSmokeTest() {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-4 text-sm font-medium">📊 Chart Integration Smoke Test</h3>
      <ChartContainer className="h-[200px] w-full" config={chartConfig}>
        <BarChart accessibilityLayer data={SMOKE_TEST_DATA}>
          <XAxis axisLine={false} dataKey="locale" tickLine={false} />
          <YAxis axisLine={false} tickLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="published"
            fill="var(--color-published)"
            radius={[4, 4, 0, 0]}
            stackId="a"
          />
          <Bar dataKey="draft" fill="var(--color-draft)" radius={[0, 0, 0, 0]} stackId="a" />
          <Bar dataKey="missing" fill="var(--color-missing)" radius={[4, 4, 0, 0]} stackId="a" />
        </BarChart>
      </ChartContainer>
      <p className="mt-2 text-xs text-muted-foreground">
        If you see a stacked bar chart above, the integration works. Delete this component.
      </p>
    </div>
  )
}
