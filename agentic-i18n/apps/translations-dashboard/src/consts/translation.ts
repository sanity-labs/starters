/**
 * Maximum number of translation jobs to run concurrently.
 *
 * Keeps agent-action throughput high while staying under API rate limits.
 * Used by useSelectiveTranslation, useBatchTranslationsWithProgress, and useRetranslateStale.
 */
export const MAX_CONCURRENT_TRANSLATIONS = 8
