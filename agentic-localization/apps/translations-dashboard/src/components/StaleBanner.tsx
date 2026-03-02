/**
 * Stale notification banner — contextual alert on dashboard load.
 *
 * Shows a yellow caution banner at the top of the dashboard when there are
 * new stale documents since the user's last visit. Tracks "last seen" count
 * in localStorage to detect new staleness.
 *
 * Dismissible — once dismissed, stays hidden until the stale count increases
 * again (new stale docs appear).
 *
 * Reads stale count from the same aggregate data layer — no additional queries.
 */

import {WarningOutlineIcon} from '@sanity/icons'
import {Box, Button, Card, Flex, Text} from '@sanity/ui'
import {useCallback, useEffect, useMemo, useState} from 'react'

// --- Constants ---

const STORAGE_KEY = 'starter:translations:lastSeenStaleCount'

// --- Types ---

interface StaleBannerProps {
  /** Current count of stale documents */
  staleCount: number
  /** Called when "View →" is clicked — scroll to stale section */
  onViewStale?: () => void
}

// --- Component ---

function StaleBanner({staleCount, onViewStale}: StaleBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  // Read last-seen count from localStorage
  const lastSeenCount = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored !== null ? parseInt(stored, 10) : 0
    } catch {
      // localStorage unavailable (SSR, privacy mode) — treat as 0
      return 0
    }
  }, [])

  // Determine if there are new stale docs since last visit
  const hasNewStale = staleCount > 0 && staleCount > lastSeenCount

  // Update localStorage when banner is dismissed or on unmount with current count
  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, String(staleCount))
    } catch {
      // localStorage unavailable — silent fail, banner will show again next visit
    }
  }, [staleCount])

  // Update last-seen count when user navigates away (component unmounts)
  // Only if they saw the banner (staleCount > 0)
  useEffect(() => {
    if (staleCount === 0) return
    return () => {
      try {
        localStorage.setItem(STORAGE_KEY, String(staleCount))
      } catch {
        // silent fail
      }
    }
  }, [staleCount])

  // Don't render if no new stale docs or already dismissed
  if (!hasNewStale || dismissed) {
    return null
  }

  const newCount = staleCount - lastSeenCount

  return (
    <Card padding={3} radius={2} tone="caution">
      <Flex align="center" gap={3}>
        <Text size={1}>
          <WarningOutlineIcon />
        </Text>
        <Box flex={1}>
          <Text size={1} weight="medium">
            {newCount === staleCount
              ? `${staleCount} document${staleCount === 1 ? ' has' : 's have'} stale translations`
              : `${newCount} new stale document${newCount === 1 ? '' : 's'} since your last visit`}
          </Text>
        </Box>
        {onViewStale && (
          <Button fontSize={1} mode="bleed" onClick={onViewStale} text="View →" tone="caution" />
        )}
        <Button fontSize={1} mode="bleed" onClick={dismiss} text="Dismiss" />
      </Flex>
    </Card>
  )
}

export default StaleBanner
