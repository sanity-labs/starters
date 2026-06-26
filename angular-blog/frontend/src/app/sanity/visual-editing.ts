import {enableVisualEditing, type HistoryRefresh} from '@sanity/visual-editing'
import type {SanityClient} from '@sanity/client'
import {getQueryStore} from './query-store'
import {isDraftModeBrowser} from './draft-mode.shared'

function refreshPreview(payload: HistoryRefresh): false | Promise<void> {
  if (payload.source === 'mutation' && payload.livePreviewEnabled) {
    return false
  }
  return Promise.resolve(window.location.reload())
}

let liveModeEnabled = false

export function ensureLiveMode(client: SanityClient): void {
  if (liveModeEnabled || !isDraftModeBrowser()) return
  liveModeEnabled = true
  getQueryStore(client).enableLiveMode({client})
}

export function initVisualEditing(): void {
  if (!isDraftModeBrowser()) return

  enableVisualEditing({
    zIndex: 1_000_000,
    refresh: refreshPreview,
  })
}
