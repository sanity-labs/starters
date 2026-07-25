/**
 * Consumed by every surface — the dashboard, the Studio pane and the effect
 * handlers — so it sits on the node floor and takes its types from
 * `@sanity/types` rather than `sanity`.
 */

import type {KeyedObject, Reference} from '@sanity/types'

import type {languageFieldName} from './typeNames'

/**
 * Passed to `createL10n()` and used by the SDK dashboard.
 */
export interface TranslationsConfig {
  /**
   * Document types that support document-level internationalization.
   * Only these types will show the "Translations" pane in Studio
   * and appear in the dashboard's document list.
   *
   * @example ['article', 'pressRelease', 'product']
   */
  internationalizedTypes: readonly string[]

  /**
   * The default/base language for content.
   * Falls back to the first locale returned by Sanity if not specified.
   *
   * @default undefined (resolved at runtime from locale documents)
   */
  defaultLanguage?: string

  /**
   * The field name used to store the document's language.
   * Must match the field name in your Sanity schema.
   *
   * @default 'language'
   */
  languageField?: string
}

/**
 * Used internally — consumers pass `TranslationsConfig`, internals use this.
 */
export interface ResolvedTranslationsConfig {
  internationalizedTypes: readonly string[]
  defaultLanguage: string | undefined
  languageField: string
}

/**
 * Persistent workflow statuses — where a translation is in the review workflow.
 * Derived from the localization run's instance state.
 */
export type TranslationWorkflowStatus =
  | 'missing'
  | 'usingFallback'
  | 'needsReview'
  | 'approved'
  | 'stale'

/**
 * Transient in-flight states — what's happening right now during an active operation.
 * These appear during translation operations and are not persisted.
 */
export type TranslationInFlightStatus = 'translating' | 'failed'

export type TranslationStatus = TranslationWorkflowStatus | TranslationInFlightStatus

/**
 * A keyed array item indexed by locale.
 * Extends `KeyedObject` (`_key`) with the language field name (`language`) that
 * `sanity-plugin-internationalized-array` writes and our schemas declare.
 */
export type LocalizedObject = KeyedObject & {[K in typeof languageFieldName]: string}

/**
 * A member of an `internationalizedArray` field, as
 * `sanity-plugin-internationalized-array` writes it.
 *
 * Declared here rather than imported from the plugin: a type-only import erases
 * before bundling, but the plugin's own `.d.ts` imports from `sanity`, so taking
 * it would put the whole Studio on this package's typecheck graph — and this
 * package typechecks as a Function dependency. `@starter/l10n-studio` holds a
 * bidirectional assignability test against the plugin's declaration, so a drift
 * between the two fails a build rather than a run.
 */
export interface InternationalizedArrayItem<T = unknown> {
  _key: string
  _type: `internationalizedArray${string}Value`
  language: string
  value?: T
}

/**
 * One row of a `translation.metadata` document — the locale-to-document join
 * `@sanity/document-internationalization` maintains. Same reasoning as above.
 */
export interface TranslationReference extends InternationalizedArrayItem<Reference> {
  _type: 'internationalizedArrayReferenceValue'
  value: Reference
}

/** AI analysis of stale source changes — what changed and whether it matters. */
export interface StaleAnalysisResult {
  /** Combined explanation: what changed and whether it matters for translations (2-3 sentences) */
  explanation: string
  materiality: 'cosmetic' | 'minor' | 'material'
  suggestions: StaleAnalysisSuggestion[]
  /** Number of AI suggestions dropped due to hallucinated field names (R5) */
  droppedSuggestionCount?: number
}

/**
 * Used to render editor-facing impact chips without parsing free-text explanations.
 */
export type SuggestionReasonCode =
  | 'fact_changed'
  | 'cta_changed'
  | 'tone_only'
  | 'formatting_only'
  | 'content_added'
  | 'content_removed'
  | 'date_or_number_changed'
  | 'other'

/** Per-field AI suggestion within a stale analysis. */
export interface StaleAnalysisSuggestion {
  /** Field path (matches FieldChange.fieldName) */
  fieldName: string
  /** 1-2 sentences about what changed in this field */
  explanation: string
  recommendation: 'retranslate' | 'dismiss'
  /** Short, non-technical description of what changed (falls back to `explanation` if absent) */
  changeSummary?: string
  reasonCode?: SuggestionReasonCode
  /** Short editor-facing tags describing the impact (e.g. "Fact changed", "CTA added") */
  impactTags?: string[]
}

export function resolveConfig(config: TranslationsConfig): ResolvedTranslationsConfig {
  return {
    internationalizedTypes: config.internationalizedTypes,
    defaultLanguage: config.defaultLanguage,
    languageField: config.languageField ?? 'language',
  }
}
