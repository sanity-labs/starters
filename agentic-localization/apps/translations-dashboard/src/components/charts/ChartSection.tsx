/**
 * Chart section wrapper — provides ErrorBoundary + fade-in animation.
 *
 * Each chart section renders independently. When data arrives, the content
 * fades in smoothly. If a chart crashes, the ErrorBoundary catches it
 * without killing the dashboard.
 */

import React, {useEffect, useRef, useState} from 'react'

import ErrorBoundary from '../ErrorBoundary'

interface ChartSectionProps {
  children: React.ReactNode
  /** Name shown in error boundary fallback */
  featureName: string
  /** Whether the chart's data has loaded (triggers fade-in) */
  isLoaded: boolean
}

function ChartSection({children, featureName, isLoaded}: ChartSectionProps) {
  const [hasAnimated, setHasAnimated] = useState(false)
  const wasLoaded = useRef(false)

  useEffect(() => {
    // Trigger fade-in animation on first data load
    if (isLoaded && !wasLoaded.current) {
      wasLoaded.current = true
      setHasAnimated(true)
    }
  }, [isLoaded])

  return (
    <ErrorBoundary featureName={featureName}>
      <div className={hasAnimated ? 'chart-section-loaded' : undefined}>{children}</div>
    </ErrorBoundary>
  )
}

export default ChartSection
