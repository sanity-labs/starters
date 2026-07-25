/**
 * The field-level localization tier.
 *
 * Two tiers share one set of workflow definitions. In the document tier
 * (`article`) each locale is its own document joined by `translation.metadata`.
 * In the field tier every locale lives in `internationalizedArray` fields on
 * the one document, so a run's children all write into their shared subject.
 *
 * The registry is static, for the same reason `SOURCE_LANGUAGE` is: an effect
 * handler runs inside a Function with no compiled Studio schema to walk, and
 * the definitions it serves are deployed artifacts. Add a type here when you
 * add internationalized fields to it.
 *
 * The item types are spelled out rather than taken from the plugin's
 * `isInternationalizedArrayItemType`: that guard tests a *type name*, this
 * module tests stored *values* — and importing the plugin would put `sanity` on
 * a Function's typecheck graph (see `core/types.ts`).
 */

import type {WorkflowPerspective} from '@sanity/workflow-engine'

import type {InternationalizedArrayItem} from './types'

import {get} from '@sanity/util/paths'

/** One `internationalizedArray` field on a field-tier document type. */
export interface InternationalizedField {
  /** Dot path to the array — `bio`, `seo.metaTitle`. */
  path: string
  /** `_type` of an array member, i.e. `internationalizedArray<Type>Value`. */
  itemType: InternationalizedArrayItem['_type']
  /**
   * Ancestor objects that have to exist before the array can be patched. A
   * Sanity patch does not create missing parents, so `seo.metaTitle` needs
   * `seo` set first.
   */
  containers: {path: string; value: {_type: string}}[]
}

const SEO: InternationalizedField['containers'] = [{path: 'seo', value: {_type: 'seo'}}]

const FIELD_TIER: Record<string, InternationalizedField[]> = {
  person: [
    {path: 'bio', itemType: 'internationalizedArrayTextValue', containers: []},
    {path: 'seo.metaTitle', itemType: 'internationalizedArrayStringValue', containers: SEO},
    {path: 'seo.metaDescription', itemType: 'internationalizedArrayTextValue', containers: SEO},
  ],
  'l10n.uiStrings': [
    {path: 'siteTitle', itemType: 'internationalizedArrayStringValue', containers: []},
    {path: 'siteTagline', itemType: 'internationalizedArrayTextValue', containers: []},
    {path: 'articlesHeading', itemType: 'internationalizedArrayStringValue', containers: []},
    {path: 'emptyArticles', itemType: 'internationalizedArrayStringValue', containers: []},
    {path: 'backToArticles', itemType: 'internationalizedArrayStringValue', containers: []},
    {path: 'homeLabel', itemType: 'internationalizedArrayStringValue', containers: []},
    {path: 'architectureLabel', itemType: 'internationalizedArrayStringValue', containers: []},
    {path: 'fallbackNotice', itemType: 'internationalizedArrayTextValue', containers: []},
  ],
}

/** Every internationalized field on a document type; empty for the doc tier. */
export function internationalizedFields(documentType: string): InternationalizedField[] {
  return FIELD_TIER[documentType] ?? []
}

/** Every document type that localizes in place. */
export function fieldTierTypes(): string[] {
  return Object.keys(FIELD_TIER)
}

/** Whether a document type localizes in place rather than one doc per locale. */
export function isFieldTier(documentType: string): boolean {
  return internationalizedFields(documentType).length > 0
}

/**
 * The read perspective a standalone run of `documentType` starts under.
 *
 * A field-tier run writes its translations into the subject's own draft, and
 * the engine hydrates drafts by default — so `$fields.subject._rev` would move
 * on every child write and the `source-changed` trigger would fire on the
 * run's own output. Reading the published layer isolates the run from itself:
 * the revision only moves when someone actually publishes the source.
 *
 * The document tier keeps the default; its children write sibling documents,
 * which never touch the subject's revision. A campaign-spawned run inherits
 * the campaign's perspective and writes release versions, which the default
 * `drafts` perspective does not see either.
 */
export function startPerspectiveFor(documentType: string): WorkflowPerspective | undefined {
  return isFieldTier(documentType) ? 'published' : undefined
}

/** The entries of one internationalized array, tolerating an absent field. */
export function entriesOf(
  document: Record<string, unknown>,
  field: InternationalizedField,
): InternationalizedArrayItem[] {
  const value = get(document, field.path)
  if (!Array.isArray(value)) return []
  return value.filter(isEntry)
}

/** The entry carrying content for `language`, if it has any. */
export function entryFor(
  document: Record<string, unknown>,
  field: InternationalizedField,
  language: string,
): InternationalizedArrayItem | undefined {
  return entriesOf(document, field).find(
    (entry) => entry.language === language && entry.value != null && entry.value !== '',
  )
}

/**
 * Which locales the document is translated into.
 *
 * The field tier has no join document to read coverage from, so it derives:
 * a locale counts as covered only when EVERY internationalized field carries
 * a value for it. A half-translated locale is not a translation.
 */
export function coveredLocales(
  document: Record<string, unknown>,
  fields: InternationalizedField[],
): string[] {
  if (fields.length === 0) return []

  const [first, ...rest] = fields
  const covered = entriesOf(document, first)
    .filter((entry) => entry.value != null && entry.value !== '')
    .map((entry) => entry.language)

  return covered.filter((language) => rest.every((field) => entryFor(document, field, language)))
}

/**
 * The document reduced to its source-locale values, keyed by field path.
 *
 * The projection the analysis diffs two revisions of. Diffing whole documents
 * cannot work here: a field-tier subject holds its own translations, so
 * approving a run and publishing it looks like a material source edit and the
 * next analysis starts the same run again, forever.
 */
export function sourceProjection(
  document: Record<string, unknown>,
  fields: InternationalizedField[],
  language: string,
): Record<string, unknown> {
  const projection: Record<string, unknown> = {}
  for (const field of fields) {
    projection[field.path] = entryFor(document, field, language)?.value
  }
  return projection
}

function isEntry(value: unknown): value is InternationalizedArrayItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'language' in value &&
    typeof value.language === 'string'
  )
}
