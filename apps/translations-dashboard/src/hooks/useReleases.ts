/**
 * Hook for fetching active releases, filtered for the translations dashboard.
 *
 * Uses useActiveReleases from @sanity/sdk-react which provides:
 *   - Suspense integration (suspends until data resolves)
 *   - Real-time reactivity (no manual refresh needed)
 *
 * Filters out:
 *   - Non-active releases (handled by SDK hook)
 *   - Agent-created releases (name starts with 'agent-')
 *   - Non-batch releases (cardinality !== 'many')
 */

import type {ReleaseDocument} from '@sanity/sdk'
import {useActiveReleases} from '@sanity/sdk-react'
import {useMemo} from 'react'

export function useReleases() {
  const allReleases = useActiveReleases()

  const releases = useMemo<ReleaseDocument[]>(
    () =>
      allReleases.filter((r) => {
        if (r.name.startsWith('agent-')) return false
        const metadata = r.metadata as {cardinality?: string} | undefined
        return metadata?.cardinality === 'many'
      }),
    [allReleases],
  )

  return {releases}
}
