/**
 * Typed reads over a workflow instance's resolved field entries.
 *
 * The engine stores fields as a discriminated union keyed by `_type`, so every
 * read narrows rather than casts: a field that is not the kind the caller
 * expects reads as absent instead of as a wrong-typed value.
 *
 * The narrowing readers are ours — the engine exports no `getInstanceField`.
 * Site resolution is not: a caller holding a whole instance gets the engine's
 * `resolveFieldEntry`, which owns scope resolution.
 */

import {
  extractDocumentId,
  isSingleDocRefEntry,
  resolveFieldEntry,
  type ResolvedFieldEntry,
  type WorkflowInstance,
} from '@sanity/workflow-engine'

export const MATERIALITIES = ['cosmetic', 'minor', 'material'] as const

export type Materiality = (typeof MATERIALITIES)[number]

/** A `{locale, reason}` row as written into `targetLocales` / `retranslateLocales`. */
export interface LocaleRequest {
  locale: string
  reason?: string
}

/**
 * Either a whole instance — resolved through the engine at workflow scope — or
 * the bare entries a projection carries.
 */
export type FieldSource = WorkflowInstance | readonly ResolvedFieldEntry[]

function entry(source: FieldSource, name: string): ResolvedFieldEntry | undefined {
  if ('fields' in source) return resolveFieldEntry(source, {scope: 'workflow', name})
  return source.find((field) => field.name === name)
}

export function readText(source: FieldSource, name: string): string | null {
  const field = entry(source, name)
  if (!field) return null
  if (field._type === 'string' || field._type === 'text') return field.value
  return null
}

export function readFlag(source: FieldSource, name: string): boolean {
  const field = entry(source, name)
  if (!field || field._type !== 'boolean') return false
  return field.value === true
}

export function readProgress(source: FieldSource, name: string): number | null {
  const field = entry(source, name)
  if (!field || field._type !== 'progress') return null
  return field.value
}

export function readMateriality(source: FieldSource): Materiality | null {
  const value = readText(source, 'materiality')
  return MATERIALITIES.find((materiality) => materiality === value) ?? null
}

export function readLocaleRequests(source: FieldSource, name: string): LocaleRequest[] {
  const field = entry(source, name)
  if (!field || field._type !== 'array') return []
  return field.value.flatMap((row) => {
    if (typeof row.locale !== 'string') return []
    return [{locale: row.locale, reason: typeof row.reason === 'string' ? row.reason : undefined}]
  })
}

/** The bare document id a `doc.ref` / `subject` field points at. */
export function readDocumentId(source: FieldSource, name: string): string | null {
  const field = entry(source, name)
  if (!field || !isSingleDocRefEntry(field)) return null
  if (!field.value) return null
  return extractDocumentId(field.value.id)
}

export function readReleaseName(source: FieldSource, name: string): string | null {
  const field = entry(source, name)
  if (!field || field._type !== 'release.ref') return null
  return field.value?.releaseName ?? null
}
