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

  const validate = useCallback(async () => {
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
          "campaigns": *[_type == "campaign" && email._ref == ^._id]{
            _id,
            title,
            "lists": lists[]->{_id, externalId, name},
            "includedSegments": includedSegments[]->{_id, externalId, name},
            "excludedSegments": excludedSegments[]->{_id, externalId, name},
          },
        }`,
        {id, draftId: `drafts.${id}`},
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
  }, [client, id])

  useEffect(() => {
    if (!dialogOpen) return
    validate()
  }, [dialogOpen, validate])

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
