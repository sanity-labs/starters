import {useEffect, useMemo, useState} from 'react'

type Locale = {
  fallbackLocale?: null | string
  flag?: string
  id: string
  releaseId?: string
  title: string
}

interface UseReleaseSelectionProps {
  documentId: string
  targetLocales: Locale[]
}

export function useReleaseSelection({documentId, targetLocales}: UseReleaseSelectionProps) {
  const storageKey = `translation-release-${documentId}`
  const [selectedRelease, setSelectedRelease] = useState<null | string>(null)

  // Memoize the release selection logic to prevent infinite loops
  const localeInRelease = useMemo(
    () => targetLocales.find((loc) => loc?.releaseId),
    [targetLocales],
  )

  // Smart default: auto-select if any target locale is in a release
  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      setSelectedRelease(stored)
      return
    }

    // Auto-select release if any target locale is in one
    if (localeInRelease?.releaseId) {
      setSelectedRelease(localeInRelease.releaseId)
    }
  }, [documentId, storageKey, localeInRelease])

  // Persist selection
  useEffect(() => {
    if (selectedRelease) {
      localStorage.setItem(storageKey, selectedRelease)
    }
  }, [selectedRelease, storageKey])

  return {selectedRelease, setSelectedRelease}
}
