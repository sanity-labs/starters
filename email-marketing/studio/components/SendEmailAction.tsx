'use client'
import {useCallback, useEffect, useState} from 'react'
import {
  type DocumentActionDescription,
  type DocumentActionProps,
  useClient,
  useDocumentOperation,
} from 'sanity'
import {PlayIcon, SyncIcon} from '@sanity/icons'
import {requestSync} from '../utils/requestSync'

type ValidationResult = {
  valid: boolean
  message?: string
  syncTarget?: {id: string}
}

export function SendEmailAction(props: DocumentActionProps): DocumentActionDescription | null {
  const {id, type, published, draft} = props
  const doc = draft || published
  const client = useClient({apiVersion: '2025-05-08'})
  const {publish} = useDocumentOperation(id, type)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [validation, setValidation] = useState<ValidationResult>({valid: false})
  const [syncing, setSyncing] = useState(false)

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
          "list": campaign->list->{_id, externalId, name},
          "audience": audience->{_id, externalId, name},
          "audienceRef": audience._ref
        }`,
        {id, draftId: `drafts.${id}`},
      )

      if (!emailDoc?.list?.externalId) {
        setValidation({
          valid: false,
          message: `The list "${emailDoc?.list?.name ?? 'unknown'}" hasn't been synced to Klaviyo yet.`,
          syncTarget: emailDoc?.list?._id ? {id: emailDoc.list._id} : undefined,
        })
        return
      }

      if (emailDoc.audienceRef && !emailDoc.audience?.externalId) {
        setValidation({
          valid: false,
          message: `The audience "${emailDoc?.audience?.name ?? 'unknown'}" hasn't been synced to Klaviyo yet.`,
          syncTarget: emailDoc?.audience?._id ? {id: emailDoc.audience._id} : undefined,
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

  const handleSyncResource = useCallback(async () => {
    if (!validation.syncTarget || syncing) return
    setSyncing(true)
    try {
      const targetId = validation.syncTarget.id
      const doc = await client.getDocument(targetId)
      if (doc) {
        await requestSync(client, {id: targetId, document: doc})
      }
      // Poll until the Sanity Function completes the sync
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        const updated = await client.fetch(`*[_id == $id][0]{syncState, errorMessage}`, {
          id: targetId,
        })
        if (updated?.syncState === 'synced') {
          await validate()
          return
        }
        if (updated?.syncState === 'error') {
          setValidation({
            valid: false,
            message: updated.errorMessage || 'Sync failed. Please try again.',
          })
          return
        }
      }
      setValidation({
        valid: false,
        message: 'Sync is taking longer than expected. Close and try again.',
      })
    } finally {
      setSyncing(false)
    }
  }, [client, validation.syncTarget, syncing, validate])

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
          message: syncing
            ? 'Syncing to Klaviyo\u2026'
            : (validation.message ?? 'Checking prerequisites\u2026'),
          onCancel: syncing ? () => {} : () => setDialogOpen(false),
          onConfirm: validation.valid
            ? handleSend
            : validation.syncTarget
              ? handleSyncResource
              : () => setDialogOpen(false),
          ...(syncing
            ? {confirmButtonText: 'Syncing\u2026', confirmButtonIcon: SyncIcon}
            : validation.syncTarget && !validation.valid
              ? {confirmButtonText: 'Sync Now', confirmButtonIcon: SyncIcon}
              : {}),
        }
      : null,
  }
}
