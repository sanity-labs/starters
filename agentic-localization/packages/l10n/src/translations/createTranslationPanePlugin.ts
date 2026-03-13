import {TranslateIcon} from '@sanity/icons'
import {useMemo} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  defineDocumentInspector,
  type DocumentInspector,
  getPublishedId,
  useDocumentStore,
  useTranslation,
} from 'sanity'
import {useObservable} from 'react-rx'
import {of} from 'rxjs'
import {defineQuery} from 'groq'
import {createTranslationInspectorComponent} from './TranslationInspector'
import {useInternationalizedFields} from '../fieldActions/useInternationalizedFields'
import {
  resolveConfig,
  type ResolvedTranslationsConfig,
  type TranslationsConfig,
} from '../core/types'
import {getFieldTranslationMetadataId} from '../core/fieldMetadataIds'
import {l10nLocaleNamespace} from '../i18n'

const STALE_STATUS_QUERY = defineQuery(`*[
  _type == "translation.metadata"
  && references($publishedId)
][0]{
  "isSourceDoc": translations[language == $defaultLanguage][0].value._ref == $publishedId,
  "hasStaleEntries": count(workflowStates[status == "stale"]) > 0
}`)

const FIELD_STALE_QUERY = defineQuery(`*[
  _type == "fieldTranslation.metadata"
  && _id == $fieldMetadataId
][0]{
  "hasStaleEntries": count(workflowStates[status == "stale"]) > 0,
  "hasNeedsReview": count(workflowStates[status == "needsReview"]) > 0
}`)

/**
 * Create a document inspector for the Translations panel.
 *
 * Registers a "Translations" button in the document toolbar that opens
 * an inspector panel showing per-locale translation status and actions.
 * The button is hidden for document types that are not internationalized.
 *
 * @example
 * ```ts
 * import {createTranslationInspector} from '@starter/l10n'
 *
 * const translationInspector = createTranslationInspector({
 *   internationalizedTypes: ['article', 'product'],
 *   defaultLanguage: 'en-US',
 * })
 *
 * export default defineConfig({
 *   document: {
 *     inspectors: (prev) => [translationInspector, ...prev],
 *   },
 * })
 * ```
 */
export function createTranslationInspector(config: TranslationsConfig): DocumentInspector {
  const resolved = resolveConfig(config)
  const InspectorComponent = createTranslationInspectorComponent(resolved)

  return defineDocumentInspector({
    name: 'translations',
    component: InspectorComponent,
    useMenuItem({documentId, documentType}) {
      const {t} = useTranslation(l10nLocaleNamespace)
      const isDocLevel = resolved.internationalizedTypes.includes(documentType)
      const i18nFields = useInternationalizedFields(documentType)
      const hasFieldLevel = i18nFields.length > 0
      const hidden = !isDocLevel && !hasFieldLevel
      const hasDocStale = useHasStaleTranslations(documentId, hidden || !isDocLevel, resolved)
      const fieldStatus = useFieldTranslationBadge(documentId, hidden || !hasFieldLevel)

      const hasStale = hasDocStale || fieldStatus.hasStale
      const hasNeedsReview = fieldStatus.hasNeedsReview

      return {
        icon: TranslateIcon,
        showAsAction: true,
        title: hasStale
          ? t('inspector.title.stale')
          : hasNeedsReview
            ? t('inspector.title.needs-review')
            : t('inspector.title'),
        tone: hasStale ? 'caution' : hasNeedsReview ? 'caution' : undefined,
        hidden,
      }
    },
  })
}

// --- Internal hooks ---

/**
 * Lightweight realtime query to check if any locale has stale translations.
 * Uses `documentStore.listenQuery()` instead of manual fetch+listen+debounce.
 */
function useHasStaleTranslations(
  documentId: string,
  hidden: boolean,
  config: ResolvedTranslationsConfig,
): boolean {
  const documentStore = useDocumentStore()
  const publishedId = useMemo(() => getPublishedId(documentId), [documentId])

  const staleStatus$ = useMemo(
    () =>
      hidden
        ? of(null)
        : documentStore.listenQuery(
            STALE_STATUS_QUERY,
            {publishedId, defaultLanguage: config.defaultLanguage ?? ''},
            DEFAULT_STUDIO_CLIENT_OPTIONS,
          ),
    [documentStore, publishedId, hidden, config.defaultLanguage],
  )

  const result = useObservable(staleStatus$) as
    | {isSourceDoc: boolean; hasStaleEntries: boolean}
    | null
    | undefined

  if (!result) return false
  return !result.isSourceDoc && result.hasStaleEntries
}

/**
 * Lightweight realtime query to check if any field × locale has stale or needsReview status.
 * Uses `documentStore.listenQuery()` for realtime updates.
 */
function useFieldTranslationBadge(
  documentId: string,
  hidden: boolean,
): {hasStale: boolean; hasNeedsReview: boolean} {
  const documentStore = useDocumentStore()
  const fieldMetadataId = useMemo(
    () => getFieldTranslationMetadataId(getPublishedId(documentId)),
    [documentId],
  )

  const fieldStatus$ = useMemo(
    () =>
      hidden
        ? of(null)
        : documentStore.listenQuery(
            FIELD_STALE_QUERY,
            {fieldMetadataId},
            DEFAULT_STUDIO_CLIENT_OPTIONS,
          ),
    [documentStore, fieldMetadataId, hidden],
  )

  const result = useObservable(fieldStatus$) as
    | {hasStaleEntries: boolean; hasNeedsReview: boolean}
    | null
    | undefined

  if (!result) return {hasStale: false, hasNeedsReview: false}
  return {hasStale: result.hasStaleEntries, hasNeedsReview: result.hasNeedsReview}
}
