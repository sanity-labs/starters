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
import {useTranslation} from 'sanity'

import {l10nLocaleNamespace} from '../i18n'

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
  const {t} = useTranslation(l10nLocaleNamespace)

  return (
    <Card padding={4} tone="critical">
      <Stack space={3}>
        <Text size={1} weight="semibold">
          {featureName
            ? t('error.with-feature', {featureName})
            : t('error.generic')}
        </Text>
        <Text size={1} muted>
          {error instanceof Error ? error.message : String(error)}
        </Text>
        <Flex>
          <Button
            icon={ResetIcon}
            text={t('retry')}
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
