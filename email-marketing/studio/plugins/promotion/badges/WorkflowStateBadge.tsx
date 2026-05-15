import {useEffect, useState} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  useClient,
  type DocumentBadgeComponent,
  type DocumentBadgeDescription,
} from 'sanity'
import {defineQuery} from 'groq'

const WORKFLOW_STATE_QUERY = defineQuery(
  `*[_type == "workflow.state" && promotionId._ref == $id][0].status`,
)

const STATUS_COLORS: Record<string, DocumentBadgeDescription['color']> = {
  draft: 'primary',
  'in-review': 'warning',
  approved: 'success',
  sent: 'primary',
  rejected: 'danger',
}

export const WorkflowStateBadge: DocumentBadgeComponent = (props) => {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const [status, setStatus] = useState<string | null>(null)

  const promotionId = (props.published?._id ?? props.draft?._id ?? '').replace(/^drafts\./, '')

  useEffect(() => {
    if (!promotionId) return
    let cancelled = false

    client
      .fetch<string | null>(
        WORKFLOW_STATE_QUERY,
        {id: promotionId},
        {tag: 'promotion.badge.workflow'},
      )
      .then((result) => {
        if (!cancelled && result) setStatus(result)
      })

    return () => {
      cancelled = true
    }
  }, [client, promotionId])

  if (!status) return null

  return {
    label: status.replace('-', ' ').replace(/^\w/, (c) => c.toUpperCase()),
    color: STATUS_COLORS[status] ?? 'primary',
    title: `Workflow status: ${status}`,
  }
}
