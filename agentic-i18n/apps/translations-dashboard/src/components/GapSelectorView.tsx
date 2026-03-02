/**
 * Gap selector view — "Choose a gap to close."
 *
 * Shown when the user navigates to /translations without filter params.
 * Displays the top gaps from the coverage matrix as quick-link cards,
 * guiding the user to pick a specific gap to close.
 *
 * The Translations route is always purposeful — no browse mode.
 */

import {Card, Flex, Heading, Stack, Text} from '@sanity/ui'
import {useCallback, useMemo} from 'react'
import {useNavigate} from 'react-router-dom'

import type {CoverageMatrixResult} from '../hooks/useCoverageMatrix'

// --- Types ---

type GapEntry = {
  docType: string
  docTypeLabel: string
  /** Total gap count: missing + usingFallback + stale */
  gapCount: number
  locale: string
  localeFlag: string
  localeName: string
  /** Breakdown for display */
  missing: number
  stale: number
  usingFallback: number
}

interface GapSelectorViewProps {
  /** Coverage matrix data for identifying top gaps */
  coverageMatrix: CoverageMatrixResult
  /** Locale info for display */
  localeInfo: Array<{flag: string; name: string; tag: string}>
}

// --- Component ---

function GapSelectorView({coverageMatrix, localeInfo}: GapSelectorViewProps) {
  const navigate = useNavigate()

  // Build locale lookup
  const localeLookup = useMemo(() => {
    const map = new Map<string, {flag: string; name: string}>()
    for (const loc of localeInfo) {
      map.set(loc.tag, {flag: loc.flag, name: loc.name})
    }
    return map
  }, [localeInfo])

  // Find top gaps sorted by missing count (descending)
  const topGaps = useMemo((): GapEntry[] => {
    if (!coverageMatrix.data) return []

    const gaps: GapEntry[] = []

    for (const row of coverageMatrix.data) {
      for (const [localeTag, cell] of Object.entries(row.locales)) {
        const gapCount = cell.missing + cell.usingFallback + cell.stale
        if (gapCount > 0) {
          const loc = localeLookup.get(localeTag)
          gaps.push({
            docType: row.documentType,
            docTypeLabel: row.documentTypeLabel,
            gapCount,
            locale: localeTag,
            localeFlag: loc?.flag ?? '',
            localeName: loc?.name ?? localeTag,
            missing: cell.missing,
            stale: cell.stale,
            usingFallback: cell.usingFallback,
          })
        }
      }
    }

    // Sort by gap count descending (biggest gaps first)
    gaps.sort((a, b) => b.gapCount - a.gapCount)

    // Return top 8 gaps
    return gaps.slice(0, 8)
  }, [coverageMatrix.data, localeLookup])

  const handleGapClick = useCallback(
    (docType: string, locale: string) => {
      const params = new URLSearchParams({locale, type: docType})
      navigate(`/translations?${params.toString()}`)
    },
    [navigate],
  )

  if (topGaps.length === 0) {
    return (
      <Card padding={5} radius={2} tone="positive">
        <Stack className="text-center" space={3}>
          <Text size={3}>✓</Text>
          <Heading size={3}>All translations complete</Heading>
          <Text muted size={1}>
            No gaps to close — every document type has full locale coverage.
          </Text>
        </Stack>
      </Card>
    )
  }

  return (
    <Stack space={4}>
      <Stack className="text-center" space={3}>
        <Heading as="h2" size={3}>
          Choose a gap to close
        </Heading>
        <Text align="center" muted size={1}>
          Select a document type × locale combination to start translating. Sorted by largest gaps
          first.
        </Text>
      </Stack>

      <div
        className="grid gap-3"
        style={{gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'}}
      >
        {topGaps.map((gap) => (
          <Card
            as="button"
            border
            className="cursor-pointer text-left transition-[border-color] duration-150 ease-in-out"
            key={`${gap.docType}-${gap.locale}`}
            onClick={() => handleGapClick(gap.docType, gap.locale)}
            padding={4}
            radius={2}
            tone="default"
          >
            <Stack space={3}>
              <Flex align="center" gap={2}>
                <Text size={2}>{gap.localeFlag}</Text>
                <Text size={1} weight="semibold">
                  {gap.docTypeLabel}
                </Text>
              </Flex>
              <Text muted size={1}>
                {gap.gapCount} needing attention in {gap.localeName}
                {gap.stale > 0 && <span> ({gap.stale} stale)</span>}
                {gap.usingFallback > 0 && <span> ({gap.usingFallback} fallback)</span>}
              </Text>
              {/* Mini progress bar showing the gap */}
              <div
                className="h-[3px] rounded-sm overflow-hidden"
                style={{background: 'var(--card-border-color)'}}
              >
                <div
                  className="h-full w-full transition-[width] duration-300 ease-in-out"
                  style={{background: 'var(--card-critical-fg-color, #f03e2f)'}}
                />
              </div>
            </Stack>
          </Card>
        ))}
      </div>
    </Stack>
  )
}

// --- Skeleton ---

function GapSelectorSkeleton() {
  return (
    <Stack space={4}>
      <Stack space={2}>
        <div className="skeleton" style={{height: 28, width: 256}} />
        <div className="skeleton" style={{height: 16, width: 384}} />
      </Stack>
      <div
        className="grid gap-3"
        style={{gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'}}
      >
        {Array.from({length: 6}).map((_, i) => (
          <Card border key={i} padding={4} radius={2}>
            <Stack space={3}>
              <div className="skeleton" style={{height: 20, width: 128}} />
              <div className="skeleton" style={{height: 16, width: 192}} />
              <div className="skeleton" style={{height: 3, width: '100%'}} />
            </Stack>
          </Card>
        ))}
      </div>
    </Stack>
  )
}

export {GapSelectorSkeleton}
export default GapSelectorView
