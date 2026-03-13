/**
 * Publish/schedule gate for field-level translations.
 *
 * Wraps a Sanity document action (typically PublishAction or ScheduleAction)
 * and disables the button when there are unreviewed (`needsReview`) or stale
 * field translations. Matches the standard Sanity pattern: `disabled` + `title` tooltip.
 *
 * Usage in plugin.ts — injected via `document.actions` callback.
 */

import {createElement, useMemo} from 'react'
import {
  type DocumentActionComponent,
  type DocumentActionDescription,
  type DocumentActionProps,
  getPublishedId,
  useTranslation,
} from 'sanity'
import {Text} from '@sanity/ui'

import {l10nLocaleNamespace} from '../i18n'
import {useFieldWorkflowMetadata} from './useFieldWorkflowMetadata'

/**
 * Create a wrapped action that disables when there are unreviewed field translations.
 *
 * @param WrappedAction - The original action component to wrap (publish or schedule)
 * @returns A new action component with gating
 */
export function createFieldTranslationPublishGate(
  WrappedAction: DocumentActionComponent,
): DocumentActionComponent {
  function FieldTranslationPublishGate(
    props: DocumentActionProps,
  ): DocumentActionDescription | null {
    const originalResult = WrappedAction(props)
    const publishedId = getPublishedId(props.id)
    const metadata = useFieldWorkflowMetadata(publishedId)
    const {t} = useTranslation(l10nLocaleNamespace)

    const {needsReviewCount, staleCount} = useMemo(() => {
      let review = 0
      let stale = 0
      for (const entry of metadata.states) {
        if (entry.status === 'needsReview') review++
        if (entry.status === 'stale') stale++
      }
      return {needsReviewCount: review, staleCount: stale}
    }, [metadata.states])

    const hasUnresolved = needsReviewCount > 0 || staleCount > 0

    if (!originalResult || !hasUnresolved) {
      return originalResult
    }

    // Build a descriptive reason
    const parts: string[] = []
    if (needsReviewCount > 0) {
      parts.push(t('publish-gate.pending-review', {count: needsReviewCount}))
    }
    if (staleCount > 0) {
      parts.push(t('publish-gate.stale', {count: staleCount}))
    }

    return {
      ...originalResult,
      disabled: true,
      title: createElement(Text, {size: 1}, parts.join(', ')),
      tone: 'caution',
    }
  }

  FieldTranslationPublishGate.action = WrappedAction.action
  FieldTranslationPublishGate.displayName = 'FieldTranslationPublishGate'
  return FieldTranslationPublishGate
}
