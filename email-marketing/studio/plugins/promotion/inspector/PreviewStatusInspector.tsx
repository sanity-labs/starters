import {useEffect, useState, useMemo} from 'react'
import {Badge, Box, Card, Flex, Label, Stack, Text} from '@sanity/ui'
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
  }> | null
}

type PreviewStatusEntry = {key: string; mode: 'sample' | 'send-time-only' | 'not-used'}

const STATUS_COLORS: Record<string, 'primary' | 'positive' | 'caution' | 'critical'> = {
  draft: 'primary',
  'in-review': 'caution',
  approved: 'positive',
  sent: 'positive',
  rejected: 'critical',
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

  const used = tokens.filter((t) => t.mode !== 'not-used')
  const sampleCount = used.filter((t) => t.mode === 'sample').length
  const sendTimeCount = used.filter((t) => t.mode === 'send-time-only').length
  const accuracy =
    used.length === 0
      ? 'N/A'
      : sampleCount === used.length
        ? 'High'
        : sampleCount === 0
          ? 'Low'
          : 'Medium'

  return (
    <Box padding={4} overflow="auto">
      <Stack space={5}>
        {/* Workflow status */}
        {workflow && (
          <Stack space={3}>
            <Label size={1} muted>
              Workflow
            </Label>
            <Flex align="center" gap={2}>
              <Badge
                tone={STATUS_COLORS[workflow.status ?? 'draft'] ?? 'primary'}
                fontSize={1}
                padding={2}
                radius={2}
              >
                {(workflow.status ?? 'draft').replace('-', ' ')}
              </Badge>
              {workflow.sentAt && (
                <Text size={1} muted>
                  Sent {new Date(workflow.sentAt).toLocaleDateString()}
                </Text>
              )}
            </Flex>

            {workflow.history && workflow.history.length > 0 && (
              <Stack space={2}>
                {workflow.history.map((entry) => (
                  <Flex key={entry._key} gap={2} align="center">
                    <Text size={0} muted style={{minWidth: 70}}>
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : '—'}
                    </Text>
                    <Badge
                      tone={STATUS_COLORS[entry.status ?? 'draft'] ?? 'primary'}
                      fontSize={0}
                      padding={1}
                      radius={1}
                    >
                      {(entry.status ?? '—').replace('-', ' ')}
                    </Badge>
                    {entry.changedBy && (
                      <Text
                        size={0}
                        muted
                        style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
                      >
                        {entry.changedBy}
                      </Text>
                    )}
                  </Flex>
                ))}
              </Stack>
            )}
          </Stack>
        )}

        {/* Preview accuracy */}
        {tokens.length > 0 && (
          <Stack space={3}>
            <Flex align="center" justify="space-between">
              <Label size={1} muted>
                Preview Accuracy
              </Label>
              <Text size={1} weight="semibold">
                {accuracy}
              </Text>
            </Flex>

            {used.length > 0 && (
              <Stack space={2}>
                {used.map((t) => (
                  <Flex key={t.key} align="center" justify="space-between" gap={2}>
                    <Text size={1} style={{fontFamily: 'monospace'}}>
                      {`{{ ${t.key} }}`}
                    </Text>
                    <Badge
                      tone={t.mode === 'sample' ? 'positive' : 'caution'}
                      fontSize={0}
                      padding={1}
                      radius={1}
                    >
                      {t.mode === 'sample' ? 'sample' : 'send-time'}
                    </Badge>
                  </Flex>
                ))}
              </Stack>
            )}

            {tokens.some((t) => t.mode === 'not-used') && (
              <Card padding={3} radius={2} tone="transparent" border>
                <Stack space={1}>
                  <Label size={0} muted>
                    Unused previewContext tokens
                  </Label>
                  {tokens
                    .filter((t) => t.mode === 'not-used')
                    .map((t) => (
                      <Text key={t.key} size={0} muted style={{fontFamily: 'monospace'}}>
                        {`{{ ${t.key} }}`}
                      </Text>
                    ))}
                </Stack>
              </Card>
            )}
          </Stack>
        )}

        {!workflow && tokens.length === 0 && (
          <Text size={1} muted>
            No workflow state or preview context found.
          </Text>
        )}
      </Stack>
    </Box>
  )
}

export const PreviewStatusInspector = defineDocumentInspector({
  name: 'promotion-preview-status',
  useMenuItem() {
    return {title: 'Preview Status'}
  },
  component: PreviewStatusInspectorComponent,
})
