/**
 * A reviewer's two verbs on a proposal: Accept and Reject.
 *
 * Nothing else. The form is read-only, so there is no publish, no duplicate and
 * no edit — a proposal is evidence, and the decision is binary. Accept copies it
 * into a glossary or style guide DRAFT and deletes it; Reject just deletes it.
 *
 * Both surface their own failures. A document action that swallows a rejected
 * mutation leaves the reviewer believing a decision landed when it did not.
 */

import {CheckmarkCircleIcon, TrashIcon} from '@sanity/icons'
import {Text} from '@sanity/ui'
import {useState, useTransition} from 'react'
import {
  useClient,
  type DocumentActionComponent,
  type DocumentActionDescription,
  type DocumentActionProps,
} from 'sanity'

import {acceptProposal, readProposal, rejectProposal} from './acceptProposal'

const API_VERSION = '2025-05-16'

/** Accepting an eval case keeps it; accepting the other kinds files it. */
const ACCEPT_LABEL: Record<string, string> = {
  'eval-case': 'Keep as eval case',
  'glossary-term': 'Add to glossary',
  'style-rule': 'Add to style guide',
}

function useProposalAction(props: DocumentActionProps) {
  const client = useClient({apiVersion: API_VERSION})
  const [pending, startTransition] = useTransition()
  const [failure, setFailure] = useState<null | string>(null)

  const run = (work: () => Promise<void>) =>
    startTransition(async () => {
      setFailure(null)
      try {
        await work()
        props.onComplete()
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error))
      }
    })

  const dialog: DocumentActionDescription['dialog'] = failure
    ? {
        type: 'dialog',
        header: 'That did not land',
        content: <Text size={1}>{failure}</Text>,
        onClose: () => setFailure(null),
      }
    : undefined

  return {client, dialog, pending, run}
}

/** Named declarations, not arrows: the hooks lint rule reads the identifier. */
function AcceptProposal(props: DocumentActionProps): DocumentActionDescription | null {
  const {client, dialog, pending, run} = useProposalAction(props)
  const proposal = readProposal(props.draft ?? props.published)
  if (!proposal) return null

  return {
    label: ACCEPT_LABEL[proposal.kind] ?? 'Accept',
    icon: CheckmarkCircleIcon,
    tone: 'positive',
    disabled: pending,
    onHandle: () => run(() => acceptProposal(client, proposal)),
    dialog,
  }
}

function RejectProposal(props: DocumentActionProps): DocumentActionDescription | null {
  const {client, dialog, pending, run} = useProposalAction(props)
  const proposal = readProposal(props.draft ?? props.published)
  if (!proposal) return null

  return {
    label: 'Reject',
    icon: TrashIcon,
    tone: 'critical',
    disabled: pending,
    onHandle: () => run(() => rejectProposal(client, proposal._id)),
    dialog,
  }
}

export const acceptProposalAction: DocumentActionComponent = AcceptProposal
export const rejectProposalAction: DocumentActionComponent = RejectProposal

/** The complete action set for `l10n.proposal` — it replaces the defaults. */
export const proposalActions: DocumentActionComponent[] = [
  acceptProposalAction,
  rejectProposalAction,
]
