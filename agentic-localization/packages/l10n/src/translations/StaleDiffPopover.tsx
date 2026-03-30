/**
 * Popover showing before/after source value diff for stale field translations.
 *
 * Displays what changed in the source value since the translation was created,
 * with dismiss (keep current translation) and re-translate actions.
 *
 * Uses the existing InlineDiff component for word-level diffs.
 */

import {CheckmarkCircleIcon, ResetIcon, TranslateIcon} from '@sanity/icons'
import {Box, Button, Card, Flex, Popover, Stack, Text, useClickOutsideEvent} from '@sanity/ui'
import {useCallback, useRef, useState} from 'react'
import {useTranslation} from 'sanity'

import {l10nLocaleNamespace} from '../i18n'
import {InlineDiff} from './InlineDiff'

interface StaleDiffPopoverProps {
  /** The field's display path (e.g., 'bio') */
  fieldPath: string
  /** The locale ID (e.g., 'es-MX') */
  localeId: string
  /** JSON.stringify'd source value at time of translation */
  sourceSnapshot?: string
  /** JSON.stringify'd current source value */
  currentSourceValue?: string
  /** Dismiss stale — user confirms current translation is still valid */
  onDismiss: (fieldPath: string, localeId: string) => void
  /** Re-translate — kick off a fresh translation */
  onRetranslate: (fieldPath: string, localeId: string) => void
  /** The trigger element to wrap */
  children: React.ReactElement
}

export function StaleDiffPopover({
  fieldPath,
  localeId,
  sourceSnapshot,
  currentSourceValue,
  onDismiss,
  onRetranslate,
  children,
}: StaleDiffPopoverProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const {t} = useTranslation(l10nLocaleNamespace)

  useClickOutsideEvent(
    () => setOpen(false),
    () => [popoverRef.current],
  )

  const handleDismiss = useCallback(() => {
    onDismiss(fieldPath, localeId)
    setOpen(false)
  }, [fieldPath, localeId, onDismiss])

  const handleRetranslate = useCallback(() => {
    onRetranslate(fieldPath, localeId)
    setOpen(false)
  }, [fieldPath, localeId, onRetranslate])

  // Parse stored snapshots back to display strings
  const oldValue = parseSnapshot(sourceSnapshot)
  const newValue = parseSnapshot(currentSourceValue)

  const content = (
    <Card ref={popoverRef} padding={3} radius={2} style={{maxWidth: 400, minWidth: 280}}>
      <Stack space={3}>
        <Text size={1} weight="semibold">
          {t('stale-diff.title')}
        </Text>
        <Text size={1} muted>
          {t('stale-diff.description', {fieldPath})}
        </Text>

        {oldValue && newValue && oldValue !== newValue ? (
          <InlineDiff oldValue={oldValue} newValue={newValue} maxLength={300} />
        ) : (
          <Card padding={3} radius={2} tone="transparent" border>
            <Text size={1} muted>
              {t('stale-diff.fallback')}
            </Text>
          </Card>
        )}

        <Flex gap={2}>
          <Button
            fontSize={1}
            icon={CheckmarkCircleIcon}
            mode="ghost"
            onClick={handleDismiss}
            text={t('stale-diff.dismiss')}
            tone="positive"
          />
          <Button
            fontSize={1}
            icon={TranslateIcon}
            mode="ghost"
            onClick={handleRetranslate}
            text={t('stale-diff.retranslate')}
            tone="suggest"
          />
        </Flex>
      </Stack>
    </Card>
  )

  return (
    <Popover content={content} open={open} placement="bottom" portal tone="default">
      <span onClick={() => setOpen(!open)} style={{cursor: 'pointer'}}>
        {children}
      </span>
    </Popover>
  )
}

/** Parse a JSON.stringify'd snapshot back to a display string. */
function parseSnapshot(snapshot: string | undefined): string | undefined {
  if (!snapshot) return undefined
  try {
    const parsed = JSON.parse(snapshot)
    if (typeof parsed === 'string') return parsed
    // For portable text or complex values, show a simplified representation
    if (Array.isArray(parsed)) {
      return parsed
        .filter((block: Record<string, unknown>) => block._type === 'block')
        .flatMap(
          (block: Record<string, unknown>) =>
            (block.children as Array<{text?: string}> | undefined)?.map((c) => c.text ?? '') ?? [],
        )
        .join(' ')
    }
    return JSON.stringify(parsed)
  } catch {
    return snapshot
  }
}
