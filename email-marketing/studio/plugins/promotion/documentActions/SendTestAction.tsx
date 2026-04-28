import {useEffect, useState} from 'react'
import {EnvelopeIcon} from '@sanity/icons'
import {Box, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {type DocumentActionComponent, useClient} from 'sanity'
import {defineQuery} from 'groq'

const TEST_SEND_STATE_QUERY = defineQuery(`
  *[_type == "promotion" && _id == $id][0].testSend
`)

type TestSendState = {
  status?: 'requested' | 'sending' | 'sent' | 'error' | null
  sentAt?: string | null
  sentTo?: string | null
  errorMessage?: string | null
} | null

export const SendTestAction: DocumentActionComponent = (props) => {
  const client = useClient({apiVersion: '2026-04-08'})
  const [uiState, setUiState] = useState<
    'idle' | 'confirm' | 'requesting' | 'pending' | 'done' | 'error'
  >('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [latest, setLatest] = useState<TestSendState>(null)

  const promotionId = props.id.replace(/^drafts\./, '')

  useEffect(() => {
    if (uiState !== 'pending') return
    const params = {id: promotionId}
    const subscription = client
      .listen(TEST_SEND_STATE_QUERY, params, {visibility: 'query'})
      .subscribe(() => {
        client.fetch<TestSendState>(TEST_SEND_STATE_QUERY, params).then((next) => {
          setLatest(next)
          if (next?.status === 'sent') setUiState('done')
          else if (next?.status === 'error') {
            setErrorMsg(next.errorMessage ?? 'Send failed')
            setUiState('error')
          }
        })
      })
    return () => subscription.unsubscribe()
  }, [client, promotionId, uiState])

  const onHandle = () => setUiState('confirm')

  const onConfirm = async () => {
    setUiState('requesting')
    try {
      await client
        .patch(promotionId)
        .set({
          testSend: {
            status: 'requested',
            requestedAt: new Date().toISOString(),
            errorMessage: null,
          },
        })
        .commit()
      setUiState('pending')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setUiState('error')
    }
  }

  const dialog =
    uiState === 'confirm'
      ? {
          type: 'confirm' as const,
          tone: 'caution' as const,
          message:
            "Send a test email for this promotion? Goes to RESEND_TEST_TO (defaults to delivered@resend.dev — Resend's simulation address). Bypasses approval workflow and segment targeting.",
          onCancel: () => setUiState('idle'),
          onConfirm,
        }
      : uiState === 'requesting' ||
          uiState === 'pending' ||
          uiState === 'done' ||
          uiState === 'error'
        ? {
            type: 'dialog' as const,
            header: 'Send test email',
            onClose: () => setUiState('idle'),
            content: (
              <Stack space={3} padding={4}>
                {(uiState === 'requesting' || uiState === 'pending') && (
                  <Flex align="center" gap={3}>
                    <Spinner muted />
                    <Text>
                      {uiState === 'requesting'
                        ? 'Queueing test send…'
                        : 'Function is rendering and sending…'}
                    </Text>
                  </Flex>
                )}
                {uiState === 'done' && (
                  <Box>
                    <Text size={2} style={{color: 'var(--card-positive-fg-color)'}}>
                      ✓ Test email sent to {latest?.sentTo ?? 'the configured test address'}.
                    </Text>
                    {latest?.sentTo === 'delivered@resend.dev' && (
                      <Text muted size={1} style={{marginTop: 8}}>
                        delivered@resend.dev simulates delivery — check the Resend dashboard logs to
                        confirm. No real inbox receives the email.
                      </Text>
                    )}
                  </Box>
                )}
                {uiState === 'error' && (
                  <Text size={2} style={{color: 'var(--card-critical-fg-color)'}}>
                    ✗ {errorMsg ?? 'Test send failed'}
                  </Text>
                )}
              </Stack>
            ),
          }
        : null

  return {
    label: 'Send test email',
    icon: EnvelopeIcon,
    tone: 'primary',
    onHandle,
    dialog,
  }
}
