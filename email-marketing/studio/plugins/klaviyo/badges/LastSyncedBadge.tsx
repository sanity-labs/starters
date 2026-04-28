import type {DocumentBadgeComponent, DocumentBadgeDescription} from 'sanity'

type ImportState = 'idle' | 'requested' | 'importing' | 'imported' | 'error'

type KlaviyoImportDoc = {
  importState?: ImportState
  lastImportedAt?: string
}

const STATE_COLOR: Record<ImportState, DocumentBadgeDescription['color']> = {
  idle: 'default',
  requested: 'primary',
  importing: 'primary',
  imported: 'success',
  error: 'danger',
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'unknown'
  const diff = Math.max(0, Date.now() - then)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const days = Math.floor(hr / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export const LastSyncedBadge: DocumentBadgeComponent = (props) => {
  const doc = (props.published ?? props.draft) as KlaviyoImportDoc | null
  const state = doc?.importState ?? 'idle'
  const lastImportedAt = doc?.lastImportedAt

  if (state === 'requested' || state === 'importing') {
    return {
      label: 'Syncing…',
      color: 'primary',
      title: 'Sync with Klaviyo in progress',
    }
  }

  if (state === 'error') {
    return {
      label: 'Sync failed',
      color: 'danger',
      title: 'Last sync attempt failed',
    }
  }

  if (!lastImportedAt) {
    return {
      label: 'Never synced',
      color: 'default',
      title: 'No sync has run yet',
    }
  }

  return {
    label: `Synced ${formatRelative(lastImportedAt)}`,
    color: STATE_COLOR[state],
    title: `Last synced at ${new Date(lastImportedAt).toLocaleString()}`,
  }
}
