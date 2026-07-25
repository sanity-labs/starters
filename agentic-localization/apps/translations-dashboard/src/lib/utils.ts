import {DocumentId, getPublishedId} from '@sanity/id-utils'
import {type ClassValue, clsx} from 'clsx'
import {twMerge} from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strip `drafts.` / `versions.{releaseId}.` prefixes from a document ID
 * for human-readable display. Optionally truncates long IDs.
 */
export function formatDocId(docId: null | string, truncate = false): string {
  if (!docId) return 'Unknown document'
  const id = getPublishedId(DocumentId(docId))
  if (truncate && id.length > 40) return `${id.slice(0, 37)}...`
  return id
}
