import {useEffect, useState} from 'react'
import {Badge, Box, Flex, Label, Stack, Text} from '@sanity/ui'
import {BarChartIcon} from '@sanity/icons'
import {useClient, defineDocumentInspector, type DocumentInspectorProps} from 'sanity'
import {defineQuery} from 'groq'

const WORKFLOW_QUERY = defineQuery(`
  *[_type == "workflow.state" && promotionId._ref == $id][0]{
    status,
    approvedBy,
    sentAt,
    history[]{_key, status, timestamp, changedBy} | order(timestamp desc),
  }
`)

type WorkflowState = {
  status: string | null
  approvedBy: string | null
  sentAt: string | null
  history: Array<{
    _key: string
    status: string | null
    timestamp: string | null
    changedBy: string | null
  }> | null
}

const STATUS_COLORS: Record<string, 'primary' | 'positive' | 'caution' | 'critical'> = {
  draft: 'primary',
  'in-review': 'caution',
  approved: 'positive',
  sent: 'positive',
  resent: 'caution',
  rejected: 'critical',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Promotion created',
  'in-review': 'Submitted for review',
  approved: 'Approved for send',
  sent: 'Delivered via Klaviyo',
  resent: 'Resend queued',
  rejected: 'Rejected',
}

function PreviewStatusInspectorComponent({documentId}: DocumentInspectorProps) {
  const client = useClient({apiVersion: '2026-04-08'})
  const promotionId = documentId.replace(/^drafts\./, '')

  const [workflow, setWorkflow] = useState<WorkflowState | null>(null)

  useEffect(() => {
    let cancelled = false
    client.fetch<WorkflowState | null>(WORKFLOW_QUERY, {id: promotionId}).then((wf) => {
      if (!cancelled) setWorkflow(wf)
    })
    return () => {
      cancelled = true
    }
  }, [client, promotionId])

  return (
    <Box padding={4} overflow="auto">
      <Stack space={5}>
        {workflow && (
          <Stack space={3}>
            <Label size={1} muted>
              Workflow
            </Label>
            {workflow.sentAt && (
              <Text size={1} muted>
                Last sent {new Date(workflow.sentAt).toLocaleDateString()}
              </Text>
            )}

            {workflow.history && workflow.history.length > 0 && (
              <Stack space={2}>
                {workflow.history.map((entry) => (
                  <Flex key={entry._key} gap={2} align="center">
                    <Text size={0} muted style={{minWidth: 70}}>
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                    </Text>
                    <Badge
                      tone={STATUS_COLORS[entry.status ?? 'draft'] ?? 'primary'}
                      fontSize={0}
                      padding={1}
                      radius={1}
                    >
                      {STATUS_LABELS[entry.status ?? ''] ?? (entry.status ?? '—').replace('-', ' ')}
                    </Badge>
                  </Flex>
                ))}
              </Stack>
            )}
          </Stack>
        )}

        {!workflow && (
          <Text size={1} muted>
            No workflow state found.
          </Text>
        )}
      </Stack>
    </Box>
  )
}

export const PreviewStatusInspector = defineDocumentInspector({
  name: 'promotion-preview-status',
  useMenuItem() {
    return {title: 'Preview Status', icon: BarChartIcon}
  },
  component: PreviewStatusInspectorComponent,
})
