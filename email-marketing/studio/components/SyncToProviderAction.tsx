'use client'
import {useCallback, useState} from 'react'
import {
  type DocumentActionDescription,
  type DocumentActionProps,
  useClient,
  useDocumentOperation,
} from 'sanity'
import {SyncIcon} from '@sanity/icons'

export function SyncToProviderAction(props: DocumentActionProps): DocumentActionDescription | null {
  const {id, type, published, draft} = props
  const doc = draft || published
  const client = useClient({apiVersion: '2025-05-08'})
  const {publish} = useDocumentOperation(id, type)
  const [dialogOpen, setDialogOpen] = useState(false)

  const syncState = doc?.syncState as string | undefined
  const isSyncing = syncState === 'syncing' || syncState === 'requested'
  const isSynced = syncState === 'synced'
  const isError = syncState === 'error'

  const label = isSyncing
    ? 'Syncing\u2026'
    : isError
      ? 'Retry Sync'
      : isSynced
        ? 'Re-sync to Klaviyo'
        : 'Sync to Klaviyo'

  const handleSync = useCallback(async () => {
    setDialogOpen(false)
    const draftId = `drafts.${id}`
    if (!draft) {
      await client.createIfNotExists({...published, _id: draftId} as any)
    }
    await client.patch(draftId).set({syncState: 'requested'}).commit()
    publish.execute()
  }, [client, draft, published, id, publish])

  if (!doc?.name) return null

  return {
    label,
    icon: SyncIcon,
    disabled: isSyncing,
    tone: isError ? 'caution' : undefined,
    onHandle: () => {
      setDialogOpen(true)
    },
    dialog: dialogOpen
      ? {
          type: 'confirm' as const,
          message: `Sync "${doc.name}" to Klaviyo?`,
          onCancel: () => setDialogOpen(false),
          onConfirm: handleSync,
        }
      : null,
  }
}
