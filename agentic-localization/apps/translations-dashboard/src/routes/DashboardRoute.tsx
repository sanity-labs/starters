/**
 * Dashboard route — the "see" mode.
 */

import {useCurrentUser} from '@sanity/sdk-react'
import {Flex, Heading, Stack, Text} from '@sanity/ui'
import {Suspense, useCallback} from 'react'
import {useNavigate} from 'react-router-dom'

import ActiveRunsSection from '../components/ActiveRunsSection'
import ChartSection from '../components/charts/ChartSection'
import CoverageHeatmap from '../components/charts/CoverageHeatmap'
import SummaryBar from '../components/charts/SummaryBar'
import ErrorBoundary from '../components/ErrorBoundary'
import StaleDocumentsSection from '../components/StaleDocumentsSection'
import StatusCards from '../components/StatusCards'
import {useCoverageMatrix} from '../hooks/useCoverageMatrix'
import {useStaleDocuments} from '../hooks/useStaleDocuments'
import {useStatusBreakdown} from '../hooks/useStatusBreakdown'
import {useTranslationAggregateData} from '../hooks/useTranslationAggregateData'
import {useTranslationSummary} from '../hooks/useTranslationSummary'

/** Deterministic hash for avatar fallback color */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const AVATAR_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#2563eb',
]

function WelcomeHeader({name, profileImage}: {name: string; profileImage?: string}) {
  const firstName = name.split(' ')[0] || name
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const bgColor = AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length]

  return (
    <Flex align="center" gap={3}>
      {profileImage ? (
        <img alt="" className="size-10 shrink-0 rounded-full object-cover" src={profileImage} />
      ) : (
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{background: bgColor}}
        >
          {initials}
        </div>
      )}
      <Text align="center" size={2} weight="semibold">
        Welcome back, {firstName}
      </Text>
    </Flex>
  )
}

function SectionSkeleton({height = 120}: {height?: number}) {
  return <div className="skeleton w-full rounded-lg" style={{height}} />
}

function DashboardRoute() {
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const {data: aggregateData} = useTranslationAggregateData()

  const summaryData = useTranslationSummary(aggregateData, null, null)
  const statusBreakdownData = useStatusBreakdown(aggregateData, null, null)
  const coverageMatrix = useCoverageMatrix(aggregateData)
  const staleResult = useStaleDocuments(aggregateData)

  const handleHeatmapCellClick = useCallback(
    (documentType: string, locale: string) => {
      const params = new URLSearchParams({locale, type: documentType})
      navigate(`/translations?${params.toString()}`)
    },
    [navigate],
  )

  return (
    <Stack className="h-full overflow-y-auto" space={3}>
      <Heading align="center" as="h1" size={3} weight="regular">
        Sanity Translations Dashboard
      </Heading>
      <div className="dashboard-content">
        {currentUser?.name && (
          <div className="px-4 pt-4 pb-0 flex justify-center">
            <WelcomeHeader name={currentUser.name} profileImage={currentUser.profileImage} />
          </div>
        )}

        <div className="px-4 pt-4 pb-2">
          <Suspense fallback={<SectionSkeleton height={100} />}>
            <ChartSection featureName="Summary Bar" isLoaded={true}>
              <SummaryBar data={summaryData} selectedLocale={null} selectedLocaleName={null} />
            </ChartSection>
          </Suspense>
        </div>

        <div className="px-4 pb-2">
          <Suspense fallback={<SectionSkeleton height={80} />}>
            <ErrorBoundary featureName="Status Cards">
              <StatusCards data={statusBreakdownData} />
            </ErrorBoundary>
          </Suspense>
        </div>

        <div className="px-4 pb-2">
          <Suspense fallback={<SectionSkeleton height={200} />}>
            <ChartSection featureName="Coverage Heatmap" isLoaded={true}>
              <CoverageHeatmap
                data={coverageMatrix.data}
                localeColumns={coverageMatrix.localeColumns}
                onCellClick={handleHeatmapCellClick}
              />
            </ChartSection>
          </Suspense>
        </div>

        <div className="px-4 pb-2">
          <Suspense fallback={<SectionSkeleton height={80} />}>
            <ErrorBoundary featureName="Active Runs">
              <ActiveRunsSection />
            </ErrorBoundary>
          </Suspense>
        </div>

        <div className="px-4 pb-4">
          <Suspense fallback={<SectionSkeleton height={80} />}>
            <ErrorBoundary featureName="Source Changed">
              <StaleDocumentsSection state={staleResult} totalStaleCount={staleResult.totalCount} />
            </ErrorBoundary>
          </Suspense>
        </div>
      </div>
    </Stack>
  )
}

export default DashboardRoute
