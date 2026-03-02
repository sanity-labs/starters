/**
 * Shared types for the Translations plugin.
 *
 * Consumed by both Surface 1 (SDK Dashboard) and Surface 2 (Document Pane).
 * Lives in `packages/shared/` so neither surface owns the definition.
 */

/**
 * Configuration for the translations system.
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
 * Resolved config with defaults applied.
 * Used internally — consumers pass `TranslationsConfig`, internals use this.
 */
export interface ResolvedTranslationsConfig {
  internationalizedTypes: readonly string[]
  defaultLanguage: string | undefined
  languageField: string
}

/**
 * Persistent workflow statuses — where a translation is in the review workflow.
 * These are stored in `workflowStates` on the `translation.metadata` document.
 */
export type TranslationWorkflowStatus =
  | 'missing'
  | 'usingFallback'
  | 'needsReview'
  | 'approved'
  | 'stale'

/**
 * Sanity document lifecycle state — draft, published, version, or nonexistent.
 * Derived from querying which document IDs exist.
 */
export type DocumentState = 'none' | 'draft' | 'published' | 'inRelease'

/**
 * Transient in-flight states — what's happening right now during an active operation.
 * These appear during translation operations and are not persisted.
 */
export type TranslationInFlightStatus = 'translating' | 'failed'

/**
 * Union of all possible translation statuses (workflow + in-flight + legacy document-lifecycle).
 */
export type TranslationStatus =
  | TranslationWorkflowStatus
  | TranslationInFlightStatus
  | LegacyDocumentStatus

/**
 * Legacy document-lifecycle statuses used by the SDK dashboard aggregate views.
 * These map to `DocumentState` conceptually but are preserved for backward compat
 * with existing dashboard components that call `getStatusDisplay()`.
 * @deprecated Prefer `TranslationWorkflowStatus` + `DocumentState` for new code.
 */
export type LegacyDocumentStatus = 'draft' | 'inRelease' | 'missingWithFallback' | 'published'

/**
 * @deprecated Use `TranslationWorkflowStatus` instead. This alias exists for backward compat.
 */
export type TranslationDataStatus = TranslationWorkflowStatus | LegacyDocumentStatus

/**
 * Shape of a single entry in the `workflowStates` array on `translation.metadata`.
 * Each item is keyed by locale ID via the `_key` field (e.g., `_key: 'es-MX'`).
 */
export interface WorkflowStateEntry {
  _key: string
  status: TranslationWorkflowStatus
  source?: 'ai' | 'manual'
  updatedAt?: string
  reviewedBy?: string
  /** The `_rev` of the base-language document at the time of translation. */
  sourceRevision?: string
  /** The `_rev` of the base-language document that triggered staleness. */
  staleSourceRev?: string
}

// ---------------------------------------------------------------------------
// AI Stale Change Analysis types
// ---------------------------------------------------------------------------

/** AI analysis of stale source changes — what changed and whether it matters. */
export interface StaleAnalysisResult {
  /** Combined explanation: what changed and whether it matters for translations (2-3 sentences) */
  explanation: string
  /** Overall impact assessment */
  materiality: 'cosmetic' | 'minor' | 'material'
  /** @deprecated Use `explanation` — kept for backward compat with cached data */
  summary?: string
  /** @deprecated Use `explanation` — kept for backward compat with cached data */
  materialityExplanation?: string
  /** Per-field suggestions */
  suggestions: StaleAnalysisSuggestion[]
  /** Number of AI suggestions dropped due to hallucinated field names (R5) */
  droppedSuggestionCount?: number
}

/**
 * Reason codes categorizing the nature of a source change.
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
  /** AI recommendation */
  recommendation: 'retranslate' | 'dismiss'
  /** Short, non-technical description of what changed (falls back to `explanation` if absent) */
  changeSummary?: string
  /** Structured reason code for the change */
  reasonCode?: SuggestionReasonCode
  /** Short editor-facing tags describing the impact (e.g. "Fact changed", "CTA added") */
  impactTags?: string[]
}

/** Pre-computed translation for a specific field + locale combination. */
export interface PreTranslatedSuggestion {
  /** Field path (matches suggestion.fieldName) */
  fieldName: string
  /** Target locale (e.g., 'es-MX') */
  localeId: string
  /** Pre-computed translated value — string for strings, PT blocks for PT fields */
  suggestedValue: unknown
}

/**
 * Per-locale record of which suggestion fields an editor has resolved (applied/skipped).
 * Stored on the metadata doc so progress survives navigation.
 * Keyed by `sourceRevision` — automatically stale when a new revision triggers staleness.
 */
export interface ReviewProgress {
  sourceRevision: string
  localeId: string
  fields: Record<string, 'applied' | 'skipped'>
}

/**
 * Cached analysis + pre-translations stored on `translation.metadata` doc.
 *
 * Top-level field because the analysis is about source changes (same for all locales).
 * Pre-translations cover ALL stale locales × changed fields so any locale's inspector
 * can read its values instantly without an LLM call.
 */
export interface StaleAnalysisCache {
  /** Cache key — must match current `staleSourceRev` to be valid */
  sourceRevision: string
  /** ISO timestamp of when analysis was performed */
  analyzedAt: string
  /** The AI analysis result */
  result: StaleAnalysisResult
  /** Pre-computed translations for ALL locales × changed fields */
  preTranslations: PreTranslatedSuggestion[]
  /** Per-locale review progress — survives navigation */
  reviewProgress?: ReviewProgress[]
}

/**
 * Convert a `workflowStates` array into a locale-keyed map for O(1) lookups.
 *
 * Handles both the correct array shape `[{_key, ...}]` and the legacy object
 * shape `{localeId: {...}}` written by a bug in the `client.create` path
 * before this was fixed. Existing metadata documents in the wild may still
 * have the object shape until they are re-translated.
 */
export function workflowStatesToMap(
  states:
    | Array<Partial<WorkflowStateEntry> & {_key: string}>
    | Record<string, Omit<WorkflowStateEntry, '_key'>>
    | null
    | undefined,
): Record<string, WorkflowStateEntry> {
  const map: Record<string, WorkflowStateEntry> = {}
  if (!states) return map

  // Correct shape: array of keyed entries
  if (Array.isArray(states)) {
    for (const entry of states) {
      if (entry.status) map[entry._key] = entry as WorkflowStateEntry
    }
    return map
  }

  // Legacy shape: plain object keyed by localeId (created before fix)
  if (typeof states === 'object') {
    for (const [key, entry] of Object.entries(states)) {
      // TS can't infer full type from spread + Omit — assertion is safe here
      map[key] = {_key: key, ...entry} as WorkflowStateEntry
    }
    return map
  }

  return map
}

/**
 * Per-locale translation info for a single document.
 */
export interface LocaleTranslation {
  /** Locale identifier (e.g., 'es-MX') */
  localeId: string
  /** Human-readable locale name (e.g., 'Spanish (Mexico)') */
  localeTitle: string
  /** Workflow status — where this translation is in the review lifecycle */
  translationStatus: TranslationWorkflowStatus
  /** Sanity document lifecycle state */
  documentState: DocumentState
  /** In-flight operation state, if an operation is in progress */
  inFlightStatus?: TranslationInFlightStatus
  /** ID of the translated document, if it exists */
  translatedDocumentId?: string
  /** Title of the translated document, if it exists */
  translatedDocumentTitle?: string
  /** Flag emoji for the locale */
  flag?: string
  /** Progress percentage (0-100) during translation */
  progress?: number
  /** Error message if translation failed */
  error?: string
  /** Name of the release this translation is in, if applicable */
  releaseName?: string
  /** Fallback locale ID (e.g., 'en-US') */
  fallbackLocale?: string
  /**
   * Whether the translated document is published.
   * @deprecated Inspect `documentState === 'published'` instead.
   */
  isPublished?: boolean
}

/**
 * Apply defaults to a partial TranslationsConfig.
 */
export function resolveConfig(config: TranslationsConfig): ResolvedTranslationsConfig {
  return {
    internationalizedTypes: config.internationalizedTypes,
    defaultLanguage: config.defaultLanguage,
    languageField: config.languageField ?? 'language',
  }
}
