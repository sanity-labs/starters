import {useEffect, useState} from 'react'
import {ResetIcon} from '@sanity/icons'
import {Box, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {type DocumentActionComponent, useClient} from 'sanity'
import {defineQuery} from 'groq'

const WORKFLOW_STATE_QUERY = defineQuery(`
  *[_type == "workflow.state" && promotionId._ref == $id][0]{_id, status}
`)

export const ResendAction: DocumentActionComponent = (props) => {
  const client = useClient({apiVersion: '2026-04-08'})
  const [state, setState] = useState<'idle' | 'confirm' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [workflowStatus, setWorkflowStatus] = useState<string | null | undefined>(undefined)

  const promotionId = props.id.replace(/^drafts\./, '')

  useEffect(() => {
    const query = `*[_type == "workflow.state" && promotionId._ref == $id][0].status`
    const params = {id: promotionId}
    client
      .fetch<string | null>(query, params, {tag: 'promotion.resend.fetch'})
      .then(setWorkflowStatus)
    const subscription = client
      .listen(query, params, {visibility: 'query', tag: 'promotion.resend.listen'})
      .subscribe(() => {
        client
          .fetch<string | null>(query, params, {tag: 'promotion.resend.fetch'})
          .then((status) => {
            setWorkflowStatus(status)
            if (status === 'sent') {
              setState((prev) => (prev === 'sending' ? 'done' : prev))
            }
          })
      })
    return () => subscription.unsubscribe()
  }, [client, promotionId])

  const onConfirm = async () => {
    setState('sending')

    try {
      const wfDoc = await client.fetch<{_id: string; status: string} | null>(
        WORKFLOW_STATE_QUERY,
        {id: promotionId},
        {tag: 'promotion.resend.fetch'},
      )

      if (!wfDoc) {
        setErrorMsg('Workflow state not found')
        setState('error')
        return
      }

      await client
        .patch(wfDoc._id)
        .set({status: 'approved', sentAt: null})
        .append('history', [
          {
            _key: `h-${Date.now()}`,
            _type: 'object',
            status: 'resent',
            timestamp: new Date().toISOString(),
          },
        ])
        .commit({tag: 'promotion.resend.write'})
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setState('error')
    }
  }

  const onClose = () => {
    setState('idle')
    setErrorMsg(null)
    props.onComplete()
  }

  const doc = props.published ?? props.draft
  if (!doc) return null

  // Stay visible while actively resending, even though status is no longer 'sent'
  const isResending = state === 'sending' || state === 'done' || state === 'error'
  if (workflowStatus !== 'sent' && !isResending) return null

  const dialogContent = () => {
    if (state === 'confirm') {
      return {
        type: 'confirm' as const,
        tone: 'caution' as const,
        message: 'Re-queue this promotion for send? It will be dispatched again.',
        onCancel: () => setState('idle'),
        onConfirm,
      }
    }

    if (isResending) {
      return {
        type: 'dialog' as const,
        header: 'Resend',
        onClose: state === 'sending' ? undefined : onClose,
        content: (
          <Box padding={4}>
            <Stack space={4}>
              {state === 'sending' && (
                <Flex align="center" gap={3}>
                  <Spinner muted />
                  <Text size={2} muted>
                    Re-sending promotion…
                  </Text>
                </Flex>
              )}
              {state === 'done' && (
                <Text size={2} style={{color: 'var(--card-positive-fg-color)'}}>
                  ✓ Promotion re-sent via Klaviyo.
                </Text>
              )}
              {state === 'error' && (
                <Text size={2} style={{color: 'var(--card-critical-fg-color)'}}>
                  Error: {errorMsg}
                </Text>
              )}
            </Stack>
          </Box>
        ),
      }
    }

    return null
  }

  return {
    label: 'Resend',
    icon: ResetIcon,
    tone: 'caution' as const,
    onHandle: () => setState('confirm'),
    dialog: dialogContent(),
  }
}
