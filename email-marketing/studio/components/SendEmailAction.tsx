'use client'
import {useCallback, useEffect, useState} from 'react'
import {
  type DocumentActionDescription,
  type DocumentActionProps,
  useClient,
  useDocumentOperation,
} from 'sanity'
import {PlayIcon} from '@sanity/icons'

type ValidationResult = {
  valid: boolean
  message?: string
}

export function SendEmailAction(props: DocumentActionProps): DocumentActionDescription | null {
  const {id, type, published, draft} = props
  const doc = draft || published
  const client = useClient({apiVersion: '2025-05-08'})
  const {publish} = useDocumentOperation(id, type)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [validation, setValidation] = useState<ValidationResult>({valid: false})

  const status = doc?.status as string | undefined
  const sendState = doc?.sendState as string | undefined
  const isSending = sendState === 'sending' || sendState === 'requested'
  const isSent = sendState === 'sent'
  const isError = sendState === 'error'

  useEffect(() => {
    if (!dialogOpen) return
    async function validate() {
      try {
        const settings = await client.fetch(`*[_type == "emailSettings"][0]{fromEmail, fromLabel}`)
        if (!settings?.fromEmail || !settings?.fromLabel) {
          setValidation({
            valid: false,
            message:
              'Email Settings must be configured first. Go to Email Settings in the sidebar and set your From Email and From Name.',
          })
          return
        }

        const emailDoc = await client.fetch(
          `*[_id == $id || _id == $draftId][0]{
            subject,
            "list": campaign->list->{externalId, name},
            "audience": audience->{externalId, name},
            "audienceRef": audience._ref
          }`,
          {id, draftId: `drafts.${id}`},
        )

        if (!emailDoc?.list?.externalId) {
          setValidation({
            valid: false,
            message: `The list "${emailDoc?.list?.name ?? 'unknown'}" hasn't been synced to Klaviyo yet. Go to Subscribers \u2192 Lists, open it, and click "Sync to Klaviyo".`,
          })
          return
        }

        if (emailDoc.audienceRef && !emailDoc.audience?.externalId) {
          setValidation({
            valid: false,
            message: `The audience "${emailDoc?.audience?.name ?? 'unknown'}" hasn't been synced to Klaviyo yet. Go to Subscribers \u2192 Audiences, open it, and click "Sync to Klaviyo".`,
          })
          return
        }

        if (!emailDoc.subject) {
          setValidation({
            valid: false,
            message: 'Email must have a subject line.',
          })
          return
        }

        const target = emailDoc.audience?.name ?? emailDoc.list?.name ?? 'unknown'
        setValidation({valid: true, message: `Send to ${target}?`})
      } catch {
        setValidation({
          valid: false,
          message: 'Failed to validate prerequisites.',
        })
      }
    }
    validate()
  }, [dialogOpen, client, id])

  const handleSend = useCallback(async () => {
    setDialogOpen(false)
    const draftId = `drafts.${id}`
    if (!draft) {
      await client.createIfNotExists({...published, _id: draftId} as any)
    }
    await client.patch(draftId).set({sendState: 'requested'}).commit()
    publish.execute()
  }, [client, draft, published, id, publish])

  const needsApproval = status !== 'approved' && status !== 'sent' && !isError && !isSent

  const label = isSending
    ? 'Sending\u2026'
    : isSent
      ? 'Sent \u2713'
      : isError
        ? 'Retry Send'
        : needsApproval
          ? 'Approve to Send'
          : 'Send Email'

  return {
    label,
    icon: PlayIcon,
    disabled: isSending || isSent || needsApproval,
    tone: isError ? 'caution' : isSent ? 'positive' : 'default',
    onHandle: () => {
      setDialogOpen(true)
    },
    dialog: dialogOpen
      ? {
          type: 'confirm' as const,
          message: validation.message ?? 'Checking prerequisites\u2026',
          onCancel: () => setDialogOpen(false),
          onConfirm: validation.valid ? handleSend : () => setDialogOpen(false),
        }
      : null,
  }
}
