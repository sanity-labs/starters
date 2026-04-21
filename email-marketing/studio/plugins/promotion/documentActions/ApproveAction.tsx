import {useState} from 'react'
import {CheckmarkIcon} from '@sanity/icons'
import {type DocumentActionComponent, useClient} from 'sanity'
import {defineQuery} from 'groq'

const WORKFLOW_STATE_QUERY = defineQuery(`
  *[_type == "workflow.state" && promotionId._ref == $id][0]._id
`)

export const ApproveAction: DocumentActionComponent = (props) => {
  const client = useClient({apiVersion: '2026-04-08'})
  const [confirming, setConfirming] = useState(false)

  const promotionId = props.id.replace(/^drafts\./, '')

  const onConfirm = async () => {
    setConfirming(false)

    const existingId = await client.fetch<string | null>(WORKFLOW_STATE_QUERY, {
      id: promotionId,
    })

    const wfId = existingId ?? `wf-${promotionId}`
    const now = new Date().toISOString()

    if (existingId) {
      await client
        .patch(wfId)
        .set({status: 'approved'})
        .append('history', [
          {
            _key: `h-${Date.now()}`,
            _type: 'object',
            status: 'approved',
            timestamp: now,
          },
        ])
        .commit()
    } else {
      await client.createOrReplace({
        _id: wfId,
        _type: 'workflow.state',
        promotionId: {_type: 'reference', _ref: promotionId},
        status: 'approved',
        history: [
          {
            _key: `h-${Date.now()}`,
            _type: 'object',
            status: 'approved',
            timestamp: now,
          },
        ],
      })
    }
  }

  const doc = props.published ?? props.draft
  if (!doc) return null

  return {
    label: 'Approve',
    icon: CheckmarkIcon,
    tone: 'positive' as const,
    onHandle: () => setConfirming(true),
    dialog: confirming
      ? {
          type: 'confirm' as const,
          tone: 'positive' as const,
          message: 'Approve this promotion for send?',
          onCancel: () => setConfirming(false),
          onConfirm,
        }
      : null,
  }
}
