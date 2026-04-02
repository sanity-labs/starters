import {type DocumentBadgeDescription, type DocumentBadgeProps} from 'sanity'

export function SyncStatusBadge(props: DocumentBadgeProps): DocumentBadgeDescription | null {
  const {type, published} = props
  const doc = published

  if (type === 'emailMessage') {
    const sendState = doc?.sendState as string | undefined
    if (sendState === 'sent') return {label: 'Sent', color: 'success'}
    if (sendState === 'sending' || sendState === 'requested')
      return {label: 'Sending\u2026', color: 'primary'}
    if (sendState === 'error') return {label: 'Send Error', color: 'danger'}
    return null
  }

  if (type === 'list' || type === 'audience') {
    const syncState = doc?.syncState as string | undefined
    if (syncState === 'synced') return {label: 'Synced', color: 'success'}
    if (syncState === 'syncing' || syncState === 'requested')
      return {label: 'Syncing\u2026', color: 'primary'}
    if (syncState === 'error') return {label: 'Sync Error', color: 'danger'}
    return null
  }

  return null
}
