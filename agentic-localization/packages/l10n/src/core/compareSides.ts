/**
 * The two documents a locale's compare diffs, and where to edit each field.
 *
 * The document tier compares two documents: the translation the run wrote
 * against the one published under the same id. The field tier has no second
 * document — a locale's translation is one entry per internationalized array on
 * the subject itself — so both sides are reduced to that locale's values first,
 * keyed by field path. `computeFieldChanges` then treats either tier the same.
 *
 * The edit paths differ for the same reason. A document-tier field is reached
 * by its own name; a field-tier one is an array member, and the entries carry
 * generated keys (the handler commits with `autoGenerateArrayKeys`), so the form
 * path has to be read off the pending document rather than derived from the
 * locale.
 */

import {toString as pathToString} from '@sanity/util/paths'

import {entriesOf, internationalizedFields, sourceProjection} from './fieldTier'

export interface CompareSides {
  /** Left side of the diff — what readers see today. */
  published: Record<string, unknown>
  /** Right side — the draft or release version the run wrote. */
  pending: Record<string, unknown>
  /** Form path to open a field in the editor, keyed by its diff field name. */
  editPaths: Record<string, string>
}

export interface CompareSidesArgs {
  documentType: string
  /** Set for the field tier: the locale whose entries the run wrote. */
  locale?: string
  published: Record<string, unknown> | null
  pending: Record<string, unknown>
}

export function compareSides({
  documentType,
  locale,
  published,
  pending,
}: CompareSidesArgs): CompareSides {
  const fields = internationalizedFields(documentType)
  if (fields.length === 0 || locale === undefined) {
    return {published: published ?? {}, pending, editPaths: {}}
  }

  const editPaths: Record<string, string> = {}
  for (const field of fields) {
    const entry = entriesOf(pending, field).find((candidate) => candidate.language === locale)
    if (entry) {
      editPaths[field.path] = pathToString([...field.path.split('.'), {_key: entry._key}, 'value'])
    }
  }

  return {
    published: sourceProjection(published ?? {}, fields, locale),
    pending: sourceProjection(pending, fields, locale),
    editPaths,
  }
}
