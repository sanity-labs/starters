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
  let id = docId
  if (id.startsWith('drafts.')) id = id.slice(7)
  if (id.startsWith('versions.')) {
    const parts = id.split('.')
    id = parts.slice(2).join('.')
  }
  if (truncate && id.length > 40) return `${id.slice(0, 37)}...`
  return id
}
