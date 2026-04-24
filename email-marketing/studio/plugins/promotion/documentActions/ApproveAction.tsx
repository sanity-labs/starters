import {useEffect, useState} from 'react'
import {CheckmarkIcon} from '@sanity/icons'
import {Box, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {type DocumentActionComponent, useClient} from 'sanity'
import {defineQuery} from 'groq'

const WORKFLOW_STATE_QUERY = defineQuery(`
  *[_type == "workflow.state" && promotionId._ref == $id][0]._id
`)

const WORKFLOW_STATUS_QUERY = defineQuery(`
  *[_type == "workflow.state" && promotionId._ref == $id][0].status
`)

export const ApproveAction: DocumentActionComponent = (props) => {
  const client = useClient({apiVersion: '2026-04-08'})
  const [state, setState] = useState<'idle' | 'confirm' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [workflowStatus, setWorkflowStatus] = useState<string | null | undefined>(undefined)

  const promotionId = props.id.replace(/^drafts\./, '')

  useEffect(() => {
    const params = {id: promotionId}
    client.fetch<string | null>(WORKFLOW_STATUS_QUERY, params).then(setWorkflowStatus)
    const subscription = client
      .listen(WORKFLOW_STATUS_QUERY, params, {visibility: 'query'})
      .subscribe(() => {
        client.fetch<string | null>(WORKFLOW_STATUS_QUERY, params).then(setWorkflowStatus)
      })
    return () => subscription.unsubscribe()
  }, [client, promotionId])

  const onHandle = () => setState('confirm')

  const onConfirm = async () => {
    setState('sending')

    try {
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

      setState('done')
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
  const isSending = state === 'sending' || state === 'done' || state === 'error'
  if ((workflowStatus === 'sent' || workflowStatus === 'approved') && !isSending) return null

  const dialogContent = () => {
    if (state === 'confirm') {
      return {
        type: 'confirm' as const,
        tone: 'positive' as const,
        message: 'Approve and send this promotion to Klaviyo?',
        onCancel: () => setState('idle'),
        onConfirm,
      }
    }

    if (state === 'sending' || state === 'done' || state === 'error') {
      return {
        type: 'dialog' as const,
        header: 'Approve & Send',
        onClose: state === 'sending' ? undefined : onClose,
        content: (
          <Box padding={4}>
            <Stack space={4}>
              {state === 'sending' && (
                <Flex align="center" gap={3}>
                  <Spinner muted />
                  <Text size={2} muted>
                    Approving and queuing for send…
                  </Text>
                </Flex>
              )}
              {state === 'done' && (
                <Text size={2} style={{color: 'var(--card-positive-fg-color)'}}>
                  ✓ Promotion approved and queued for send via Klaviyo.
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
    label: 'Approve & Send',
    icon: CheckmarkIcon,
    tone: 'positive' as const,
    onHandle,
    dialog: dialogContent(),
  }
}
