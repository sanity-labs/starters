import type {LocalizedObject} from '@starter/l10n'

import {getFlagFromCode} from '@starter/l10n'
import {DocumentId, getPublishedId} from '@sanity/id-utils'
import {useQuery} from '@sanity/sdk-react'
import {defineQuery} from 'groq'
import {useMemo} from 'react'

import type {LocalizationRun} from '../lib/localizationRun'

import {useTranslationConfig} from '../contexts/TranslationConfigContext'
import {useL10nEngine} from './useL10nEngine'
import {useLocalizationRuns} from './useLocalizationRuns'

export type AggregateBaseDocument = {
  _id: string
  /** The revision a run's idempotency key is derived from. */
  _rev: string
  _type: string
  title: null | string
}

export type AggregateData = {
  baseDocuments: AggregateBaseDocument[]
  locales: AggregateLocale[]
  metadata: AggregateMetadata[]
  /** Open localization runs, keyed by the base document's own `_id`. */
  runs: Map<string, LocalizationRun>
}

export type AggregateLocale = {
  fallbackTag: null | string
  flag: string
  tag: string
  title: string
}

export type AggregateMetadata = {
  _id: string
  translations: TranslationMetadataEntry[]
}

export type TranslationMetadataEntry = LocalizedObject & {
  ref: string
}

const AGGREGATE_QUERY = defineQuery(`{
  "baseDocuments": *[
    _type in $docTypes
    && @[$languageField] == $defaultLanguage
  ]{ _id, _rev, _type, title },
  "metadata": *[_type == "translation.metadata"]{
    _id,
    translations[]{
      _key,
      language,
      "ref": value._ref
    }
  },
  "locales": *[_type == "l10n.locale"]{
    "tag": code,
    title,
    flag,
    "fallbackTag": fallback->code
  }
}`)

type AggregateQueryResult = Omit<AggregateData, 'runs'>

/** Build a fallback locale lookup: localeTag → fallbackLocaleTag */
export function buildFallbackMap(locales: AggregateLocale[]): Map<string, null | string> {
  const map = new Map<string, null | string>()
  for (const locale of locales) {
    map.set(locale.tag, locale.fallbackTag)
  }
  return map
}

export function buildMetadataLookup(
  baseDocuments: AggregateBaseDocument[],
  metadata: AggregateMetadata[],
): Map<string, AggregateMetadata> {
  const baseDocIds = new Set(baseDocuments.map((d) => d._id))
  const lookup = new Map<string, AggregateMetadata>()

  for (const meta of metadata) {
    if (!meta.translations) continue
    for (const t of meta.translations) {
      if (baseDocIds.has(t.ref)) {
        lookup.set(t.ref, meta)
        break
      }
    }
  }

  return lookup
}

/** A document's translations by locale tag. */
export function buildTranslationMap(
  meta: AggregateMetadata | undefined,
): Map<string, TranslationMetadataEntry> {
  const map = new Map<string, TranslationMetadataEntry>()
  for (const translation of meta?.translations ?? []) {
    map.set(translation.language, translation)
  }
  return map
}

export function useTranslationAggregateData(): {data: AggregateData; isPending: boolean} {
  const {defaultLanguage, translationsConfig} = useTranslationConfig()
  const engine = useL10nEngine()
  const {bySubject} = useLocalizationRuns(engine)

  const {data: rawData, isPending} = useQuery<AggregateQueryResult>({
    params: {
      defaultLanguage,
      docTypes: translationsConfig.internationalizedTypes,
      languageField: translationsConfig.languageField,
    },
    query: AGGREGATE_QUERY,
  })

  const data = useMemo(
    () => cleanAggregateData(rawData, defaultLanguage, bySubject),
    [rawData, defaultLanguage, bySubject],
  )

  return {data, isPending}
}

/**
 * Filter raw GROQ results and join the runs before derived hooks see them.
 *
 * A run's subject is always the published id; the query reads raw, so drafts and
 * release versions of the same document have to resolve back to it.
 */
function cleanAggregateData(
  raw: AggregateQueryResult,
  defaultLanguage: string,
  runsBySubject: Map<string, LocalizationRun>,
): AggregateData {
  const locales = raw.locales
    .filter((l) => l.tag !== defaultLanguage)
    .map((l) => ({...l, flag: l.flag || getFlagFromCode(l.tag)}))

  const baseDocIds = new Set(raw.baseDocuments.map((d) => d._id))
  const metadata = raw.metadata.filter((meta) => {
    if (!meta.translations) return false
    return meta.translations.some((t) => baseDocIds.has(t.ref))
  })

  const runs = new Map<string, LocalizationRun>()
  for (const doc of raw.baseDocuments) {
    const run = runsBySubject.get(getPublishedId(DocumentId(doc._id)))
    if (run) runs.set(doc._id, run)
  }

  return {baseDocuments: raw.baseDocuments, locales, metadata, runs}
}
