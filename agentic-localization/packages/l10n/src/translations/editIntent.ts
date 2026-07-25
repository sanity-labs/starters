/**
 * The `edit` intent behind every jump from the inspector into the editor.
 *
 * Perspective is a sticky search param, not an intent param: core resolves
 * document links the same way — the structure tool's copy-document-url and
 * comment-link handlers both pass `[['perspective', selectedReleaseId]]` as the
 * third argument to `resolveIntentLink`. A run that writes into a release has
 * to name it here, or the reviewer lands on the draft instead of the version
 * they were just comparing.
 */

import {DocumentId, getPublishedId} from '@sanity/id-utils'
import type {BaseIntentParams, SearchParam} from 'sanity/router'

export interface EditTarget {
  documentId: string
  /** Field to open the editor on, as a form path. */
  fieldName?: string
  /** Release the run writes into; the document opens in its perspective. */
  releaseName?: string
}

export interface EditIntent {
  params: BaseIntentParams
  searchParams: SearchParam[]
}

export function buildEditIntent(target: EditTarget, documentType: string): EditIntent {
  const {documentId, fieldName, releaseName} = target
  return {
    params: {
      id: getPublishedId(DocumentId(documentId)),
      type: documentType,
      ...(fieldName ? {path: fieldName} : {}),
    },
    searchParams: releaseName ? [['perspective', releaseName]] : [],
  }
}
