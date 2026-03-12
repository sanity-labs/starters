import {useClient} from '@sanity/sdk-react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {BATCH_METADATA_STATUS_QUERY} from '../queries/metadataQueries'
import {useApp} from './AppContext'

// Status for a single language within a metadata document
export type LanguageStatus = {
  draftExists?: boolean
  fallbackStatus?: 'draft' | 'inRelease' | 'missing' | 'published'
  publishedExists?: boolean
  // Extended data for right side panel (avoids second fetch)
  ref?: string // The base document reference ID (published ID format)
  status: 'draft' | 'inRelease' | 'missing' | 'published'
  versionReleaseIds?: string[] // Release IDs where versions exist
  workflowStatus?: 'approved' | 'missing' | 'needsReview' | 'stale' | 'usingFallback'
}

// All language statuses for a single metadata document
export type MetadataStatuses = {
  [localeId: string]: LanguageStatus
}

// The full cache: metadataId -> locale statuses
type StatusCache = Map<string, MetadataStatuses>

type TranslationStatusContextType = {
  getAllStatuses: (metadataId: string) => MetadataStatuses | null
  getStatus: (metadataId: string, localeId: string) => LanguageStatus | null
  invalidateMetadata: (metadataId: string) => void
  isLoading: (metadataId: string) => boolean
  registerMetadataIds: (ids: string[]) => void
  updateLocaleStatus: (
    metadataId: string,
    localeId: string,
    status: Partial<LanguageStatus>,
  ) => void
}

const TranslationStatusContext = createContext<TranslationStatusContextType | undefined>(undefined)

interface TranslationStatusProviderProps {
  children: ReactNode
  fallbackLocaleMap: Map<string, null | string> // localeId -> fallbackLocaleId
  localeIds: string[]
}

function resolveWorkflowStatusFromEntry(
  storedStatus: string | undefined,
  hasTranslation: boolean,
  hasFallback: boolean,
): LanguageStatus['workflowStatus'] {
  if (!hasTranslation) {
    return hasFallback ? 'usingFallback' : 'missing'
  }
  if (storedStatus === 'needsReview') return 'needsReview'
  if (storedStatus === 'approved') return 'approved'
  if (storedStatus === 'stale') return 'stale'
  // Document exists but no workflow state — default to needsReview
  return 'needsReview'
}

export function TranslationStatusProvider({
  children,
  fallbackLocaleMap,
  localeIds,
}: TranslationStatusProviderProps) {
  const {sanityClientConfig} = useApp()
  const client = useClient(sanityClientConfig)
  const [statusCache, setStatusCache] = useState<StatusCache>(new Map())
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const pendingIds = useRef<Set<string>>(new Set())
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Batch fetch function that fetches statuses for multiple metadata IDs at once
  const fetchBatch = useCallback(
    async (metadataIds: string[]) => {
      if (metadataIds.length === 0) return

      // Mark as loading
      setLoadingIds((prev) => {
        const next = new Set(prev)
        metadataIds.forEach((id) => next.add(id))
        return next
      })

      try {
        // Build the query to fetch all statuses in one go
        // Also fetch version IDs to know which releases have translations
        const result = await client.fetch<
          Array<{
            _id: string
            translations: Array<{
              _key: string
              language: string
              draftExists: boolean
              publishedExists: boolean
              ref: string
              versionIds: string[]
            }>
            workflowStates: Array<{
              _key: string
              language: string
              reviewedBy?: string
              source?: string
              status?: string
              updatedAt?: string
            }> | null
          }>
        >(BATCH_METADATA_STATUS_QUERY, {metadataIds}, {perspective: 'raw'})

        // Process results into the cache format
        const newEntries = new Map<string, MetadataStatuses>()

        for (const metadata of result) {
          const localeStatuses: MetadataStatuses = {}
          const wfArray = metadata.workflowStates ?? []
          const wfStates: Record<
            string,
            {reviewedBy?: string; source?: string; status?: string; updatedAt?: string}
          > = {}
          for (const entry of wfArray) {
            wfStates[entry.language] = entry
          }

          // Create a lookup map for this metadata's translations
          const translationMap = new Map<
            string,
            {draftExists: boolean; publishedExists: boolean; ref: string; versionIds: string[]}
          >()
          for (const t of metadata.translations || []) {
            translationMap.set(t.language, t)
          }

          // Compute status for each locale
          for (const localeId of localeIds) {
            const translation = translationMap.get(localeId)
            const fallbackLocaleId = fallbackLocaleMap.get(localeId)
            const fallbackTranslation = fallbackLocaleId
              ? translationMap.get(fallbackLocaleId)
              : undefined

            // Compute main status
            let status: LanguageStatus['status'] = 'missing'
            const hasVersions = translation?.versionIds && translation.versionIds.length > 0
            if (translation) {
              if (translation.publishedExists) {
                status = 'published'
              } else if (translation.draftExists) {
                status = 'draft'
              } else if (hasVersions) {
                status = 'inRelease'
              }
            }

            // Compute fallback status
            let fallbackStatus: LanguageStatus['fallbackStatus']
            const fallbackHasVersions =
              fallbackTranslation?.versionIds && fallbackTranslation.versionIds.length > 0
            if (fallbackTranslation) {
              if (fallbackTranslation.publishedExists) {
                fallbackStatus = 'published'
              } else if (fallbackTranslation.draftExists) {
                fallbackStatus = 'draft'
              } else if (fallbackHasVersions) {
                fallbackStatus = 'inRelease'
              } else {
                fallbackStatus = 'missing'
              }
            }

            // Extract release IDs from version IDs (format: versions.{releaseId}.{docId})
            const versionReleaseIds = translation?.versionIds
              ?.map((vid) => {
                const parts = vid.split('.')
                return parts.length >= 3 ? parts[1] : null
              })
              .filter((id): id is string => id !== null)

            // Resolve workflow status from metadata workflowStates
            const wfEntry = wfStates[localeId]
            const workflowStatus = resolveWorkflowStatusFromEntry(
              wfEntry?.status,
              status !== 'missing',
              !!fallbackTranslation,
            )

            localeStatuses[localeId] = {
              draftExists: translation?.draftExists,
              fallbackStatus,
              publishedExists: translation?.publishedExists,
              ref: translation?.ref,
              status,
              versionReleaseIds: versionReleaseIds?.length ? versionReleaseIds : undefined,
              workflowStatus,
            }
          }

          newEntries.set(metadata._id, localeStatuses)
        }

        // Also add empty entries for metadata IDs that weren't found (document has no metadata yet)
        for (const id of metadataIds) {
          if (!newEntries.has(id)) {
            const emptyStatuses: MetadataStatuses = {}
            for (const localeId of localeIds) {
              emptyStatuses[localeId] = {status: 'missing'}
            }
            newEntries.set(id, emptyStatuses)
          }
        }

        // Update cache
        setStatusCache((prev) => {
          const next = new Map(prev)
          for (const [id, statuses] of newEntries) {
            next.set(id, statuses)
          }
          return next
        })
      } catch (error) {
        console.error('Failed to fetch translation statuses:', error)
      } finally {
        // Clear loading state
        setLoadingIds((prev) => {
          const next = new Set(prev)
          metadataIds.forEach((id) => next.delete(id))
          return next
        })
      }
    },
    [client, localeIds, fallbackLocaleMap],
  )

  // Debounced registration - collects IDs and fetches them in a batch
  const registerMetadataIds = useCallback(
    (ids: string[]) => {
      // Add new IDs to pending set
      for (const id of ids) {
        if (!statusCache.has(id) && !loadingIds.has(id)) {
          pendingIds.current.add(id)
        }
      }

      // Clear existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }

      // Set a short timeout to batch registrations
      fetchTimeoutRef.current = setTimeout(() => {
        const idsToFetch = Array.from(pendingIds.current)
        pendingIds.current.clear()
        if (idsToFetch.length > 0) {
          fetchBatch(idsToFetch)
        }
      }, 50) // 50ms debounce to collect multiple registrations
    },
    [statusCache, loadingIds, fetchBatch],
  )

  // Get status for a specific metadata + locale combination
  const getStatus = useCallback(
    (metadataId: string, localeId: string): LanguageStatus | null => {
      const metadataStatuses = statusCache.get(metadataId)
      if (!metadataStatuses) return null
      return metadataStatuses[localeId] || null
    },
    [statusCache],
  )

  // Get all statuses for a metadata document (used by right side panel)
  const getAllStatuses = useCallback(
    (metadataId: string): MetadataStatuses | null => {
      return statusCache.get(metadataId) || null
    },
    [statusCache],
  )

  // Check if a metadata ID is still loading
  const isLoading = useCallback(
    (metadataId: string): boolean => {
      return loadingIds.has(metadataId) || pendingIds.current.has(metadataId)
    },
    [loadingIds],
  )

  // Update a specific locale's status in the cache (used when translation is created)
  const updateLocaleStatus = useCallback(
    (metadataId: string, localeId: string, statusUpdate: Partial<LanguageStatus>) => {
      setStatusCache((prev) => {
        const next = new Map(prev)
        const existing = next.get(metadataId) || {}
        const existingLocale = existing[localeId] || {status: 'missing' as const}

        next.set(metadataId, {
          ...existing,
          [localeId]: {
            ...existingLocale,
            ...statusUpdate,
          },
        })
        return next
      })
    },
    [],
  )

  // Invalidate and refetch a metadata document (forces fresh data)
  const invalidateMetadata = useCallback(
    (metadataId: string) => {
      // Remove from cache so it will be refetched
      setStatusCache((prev) => {
        const next = new Map(prev)
        next.delete(metadataId)
        return next
      })
      // Trigger a refetch
      registerMetadataIds([metadataId])
    },
    [registerMetadataIds],
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [])

  const value = useMemo(
    () => ({
      getAllStatuses,
      getStatus,
      invalidateMetadata,
      isLoading,
      registerMetadataIds,
      updateLocaleStatus,
    }),
    [
      getAllStatuses,
      getStatus,
      invalidateMetadata,
      isLoading,
      registerMetadataIds,
      updateLocaleStatus,
    ],
  )

  return (
    <TranslationStatusContext.Provider value={value}>{children}</TranslationStatusContext.Provider>
  )
}

export const useTranslationStatusContext = (): TranslationStatusContextType => {
  const context = useContext(TranslationStatusContext)
  if (context === undefined) {
    throw new Error('useTranslationStatusContext must be used within a TranslationStatusProvider')
  }
  return context
}

// Hook for components to get status and trigger registration
export const useTranslationStatus = (
  metadataId: string,
  localeId: string,
): {isLoading: boolean; status: LanguageStatus | null} => {
  const {getStatus, isLoading, registerMetadataIds} = useTranslationStatusContext()

  // Register this metadata ID for fetching
  useEffect(() => {
    registerMetadataIds([metadataId])
  }, [metadataId, registerMetadataIds])

  return {
    isLoading: isLoading(metadataId),
    status: getStatus(metadataId, localeId),
  }
}

// Hook for right side panel to get all cached statuses for a metadata document
export const useAllTranslationStatuses = (
  metadataId: string | undefined,
): {allStatuses: MetadataStatuses | null; isLoading: boolean} => {
  const {getAllStatuses, isLoading, registerMetadataIds} = useTranslationStatusContext()

  // Register this metadata ID for fetching (if not already cached)
  useEffect(() => {
    if (metadataId) {
      registerMetadataIds([metadataId])
    }
  }, [metadataId, registerMetadataIds])

  return {
    allStatuses: metadataId ? getAllStatuses(metadataId) : null,
    isLoading: metadataId ? isLoading(metadataId) : false,
  }
}
