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
import {of, type Observable} from 'rxjs'
import {defineQuery} from 'groq'
import type {FIELD_STALE_QUERY_RESULT} from '@starter/sanity-types'
import {createTranslationInspectorComponent} from './TranslationInspector'
import {useInternationalizedFields} from '../fieldActions/useInternationalizedFields'
import {readFlag} from './instanceFields'
import {useLocalizationInstance} from './workflowEngine'
import {resolveConfig, type TranslationsConfig} from '../core/types'
import {getFieldTranslationMetadataId} from '../core/fieldMetadataIds'
import {l10nLocaleNamespace} from '../i18n'

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
      const run = useRunBadge(documentId)
      const fieldStatus = useFieldTranslationBadge(documentId, hidden || !hasFieldLevel)

      const needsAttention = run.needsAttention || fieldStatus.hasStale
      const needsReview = run.inReview || fieldStatus.hasNeedsReview

      return {
        icon: TranslateIcon,
        showAsAction: true,
        title: needsAttention
          ? t('inspector.title.stale')
          : needsReview
            ? t('inspector.title.needs-review')
            : t('inspector.title'),
        tone: needsAttention ? 'suggest' : needsReview ? 'caution' : undefined,
        hidden,
      }
    },
  })
}

// --- Internal hooks ---

/**
 * The doc-tier badge, read off the open run's instance rather than off content.
 * `sourceChanged` and `hasFailedLocales` are the two advisory flags the run
 * surfaces; the `review` stage is the one that wants a person.
 */
function useRunBadge(documentId: string): {inReview: boolean; needsAttention: boolean} {
  const {instance} = useLocalizationInstance(documentId)
  if (!instance) return {inReview: false, needsAttention: false}
  return {
    inReview: instance.currentStage === 'review',
    needsAttention:
      readFlag(instance.fields, 'sourceChanged') || readFlag(instance.fields, 'hasFailedLocales'),
  }
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

  const fieldStatus$: Observable<FIELD_STALE_QUERY_RESULT | null> = useMemo(
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

  const result = useObservable(fieldStatus$)

  if (!result) return {hasStale: false, hasNeedsReview: false}
  return {hasStale: result.hasStaleEntries === true, hasNeedsReview: result.hasNeedsReview === true}
}
