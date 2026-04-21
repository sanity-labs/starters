import {useState} from 'react'
import {ResetIcon} from '@sanity/icons'
import {type DocumentActionComponent, useClient} from 'sanity'
import {defineQuery} from 'groq'

const WORKFLOW_STATE_QUERY = defineQuery(`
  *[_type == "workflow.state" && promotionId._ref == $id][0]{_id, status}
`)

export const ResendAction: DocumentActionComponent = (props) => {
  const client = useClient({apiVersion: '2026-04-08'})
  const [confirming, setConfirming] = useState(false)

  const promotionId = props.id.replace(/^drafts\./, '')

  const onConfirm = async () => {
    setConfirming(false)

    const wfDoc = await client.fetch<{_id: string; status: string} | null>(WORKFLOW_STATE_QUERY, {
      id: promotionId,
    })

    if (!wfDoc) return

    await client
      .patch(wfDoc._id)
      .set({status: 'approved', sentAt: null})
      .append('history', [
        {
          _key: `h-${Date.now()}`,
          _type: 'object',
          status: 'approved',
          timestamp: new Date().toISOString(),
        },
      ])
      .commit()
  }

  const doc = props.published ?? props.draft
  if (!doc) return null

  return {
    label: 'Resend',
    icon: ResetIcon,
    tone: 'caution' as const,
    onHandle: () => setConfirming(true),
    dialog: confirming
      ? {
          type: 'confirm' as const,
          tone: 'caution' as const,
          message: 'Re-queue this promotion for send? It will be dispatched again.',
          onCancel: () => setConfirming(false),
          onConfirm,
        }
      : null,
  }
}
