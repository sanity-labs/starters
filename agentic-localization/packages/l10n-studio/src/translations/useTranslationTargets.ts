/**
 * The locale ↔ document map for a source document.
 *
 * `translation.metadata` is the document-internationalization plugin's join
 * document and genuine content state: which document holds which locale. Run
 * state is not read here — that lives on the workflow instance.
 */

import {defineQuery} from 'groq'
import {useMemo} from 'react'
import {useObservable} from 'react-rx'
import {of, type Observable} from 'rxjs'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, getPublishedId, useDocumentStore} from 'sanity'
import type {
  BASE_DOC_REF_QUERY_RESULT,
  TRANSLATION_TARGETS_QUERY_RESULT,
} from '@starter/sanity-types'

import {getTranslationMetadataId} from '@starter/l10n'

const TRANSLATION_TARGETS_QUERY = defineQuery(`*[
  _id == $metadataId || (
    _type == "translation.metadata"
    && references($publishedId)
  )
][0]{
  _id,
  "translations": translations[]{
    _key,
    language,
    "ref": value._ref
  }
}`)

const BASE_DOC_REF_QUERY = defineQuery(`*[
  _type == "translation.metadata"
  && (references($documentId) || references($publishedId))
][0].translations[language == $defaultLanguage][0].value._ref`)

export interface TranslationTargets {
  /** `undefined` while the metadata document is still resolving. */
  loading: boolean
  metadataId: string | null
  /** Locale id → the document holding that locale's translation. */
  documentIdByLocale: ReadonlyMap<string, string>
}

export function useTranslationTargets(documentId: string | undefined): TranslationTargets {
  const documentStore = useDocumentStore()
  const publishedId = documentId ? getPublishedId(documentId) : undefined
  const metadataId = publishedId ? getTranslationMetadataId(publishedId) : undefined

  const metadata$: Observable<TRANSLATION_TARGETS_QUERY_RESULT | null> = useMemo(
    () =>
      publishedId && metadataId
        ? documentStore.listenQuery(
            TRANSLATION_TARGETS_QUERY,
            {metadataId, publishedId},
            DEFAULT_STUDIO_CLIENT_OPTIONS,
          )
        : of(null),
    [documentStore, publishedId, metadataId],
  )

  const metadata = useObservable(metadata$)

  const documentIdByLocale = useMemo(() => {
    const map = new Map<string, string>()
    for (const translation of metadata?.translations ?? []) {
      if (translation.language && translation.ref) map.set(translation.language, translation.ref)
    }
    return map
  }, [metadata])

  return {loading: metadata === undefined, metadataId: metadata?._id ?? null, documentIdByLocale}
}

/**
 * Resolve the source-language document behind a translation, so the inspector
 * on a translated document can point back at the run.
 */
export function useBaseDocumentId(
  documentId: string | undefined,
  defaultLanguage: string | undefined,
  enabled: boolean,
): string | null | undefined {
  const documentStore = useDocumentStore()
  const publishedId = documentId ? getPublishedId(documentId) : undefined

  const baseDocId$: Observable<BASE_DOC_REF_QUERY_RESULT | null> = useMemo(
    () =>
      enabled && documentId && defaultLanguage && publishedId
        ? documentStore.listenQuery(
            BASE_DOC_REF_QUERY,
            {documentId, publishedId, defaultLanguage},
            DEFAULT_STUDIO_CLIENT_OPTIONS,
          )
        : of(null),
    [documentStore, documentId, publishedId, defaultLanguage, enabled],
  )

  return useObservable(baseDocId$)
}
