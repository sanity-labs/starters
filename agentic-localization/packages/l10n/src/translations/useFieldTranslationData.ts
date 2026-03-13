/**
 * Realtime field × locale status derived from the document's inline array values.
 *
 * No `translation.metadata` document needed — field-level translations are stored
 * directly in the document as `internationalizedArray*` entries.
 *
 * Uses `documentStore.listenQuery()` for realtime updates — the inspector renders
 * outside the form context so `useFormValue` is not available.
 */

import {useMemo} from 'react'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, getDraftId, getPublishedId, useDocumentStore} from 'sanity'
import {useObservable} from 'react-rx'
import {of} from 'rxjs'
import type {InternationalizedArrayItem} from 'sanity-plugin-internationalized-array'

import type {InternationalizedFieldDescriptor} from '../fieldActions/useInternationalizedFields'
import type {Language} from './useLocales'

export type FieldLocaleStatus = 'filled' | 'empty'

export interface FieldTranslationSnapshot {
  fields: InternationalizedFieldDescriptor[]
  locales: Language[]
  /** field displayPath → locale id → status */
  matrix: Record<string, Record<string, FieldLocaleStatus>>
  /** field displayPath → source language id */
  sourceLanguages: Record<string, string>
  /** field displayPath → JSON.stringify of the source locale's current value */
  currentSourceValues: Record<string, string>
  documentId: string
}

function isNonEmpty(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  // For block content or other objects, existence is enough
  if (Array.isArray(value)) return value.length > 0
  return true
}

/**
 * Hook that derives the field × locale translation matrix from the live document.
 *
 * Reads each `internationalizedArray*` field's array entries and checks which
 * locales have non-empty values. Returns a snapshot that the inspector UI
 * can render directly.
 *
 * Only includes fields with `depth >= 0` (top-level and nested-in-object).
 * Array-of-objects fields (depth -1) are excluded.
 */
export function useFieldTranslationData(
  documentId: string,
  fields: InternationalizedFieldDescriptor[],
  locales: Language[],
): FieldTranslationSnapshot {
  const documentStore = useDocumentStore()
  const publishedId = getPublishedId(documentId)
  const draftId = getDraftId(documentId)

  const actionableFields = useMemo(
    () => fields.filter((f) => f.depth >= 0),
    [fields],
  )

  // Fetch both draft and published docs with only the i18n fields projected.
  // Client-side coalesce reduces from 2N to 2 index lookups in the query.
  const query = useMemo(() => {
    if (actionableFields.length === 0) return null
    const fields = actionableFields
      .map((f) => `"${f.displayPath}": ${f.path.join('.')}`)
      .join(', ')
    return `{ "draft": *[_id == $draftId][0]{ ${fields} }, "published": *[_id == $publishedId][0]{ ${fields} } }`
  }, [actionableFields])

  const doc$ = useMemo(
    () =>
      query
        ? documentStore.listenQuery(
            query,
            {draftId, publishedId},
            {...DEFAULT_STUDIO_CLIENT_OPTIONS, perspective: 'raw'},
          )
        : of(null),
    [documentStore, query, draftId, publishedId],
  )

  const rawValue = useObservable(doc$) as {
    draft?: Record<string, unknown> | null
    published?: Record<string, unknown> | null
  } | null | undefined

  return useMemo(() => {
    const matrix: Record<string, Record<string, FieldLocaleStatus>> = {}
    const sourceLanguages: Record<string, string> = {}
    const currentSourceValues: Record<string, string> = {}
    const draft = rawValue?.draft
    const published = rawValue?.published

    for (const field of actionableFields) {
      // Client-side coalesce: prefer draft over published
      const current = draft?.[field.displayPath] ?? published?.[field.displayPath]

      const entries = (Array.isArray(current) ? current : []) as InternationalizedArrayItem[]

      // Find source language — first entry with a non-empty value
      const sourceEntry = entries.find((e) => isNonEmpty(e.value))
      if (sourceEntry) {
        sourceLanguages[field.displayPath] = sourceEntry.language
        currentSourceValues[field.displayPath] = JSON.stringify(sourceEntry.value)
      }

      // Build per-locale status
      const localeStatuses: Record<string, FieldLocaleStatus> = {}
      for (const locale of locales) {
        const entry = entries.find((e) => e.language === locale.id)
        localeStatuses[locale.id] = entry && isNonEmpty(entry.value) ? 'filled' : 'empty'
      }
      matrix[field.displayPath] = localeStatuses
    }

    return {fields: actionableFields, locales, matrix, sourceLanguages, currentSourceValues, documentId}
  }, [actionableFields, locales, rawValue, documentId])
}
