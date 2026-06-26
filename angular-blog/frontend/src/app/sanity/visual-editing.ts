import {enableVisualEditing, type HistoryRefresh} from '@sanity/visual-editing'
import type {SanityClient} from '@sanity/client'
import type {Router} from '@angular/router'
import {NavigationEnd} from '@angular/router'
import type {TransferState} from '@angular/core'
import {filter} from 'rxjs/operators'
import {DRAFT_MODE_KEY} from '../app.config'
import {getQueryStore} from './query-store'
import {isDraftModeBrowser} from './draft-mode.shared'

function refreshPreview(payload: HistoryRefresh): false | Promise<void> {
  if (payload.source === 'mutation' && payload.livePreviewEnabled) {
    return false
  }
  return Promise.resolve(window.location.reload())
}

let liveModeEnabled = false

export function isDraftModeActive(transferState: TransferState): boolean {
  return transferState.get(DRAFT_MODE_KEY, false) || isDraftModeBrowser()
}

export function ensureLiveMode(client: SanityClient, transferState?: TransferState): void {
  const draft = transferState ? isDraftModeActive(transferState) : isDraftModeBrowser()
  if (liveModeEnabled || !draft) return
  liveModeEnabled = true
  getQueryStore(client).enableLiveMode({client})
}

export function initVisualEditing(router: Router, transferState: TransferState): void {
  if (!isDraftModeActive(transferState)) return

  enableVisualEditing({
    zIndex: 1_000_000,
    refresh: refreshPreview,
    history: {
      subscribe: (navigate) => {
        const subscription = router.events
          .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
          .subscribe(() => {
            navigate({type: 'push', url: router.url})
          })
        return () => subscription.unsubscribe()
      },
      update: (update) => {
        switch (update.type) {
          case 'push':
          case 'replace':
            void router.navigateByUrl(update.url)
            return
          case 'pop':
            window.history.back()
            return
          default:
            throw new Error(`Unknown history update: ${JSON.stringify(update)}`)
        }
      },
    },
  })
}
