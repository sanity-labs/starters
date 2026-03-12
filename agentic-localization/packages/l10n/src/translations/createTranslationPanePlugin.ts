import {TranslateIcon} from '@sanity/icons'
import {useMemo} from 'react'
import {
  DEFAULT_STUDIO_CLIENT_OPTIONS,
  defineDocumentInspector,
  type DocumentInspector,
  getPublishedId,
  useDocumentStore,
} from 'sanity'
import {useObservable} from 'react-rx'
import {of} from 'rxjs'
import {defineQuery} from 'groq'
import {createTranslationInspectorComponent} from './TranslationInspector'
import {
  resolveConfig,
  type ResolvedTranslationsConfig,
  type TranslationsConfig,
} from '../core/types'

const STALE_STATUS_QUERY = defineQuery(`*[
  _type == "translation.metadata"
  && references($publishedId)
][0]{
  "isSourceDoc": translations[language == $defaultLanguage][0].value._ref == $publishedId,
  "hasStaleEntries": count(workflowStates[status == "stale"]) > 0
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
      const hidden = !resolved.internationalizedTypes.includes(documentType)
      const hasStale = useHasStaleTranslations(documentId, hidden, resolved)

      return {
        icon: TranslateIcon,
        showAsAction: true,
        title: hasStale
          ? 'The source document for this translation has been updated'
          : 'Translations',
        tone: hasStale ? 'caution' : undefined,
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
