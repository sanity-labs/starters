/**
 * Typed reads over a workflow instance's resolved field entries.
 *
 * The engine stores fields as a discriminated union keyed by `_type`, so every
 * read narrows rather than casts: a field that is not the kind the caller
 * expects reads as absent instead of as a wrong-typed value.
 */

import {parseGdr, type ResolvedFieldEntry} from '@sanity/workflow-engine'

export const MATERIALITIES = ['cosmetic', 'minor', 'material'] as const

export type Materiality = (typeof MATERIALITIES)[number]

/** A `{locale, reason}` row as written into `targetLocales` / `retranslateLocales`. */
export interface LocaleRequest {
  locale: string
  reason?: string
}

export type InstanceFields = readonly ResolvedFieldEntry[]

function entry(fields: InstanceFields, name: string): ResolvedFieldEntry | undefined {
  return fields.find((field) => field.name === name)
}

export function readText(fields: InstanceFields, name: string): string | null {
  const field = entry(fields, name)
  if (!field) return null
  if (field._type === 'string' || field._type === 'text') return field.value
  return null
}

export function readFlag(fields: InstanceFields, name: string): boolean {
  const field = entry(fields, name)
  if (!field || field._type !== 'boolean') return false
  return field.value === true
}

export function readProgress(fields: InstanceFields, name: string): number | null {
  const field = entry(fields, name)
  if (!field || field._type !== 'progress') return null
  return field.value
}

export function readMateriality(fields: InstanceFields): Materiality | null {
  const value = readText(fields, 'materiality')
  return MATERIALITIES.find((materiality) => materiality === value) ?? null
}

export function readLocaleRequests(fields: InstanceFields, name: string): LocaleRequest[] {
  const field = entry(fields, name)
  if (!field || field._type !== 'array') return []
  return field.value.flatMap((row) => {
    if (typeof row.locale !== 'string') return []
    return [{locale: row.locale, reason: typeof row.reason === 'string' ? row.reason : undefined}]
  })
}

/** The bare document id a `doc.ref` / `subject` field points at. */
export function readDocumentId(fields: InstanceFields, name: string): string | null {
  const field = entry(fields, name)
  if (!field) return null
  if (field._type !== 'doc.ref' && field._type !== 'subject') return null
  if (!field.value) return null
  return parseGdr(field.value.id).documentId
}

export function readReleaseName(fields: InstanceFields, name: string): string | null {
  const field = entry(fields, name)
  if (!field || field._type !== 'release.ref') return null
  return field.value?.releaseName ?? null
}
