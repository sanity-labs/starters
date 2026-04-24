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
    history[]{_key, status, timestamp, changedBy, error} | order(timestamp desc),
  }
`)

const PREVIEW_CONTEXT_QUERY = defineQuery(`
  *[_type == "promotion" && _id == $id][0]{
    "tokens": campaign->.previewContext.tokens[]{key, description},
    emailSlots[]{
      _type,
      _type == "emailSection" => { headline, body },
      _type == "emailHeader" => { brandName },
      _type == "emailCTA" => { text },
      _type == "emailFooter" => { legalText, unsubscribeText },
    },
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
    error: string | null
  }> | null
}

const STATUS_COLORS: Record<string, 'primary' | 'positive' | 'caution' | 'critical'> = {
  draft: 'primary',
  'in-review': 'caution',
  approved: 'positive',
  sent: 'positive',
  resent: 'caution',
  rejected: 'critical',
  error: 'critical',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Promotion created',
  'in-review': 'Submitted for review',
  approved: 'Approved for send',
  sent: 'Delivered via Klaviyo',
  resent: 'Resend queued',
  rejected: 'Rejected',
  error: 'Error',
}

function scanForTokens(
  blocks: Array<{
    headline?: string | null
    body?: string | null
    brandName?: string | null
    text?: string | null
    legalText?: string | null
    unsubscribeText?: string | null
  }> | null,
): Set<string> {
  const found = new Set<string>()
  const pattern = /\{\{\s*([\w.]+)\s*\}\}/g
  for (const block of blocks ?? []) {
    for (const val of [
      block.headline,
      block.body,
      block.brandName,
      block.text,
      block.legalText,
      block.unsubscribeText,
    ]) {
      if (!val) continue
      for (const match of val.matchAll(pattern)) {
        found.add(match[1])
      }
    }
  }
  return found
}

type PreviewStatusEntry = {
  key: string
  mode: 'sample' | 'send-time-only' | 'not-used'
}

function PreviewStatusInspectorComponent({documentId}: DocumentInspectorProps) {
  const client = useClient({apiVersion: '2026-04-08'})
  const promotionId = documentId.replace(/^drafts\./, '')

  const [workflow, setWorkflow] = useState<WorkflowState | null>(null)
  const [tokens, setTokens] = useState<PreviewStatusEntry[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      client.fetch<WorkflowState | null>(WORKFLOW_QUERY, {id: promotionId}),
      client.fetch<{
        tokens: Array<{key?: string | null; description?: string | null}> | null
        emailSlots: Array<{
          headline?: string | null
          body?: string | null
          brandName?: string | null
          text?: string | null
          legalText?: string | null
          unsubscribeText?: string | null
        }> | null
      } | null>(PREVIEW_CONTEXT_QUERY, {id: promotionId}),
    ]).then(([wf, preview]) => {
      if (cancelled) return
      setWorkflow(wf)

      const usedInBlocks = scanForTokens(preview?.emailSlots ?? [])
      const previewContextKeys = new Set(
        (preview?.tokens ?? []).map((t) => t.key).filter(Boolean) as string[],
      )

      const entries: PreviewStatusEntry[] = []
      for (const key of [...usedInBlocks]) {
        entries.push({
          key,
          mode: previewContextKeys.has(key) ? 'sample' : 'send-time-only',
        })
      }
      for (const key of [...previewContextKeys]) {
        if (!usedInBlocks.has(key)) {
          entries.push({key, mode: 'not-used'})
        }
      }
      setTokens(entries)
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
                  <Stack key={entry._key} space={1}>
                    <Flex gap={2} align="center">
                      <Text size={0} muted style={{minWidth: 70}}>
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                      </Text>
                      <Badge
                        tone={STATUS_COLORS[entry.status ?? 'draft'] ?? 'primary'}
                        fontSize={0}
                        padding={1}
                        radius={1}
                      >
                        {STATUS_LABELS[entry.status ?? ''] ??
                          (entry.status ?? '—').replace('-', ' ')}
                      </Badge>
                    </Flex>
                    {entry.error && (
                      <Text size={0} style={{color: 'var(--card-badge-critical-fg-color)'}}>
                        {entry.error}
                      </Text>
                    )}
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        )}

        {tokens.length > 0 && (
          <Stack space={3}>
            <Label size={1} muted>
              Preview Tokens
            </Label>
            <Stack space={2}>
              {tokens.map((t) => (
                <Flex key={t.key} gap={2} align="center">
                  <Text size={0} weight="semibold" style={{fontFamily: 'monospace'}}>
                    {`{{${t.key}}}`}
                  </Text>
                  <Badge
                    tone={
                      t.mode === 'sample'
                        ? 'positive'
                        : t.mode === 'not-used'
                          ? 'caution'
                          : 'default'
                    }
                    fontSize={0}
                    padding={1}
                    radius={1}
                  >
                    {t.mode === 'sample'
                      ? 'has sample'
                      : t.mode === 'not-used'
                        ? 'unused'
                        : 'send-time only'}
                  </Badge>
                </Flex>
              ))}
            </Stack>
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
