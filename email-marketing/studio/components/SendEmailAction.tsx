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
          "lists": campaign->lists[]->{_id, externalId, name},
          "includedSegments": includedSegments[]->{_id, externalId, name},
          "excludedSegments": excludedSegments[]->{_id, externalId, name},
          "campaignIncluded": campaign->includedSegments[]->{_id, externalId, name},
          "campaignExcluded": campaign->excludedSegments[]->{_id, externalId, name},
        }`,
        {id, draftId: `drafts.${id}`},
      )

      if (!emailDoc?.lists || emailDoc.lists.length === 0) {
        setValidation({
          valid: false,
          message: 'The campaign has no lists assigned.',
        })
        return
      }

      const listsWithoutExternal = emailDoc.lists.filter(
        (l: {externalId?: string}) => !l.externalId,
      )
      if (listsWithoutExternal.length > 0) {
        const names = listsWithoutExternal
          .map((l: {name?: string}) => l.name ?? 'unknown')
          .join(', ')
        setValidation({
          valid: false,
          message: `The following lists haven't been synced to Klaviyo yet: ${names}.`,
        })
        return
      }

      const effectiveIncluded = emailDoc.includedSegments?.length
        ? emailDoc.includedSegments
        : (emailDoc.campaignIncluded ?? [])
      const effectiveExcluded = emailDoc.excludedSegments?.length
        ? emailDoc.excludedSegments
        : (emailDoc.campaignExcluded ?? [])

      const allSegments = [...effectiveIncluded, ...effectiveExcluded]
      const unsyncedSegments = allSegments.filter((s: {externalId?: string}) => !s.externalId)
      if (unsyncedSegments.length > 0) {
        const names = unsyncedSegments.map((s: {name?: string}) => s.name ?? 'unknown').join(', ')
        setValidation({
          valid: false,
          message: `The following segments haven't been synced to Klaviyo yet: ${names}.`,
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

      const listNames = emailDoc.lists.map((l: {name?: string}) => l.name).join(', ')
      const segmentNames = effectiveIncluded.length
        ? effectiveIncluded.map((s: {name?: string}) => s.name).join(', ')
        : null
      const target = segmentNames ? `${segmentNames} (lists: ${listNames})` : listNames
      setValidation({valid: true, message: `Send to ${target}?`})
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
