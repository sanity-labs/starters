/**
 * Hook to fetch active Sanity releases for the release target selector.
 *
 * Delegates to Studio's `useActiveReleases()` hook for realtime release
 * data, filtering to campaign-style releases (cardinality: 'many').
 *
 * Returns `undefined` while loading, then `Release[]`.
 */

import {useMemo} from 'react'
import {useActiveReleases} from 'sanity'

export interface Release {
  id: string
  title: string
}

export function useReleases(): Release[] | undefined {
  const {data, loading} = useActiveReleases()

  return useMemo(() => {
    if (loading && data.length === 0) return undefined

    return data
      .filter((r) => r.metadata?.cardinality === 'many')
      .map((r) => ({
        id: r.name ?? r._id,
        title: r.metadata?.title ?? r.name ?? r._id,
      }))
  }, [data, loading])
}
