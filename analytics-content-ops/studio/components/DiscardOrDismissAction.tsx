import {useState} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  useClient,
  useDocumentOperation,
  type DocumentActionComponent,
} from 'sanity'
import {TrashIcon} from '@sanity/icons'

// Workflow states in which the draft represents an agent suggestion to dismiss.
const IN_REVIEW = ['queued', 'in_progress', 'staged']

/**
 * The single discard/reject action for articles — it replaces Studio's default
 * "Discard changes" so editors have exactly one way to throw a draft away
 * instead of a "Discard changes" and a "Dismiss" button competing side by side.
 *
 * When the draft carries an agent suggestion it doubles as "Dismiss suggestion":
 * it resets the live article's review status to idle (stamping reviewedAt for
 * the sync's re-queue cooldown) *before* discarding, so a dismissed article
 * can't get stuck mid-pipeline. For an ordinary draft it's a plain discard.
 */
export const DiscardOrDismissAction: DocumentActionComponent = (props) => {
  const {id, type, draft, onComplete} = props
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const {discardChanges} = useDocumentOperation(id, type)
  const [isBusy, setIsBusy] = useState(false)

  // Nothing to discard without a draft.
  if (!draft) return null

  const reviewStatus = (draft as {agentReview?: {status?: string}}).agentReview?.status
  const isSuggestion = Boolean(reviewStatus && IN_REVIEW.includes(reviewStatus))

  const handle = async () => {
    setIsBusy(true)
    try {
      // Close the review on the live article before throwing away the proposal,
      // so the sync sees an idle (not stuck in_progress) article afterwards.
      if (isSuggestion) {
        await client
          .patch(id)
          .set({'agentReview.status': 'idle', 'agentReview.reviewedAt': new Date().toISOString()})
          .commit()
      }
      // Discard the draft via Studio's own operation.
      discardChanges.execute()
    } finally {
      setIsBusy(false)
      onComplete()
    }
  }

  return {
    label: isSuggestion ? 'Dismiss suggestion' : 'Discard changes',
    icon: TrashIcon,
    tone: 'critical',
    disabled: isBusy || Boolean(discardChanges.disabled),
    onHandle: handle,
  }
}
