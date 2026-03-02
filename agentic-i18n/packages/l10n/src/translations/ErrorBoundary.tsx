/**
 * Error boundary for translation UI components.
 *
 * Wraps `react-error-boundary` with a Sanity UI fallback. Catches render
 * errors from observable subscriptions and rejected promises in `use()`,
 * preventing unhandled crashes when paired with `<Suspense>`.
 */

import {ResetIcon} from '@sanity/icons'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {type ReactNode, useCallback} from 'react'
import {ErrorBoundary as ReactErrorBoundary, type FallbackProps} from 'react-error-boundary'

interface ErrorBoundaryProps {
  children: ReactNode
  featureName?: string
  onReset?: () => void
}

function ErrorFallback({
  error,
  resetErrorBoundary,
  featureName,
}: FallbackProps & {featureName?: string}) {
  return (
    <Card padding={4} tone="critical">
      <Stack space={3}>
        <Text size={1} weight="semibold">
          {featureName ? `${featureName} encountered an error` : 'Something went wrong'}
        </Text>
        <Text size={1} muted>
          {error instanceof Error ? error.message : String(error)}
        </Text>
        <Flex>
          <Button
            icon={ResetIcon}
            text="Retry"
            tone="critical"
            mode="ghost"
            onClick={resetErrorBoundary}
            fontSize={1}
          />
        </Flex>
      </Stack>
    </Card>
  )
}

export function ErrorBoundary({children, featureName, onReset}: ErrorBoundaryProps) {
  const fallbackRender = useCallback(
    (props: FallbackProps) => <ErrorFallback {...props} featureName={featureName} />,
    [featureName],
  )

  return (
    <ReactErrorBoundary fallbackRender={fallbackRender} onReset={onReset}>
      {children}
    </ReactErrorBoundary>
  )
}
