import {useCallback, useEffect, useRef, useState} from 'react'
import {
  type DocumentActionDescription,
  type DocumentActionProps,
  useClient,
  useDocumentOperation,
} from 'sanity'
import {SyncIcon} from '@sanity/icons'

type ImportState = 'idle' | 'requested' | 'importing' | 'imported' | 'error'

interface ImportResult {
  importState: ImportState
  segmentCount?: number
  importErrorMessage?: string
}

export function ImportFromKlaviyoAction(
  props: DocumentActionProps,
): DocumentActionDescription | null {
  const {id, type, published, draft} = props
  const doc = draft || published
  const client = useClient({apiVersion: '2026-04-08'})
  const {publish} = useDocumentOperation(id, type)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [polling, setPolling] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const importState = (doc?.importState as ImportState) ?? 'idle'
  const isImporting = importState === 'requested' || importState === 'importing'
  const isError = importState === 'error'

  const label = isImporting ? 'Syncing...' : isError ? 'Retry Sync' : 'Sync with Klaviyo'

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setPolling(false)
  }, [])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleImport = useCallback(async () => {
    setDialogOpen(false)
    setStatusMessage('Starting sync...')
    setPolling(true)

    const draftId = `drafts.${id}`
    await client.createIfNotExists({_id: draftId, _type: type} as any)
    await client.patch(draftId).set({importState: 'requested'}).commit()
    publish.execute()

    let elapsed = 0
    const interval = 2000
    const maxWait = 60000

    pollRef.current = setInterval(async () => {
      elapsed += interval
      if (elapsed > maxWait) {
        stopPolling()
        setStatusMessage('Sync timed out. Check the function logs.')
        return
      }

      try {
        const result = await client.fetch<ImportResult | null>(
          `*[_id == $id][0]{importState, segmentCount, importErrorMessage}`,
          {id},
        )

        if (!result) return

        if (result.importState === 'importing') {
          setStatusMessage('Syncing with Klaviyo...')
        } else if (result.importState === 'imported') {
          stopPolling()
          setStatusMessage(`Synced ${result.segmentCount ?? 0} segments`)
        } else if (result.importState === 'error') {
          stopPolling()
          setStatusMessage(result.importErrorMessage || 'Sync failed')
        }
      } catch {
        // transient fetch errors during polling are expected
      }
    }, interval)
  }, [client, id, type, publish, stopPolling])

  return {
    label,
    icon: SyncIcon,
    disabled: isImporting || polling,
    tone: isError ? 'caution' : undefined,
    onHandle: () => {
      setDialogOpen(true)
    },
    dialog: dialogOpen
      ? {
          type: 'confirm' as const,
          message: 'Sync segments from Klaviyo?',
          onCancel: () => setDialogOpen(false),
          onConfirm: handleImport,
        }
      : polling || statusMessage
        ? {
            type: 'dialog' as const,
            header: 'Klaviyo Sync',
            content: statusMessage,
            onClose: () => {
              stopPolling()
              setStatusMessage('')
            },
          }
        : null,
    'data-testid': 'import-klaviyo-btn',
  } as unknown as DocumentActionDescription
}
