/**
 * Dashboard route — the "see" mode.
 *
 * Shows the translation overview: summary bar, status cards, coverage heatmap
 * (full width), stale documents section, and recent activity.
 *
 * StatusCards — 4 clickable cards (Missing, Needs Review, Stale, Approved)
 * that navigate to /translations?status=X.
 *
 * RecentActivity — "All Activity" / "Your Activity" tab bar using
 * useCurrentUser() for userId filtering. Per-section Suspense boundaries
 * provide error isolation and future query-splitting readiness.
 *
 * Heatmap cell click navigates to /translations with filters in URL params.
 */

import {useCurrentUser} from '@sanity/sdk-react'
import {Flex, Heading, Stack, Text} from '@sanity/ui'
import {Suspense, useCallback, useRef} from 'react'
import {useNavigate} from 'react-router-dom'

import ChartSection from '../components/charts/ChartSection'
import CoverageHeatmap from '../components/charts/CoverageHeatmap'
import SummaryBar from '../components/charts/SummaryBar'
import ErrorBoundary from '../components/ErrorBoundary'
// TODO: Re-enable Recent Activity section when live data is ready
// import RecentActivity from '../components/RecentActivity'
import StaleBanner from '../components/StaleBanner'
import StaleDocumentsSection from '../components/StaleDocumentsSection'
import StatusCards from '../components/StatusCards'
import {useCoverageMatrix} from '../hooks/useCoverageMatrix'
// import {useRecentChanges} from '../hooks/useRecentChanges'
import {useStaleDocuments} from '../hooks/useStaleDocuments'
import {useStatusBreakdown} from '../hooks/useStatusBreakdown'
import {useTranslationAggregateData} from '../hooks/useTranslationAggregateData'
import {useTranslationSummary} from '../hooks/useTranslationSummary'

// --- Welcome Header ---

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

// --- Skeleton fallbacks for Suspense boundaries ---

function SectionSkeleton({height = 120}: {height?: number}) {
  return <div className="skeleton w-full rounded-lg" style={{height}} />
}

function DashboardRoute() {
  const navigate = useNavigate()
  const currentUser = useCurrentUser()
  const {data: aggregateData} = useTranslationAggregateData()

  // Derived data for each section — all from the same aggregate fetch
  const summaryData = useTranslationSummary(aggregateData, null, null)
  const statusBreakdownData = useStatusBreakdown(aggregateData, null, null)
  const coverageMatrix = useCoverageMatrix(aggregateData)
  // const allChanges = useRecentChanges(aggregateData)
  // const userChanges = useRecentChanges(aggregateData, 20, currentUser?.id ?? null)
  const staleResult = useStaleDocuments(aggregateData)
  const staleSectionRef = useRef<HTMLDivElement>(null)

  const staleCount = staleResult.totalCount

  // Scroll to stale section when "View →" is clicked in the banner
  const handleViewStale = useCallback(() => {
    staleSectionRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})
  }, [])

  // Heatmap cell click → navigate to translations route with filters
  const handleHeatmapCellClick = useCallback(
    (documentType: string, locale: string) => {
      const params = new URLSearchParams({locale, type: documentType})
      navigate(`/translations?${params.toString()}`)
    },
    [navigate],
  )

  return (
    <Stack className="h-full overflow-y-auto" space={3}>
      <Heading align="center" size={3} weight="regular">
        Sanity Translations Dashboard
      </Heading>
      <div className="dashboard-content">
        {/* Welcome header — subtle greeting with avatar */}
        {currentUser?.name && (
          <div className="px-4 pt-4 pb-0 flex justify-center">
            <WelcomeHeader name={currentUser.name} profileImage={currentUser.profileImage} />
          </div>
        )}

        {/* Stale Banner — contextual alert on load when new stale docs exist */}
        <div className="px-4 pt-4 pb-0">
          <StaleBanner onViewStale={handleViewStale} staleCount={staleCount} />
        </div>

        {/* Summary Bar — two hero metrics (Launch Readiness + Translated) */}
        <div className="px-4 pt-4 pb-2">
          <Suspense fallback={<SectionSkeleton height={100} />}>
            <ChartSection featureName="Summary Bar" isLoaded={true}>
              <SummaryBar data={summaryData} selectedLocale={null} selectedLocaleName={null} />
            </ChartSection>
          </Suspense>
        </div>

        {/* Status Cards — clickable navigation to /translations?status=X */}
        <div className="px-4 pb-2">
          <Suspense fallback={<SectionSkeleton height={80} />}>
            <ErrorBoundary featureName="Status Cards">
              <StatusCards data={statusBreakdownData} />
            </ErrorBoundary>
          </Suspense>
        </div>

        {/* Coverage Heatmap — full width */}
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

        {/* Stale Documents — hidden when empty */}
        <div className="px-4 pb-2" ref={staleSectionRef}>
          <Suspense fallback={<SectionSkeleton height={80} />}>
            <ErrorBoundary featureName="Stale Documents">
              <StaleDocumentsSection state={staleResult} totalStaleCount={staleCount} />
            </ErrorBoundary>
          </Suspense>
        </div>

        {/* TODO: Recent Activity — coming soon. Uncomment when live data is ready.
        <div className="px-4 pb-4">
          <Suspense fallback={<SectionSkeleton height={160} />}>
            <ErrorBoundary featureName="Recent Activity">
              <RecentActivity
                allData={allChanges}
                currentUserId={currentUser?.id ?? null}
                currentUserName={currentUser?.name}
                currentUserProfileImage={currentUser?.profileImage}
                userData={userChanges}
              />
            </ErrorBoundary>
          </Suspense>
        </div>
        */}
      </div>
    </Stack>
  )
}

export default DashboardRoute
