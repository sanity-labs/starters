/**
 * Opening things from the inspector without losing the inspector.
 *
 * Every jump out of this panel is a *sibling* pane, not a navigation: the
 * reviewer keeps the source document and the open inspector on the left and
 * reads the translation on the right, then closes it and is exactly where they
 * were. That is `usePaneRouter`'s child-pane shape — the same router state
 * `ChildLink` builds (`sanity/structure`, `PaneRouterProvider`):
 * `[...routerPanesState.slice(0, groupIndex + 1), [{id, params}]]`. Every
 * document pane carries `createDocumentChildResolver` as its default child, so a
 * child keyed by document id and `params.type` resolves into a real editor
 * without the structure needing to declare one.
 *
 * Two details the pane params carry:
 * - `path` is the form path the pane opens focused on, which is how the document
 *   pane turns a cell into "edit this field" (`params.path` → `fromString` →
 *   `openPath`).
 * - perspective is a *sticky* search param, never a pane param, so a run writing
 *   into a release passes it through `navigate`'s `stickyParams`.
 *
 * The field tier has nowhere to go: its locales live in the document already, so
 * the same jump is `setParams` on the current pane and the reviewer never leaves.
 *
 * Outside a structure pane the pane router is a stub with no pane state; there
 * the only honest move is the `edit` intent, which replaces the stack.
 */

import {DocumentId, getPublishedId} from '@sanity/id-utils'
import {useCallback} from 'react'
import {useRouter} from 'sanity/router'
import {usePaneRouter} from 'sanity/structure'

import {buildEditIntent, type EditTarget} from './editIntent'

export interface PaneTarget extends EditTarget {
  documentType: string
}

/** Open a document in a pane to the right of this one, keeping this one mounted. */
export function useOpenSiblingPane(): (target: PaneTarget) => void {
  const router = useRouter()
  const {routerPanesState, groupIndex} = usePaneRouter()

  return useCallback(
    (target: PaneTarget) => {
      const {documentId, documentType, fieldName, releaseName} = target

      if (routerPanesState.length === 0) {
        const {params, searchParams} = buildEditIntent(target, documentType)
        router.navigateUrl({path: router.resolveIntentLink('edit', params, searchParams)})
        return
      }

      router.navigate(
        {
          panes: [
            ...routerPanesState.slice(0, groupIndex + 1),
            [
              {
                id: getPublishedId(DocumentId(documentId)),
                params: {type: documentType, ...(fieldName ? {path: fieldName} : {})},
              },
            ],
          ],
        },
        releaseName ? {stickyParams: {perspective: releaseName}} : undefined,
      )
    },
    [router, routerPanesState, groupIndex],
  )
}

/** Focus a field in the pane this inspector belongs to — the field tier's jump. */
export function useFocusFieldInPane(): (fieldPath: string) => void {
  const {params, setParams, routerPanesState} = usePaneRouter()

  return useCallback(
    (fieldPath: string) => {
      if (routerPanesState.length === 0) return
      setParams({...params, path: fieldPath})
    },
    [params, setParams, routerPanesState],
  )
}
