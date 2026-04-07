'use client'
import {useCallback, useEffect, useState} from 'react'
import {
  type DocumentActionDescription,
  type DocumentActionProps,
  useClient,
  useDocumentOperation,
} from 'sanity'
import {PlayIcon, ResetIcon} from '@sanity/icons'

type ValidationResult = {
  valid: boolean
  message?: string
}

function waitForPublish(
  client: ReturnType<typeof useClient>,
  id: string,
  timeout = 10000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sub.unsubscribe()
      reject(new Error('Publish timed out'))
    }, timeout)

    const sub = client.listen(`*[_id == $id]`, {id}, {includeResult: false}).subscribe({
      next: () => {
        clearTimeout(timer)
        sub.unsubscribe()
        resolve()
      },
      error: (err) => {
        clearTimeout(timer)
        reject(err)
      },
    })
  })
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

  const validate = useCallback(async () => {
    try {
      // Publish first so validation runs against persisted data
      if (draft) {
        const published$ = waitForPublish(client, id)
        publish.execute()
        await published$
      }

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
        `*[_id == $id][0]{
          subject,
          "campaigns": *[_type == "campaign" && email._ref == $id]{
            _id,
            title,
            "lists": lists[]->{_id, externalId, name},
            "includedSegments": includedSegments[]->{_id, externalId, name},
            "excludedSegments": excludedSegments[]->{_id, externalId, name},
          },
        }`,
        {id},
      )

      if (!emailDoc?.campaigns || emailDoc.campaigns.length === 0) {
        setValidation({
          valid: false,
          message:
            'No campaigns reference this email. Create a campaign and assign this email first.',
        })
        return
      }

      for (const campaign of emailDoc.campaigns) {
        if (!campaign.lists || campaign.lists.length === 0) {
          setValidation({
            valid: false,
            message: `Campaign "${campaign.title}" has no lists assigned.`,
          })
          return
        }

        const unsyncedLists = campaign.lists.filter((l: {externalId?: string}) => !l.externalId)
        if (unsyncedLists.length > 0) {
          const names = unsyncedLists.map((l: {name?: string}) => l.name ?? 'unknown').join(', ')
          setValidation({
            valid: false,
            message: `Campaign "${campaign.title}" has lists not synced to Klaviyo: ${names}.`,
          })
          return
        }

        const allSegments = [
          ...(campaign.includedSegments ?? []),
          ...(campaign.excludedSegments ?? []),
        ]
        const unsyncedSegments = allSegments.filter((s: {externalId?: string}) => !s.externalId)
        if (unsyncedSegments.length > 0) {
          const names = unsyncedSegments.map((s: {name?: string}) => s.name ?? 'unknown').join(', ')
          setValidation({
            valid: false,
            message: `Campaign "${campaign.title}" has segments not synced to Klaviyo: ${names}.`,
          })
          return
        }
      }

      if (!emailDoc.subject) {
        setValidation({
          valid: false,
          message: 'Email must have a subject line.',
        })
        return
      }

      const campaignNames = emailDoc.campaigns.map((c: {title?: string}) => c.title).join(', ')
      setValidation({
        valid: true,
        message: `Send via ${emailDoc.campaigns.length} campaign${emailDoc.campaigns.length === 1 ? '' : 's'}: ${campaignNames}?`,
      })
    } catch {
      setValidation({
        valid: false,
        message: 'Failed to validate prerequisites.',
      })
    }
  }, [client, id, draft, publish])

  useEffect(() => {
    if (!dialogOpen) return
    validate()
  }, [dialogOpen, validate])

  const handleSend = useCallback(async () => {
    setDialogOpen(false)
    const draftId = `drafts.${id}`
    await client.createIfNotExists({...(draft || published), _id: draftId} as any)
    await client.patch(draftId).set({sendState: 'requested'}).commit()
    const published$ = waitForPublish(client, id)
    publish.execute()
    await published$
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

export function ResendEmailAction(props: DocumentActionProps): DocumentActionDescription | null {
  const {id, type, published, draft} = props
  const doc = draft || published
  const client = useClient({apiVersion: '2025-05-08'})
  const {publish} = useDocumentOperation(id, type)
  const [dialogOpen, setDialogOpen] = useState(false)

  const sendState = doc?.sendState as string | undefined
  const canResend = sendState === 'sent' || sendState === 'error'

  const handleResend = useCallback(async () => {
    setDialogOpen(false)
    const draftId = `drafts.${id}`
    await client.createIfNotExists({...(draft || published), _id: draftId} as any)
    await client.patch(draftId).set({sendState: 'requested', sendErrorMessage: ''}).commit()
    const published$ = waitForPublish(client, id)
    publish.execute()
    await published$
  }, [client, draft, published, id, publish])

  if (!canResend) return null

  return {
    label: sendState === 'error' ? 'Retry Send' : 'Resend Email',
    icon: ResetIcon,
    tone: 'default',
    onHandle: () => {
      setDialogOpen(true)
    },
    dialog: dialogOpen
      ? {
          type: 'confirm' as const,
          message:
            sendState === 'error'
              ? 'Retry sending this email to all associated campaigns?'
              : 'Resend this email to all associated campaigns? Recipients who already received it may get a duplicate.',
          onCancel: () => setDialogOpen(false),
          onConfirm: handleResend,
        }
      : null,
  }
}
