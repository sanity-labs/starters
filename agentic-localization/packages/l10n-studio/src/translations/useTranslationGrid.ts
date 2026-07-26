/**
 * One subscription behind the whole grid.
 *
 * The matrix needs every target locale's published and pending values at once.
 * Mounting a `useEditState` per locale would open one EventSource per row, which
 * is the reconnection storm `L10nProvider` exists to prevent — so the document
 * tier joins the siblings into the metadata listener it already had, and the
 * field tier needs no join at all: its locales live in the subject, so one
 * `useEditState` on the subject already holds the entire grid.
 *
 * Both tiers land on the same `compareSides` + `computeFieldChanges` pair, which
 * is what makes one layout serve them: a row is a locale, a cell is a field, and
 * the tier only decides where the values were read from.
 */

import {defineQuery} from 'groq'
import {useMemo} from 'react'
import {useObservable} from 'react-rx'
import type {Observable} from 'rxjs'
import {DEFAULT_STUDIO_CLIENT_OPTIONS, getPublishedId, useDocumentStore, useEditState} from 'sanity'
import type {TRANSLATION_SIBLINGS_QUERY_RESULT} from '@starter/sanity-types'

import {
  compareSides,
  computeFieldChanges,
  getTranslationMetadataId,
  internationalizedFields,
  sourceProjection,
  type FieldChange,
  type LocaleRun,
} from '@starter/l10n'
import {
  buildGrid,
  charDelta,
  defersDiff,
  orderByImpact,
  type GridModel,
  type LocaleSnapshot,
} from './gridModel'

/** One field of one locale, as the detail pane renders it. */
export interface DetailField {
  change: FieldChange
  /** Form path that opens this field in the editor. */
  editPath: string
  /** Too heavy to render unasked — badge and count until the reviewer clicks. */
  deferred: boolean
  charDelta: number
}

export interface TranslationGrid {
  loading: boolean
  /** The `translation.metadata` join document, when the tier has one. */
  metadataId: string | null
  model: GridModel
  detail: ReadonlyMap<string, readonly DetailField[]>
  documentIdByLocale: ReadonlyMap<string, string>
  /**
   * Field tier only: a form path that lands on this locale's first entry, so
   * the row's `›` works even when nothing about the locale changed. The
   * document tier has a document to open instead.
   */
  anchors: ReadonlyMap<string, string>
}

export interface TranslationGridArgs {
  documentId: string
  documentType: string
  /** Every locale the workspace localizes into, source excluded. */
  targetLocales: readonly string[]
  /** The open run's per-locale rows, for the failed and queued states. */
  runs: readonly LocaleRun[]
  /** Set when the run writes into a release rather than a draft. */
  releaseName?: string
}

const TRANSLATION_SIBLINGS_QUERY = defineQuery(`*[
  _id == $metadataId || (
    _type == "translation.metadata"
    && references($publishedId)
  )
][0]{
  _id,
  "translations": translations[]{
    _key,
    language,
    "ref": value._ref,
    "published": *[_id == ^.value._ref][0],
    "pending": *[_id == $pendingPrefix + ^.value._ref][0]
  }
}`)

function pendingPrefixFor(releaseName: string | undefined): string {
  return releaseName ? `versions.${releaseName}.` : 'drafts.'
}

function detailFor(
  changes: readonly FieldChange[],
  editPaths: Record<string, string>,
): DetailField[] {
  return orderByImpact(changes.filter((change) => change.changed)).map((change) => ({
    change,
    editPath: editPaths[change.fieldName] ?? change.fieldName,
    deferred: defersDiff(change),
    charDelta: charDelta(change),
  }))
}

function stageByLocale(runs: readonly LocaleRun[]): Map<string, LocaleRun> {
  return new Map(runs.map((run) => [run.locale, run]))
}

function assemble(
  snapshots: readonly LocaleSnapshot[],
  columns: readonly string[] | undefined,
  detail: ReadonlyMap<string, readonly DetailField[]>,
  metadataId: string | null,
  documentIdByLocale: ReadonlyMap<string, string>,
  anchors: ReadonlyMap<string, string>,
  loading: boolean,
): TranslationGrid {
  return {
    loading,
    metadataId,
    model: buildGrid({locales: snapshots, columns}),
    detail,
    documentIdByLocale,
    anchors,
  }
}

const NO_ANCHORS: ReadonlyMap<string, string> = new Map()

/**
 * The document tier: one listener resolves the join document and, through it,
 * every sibling's published and pending revision.
 */
export function useDocumentTierGrid({
  documentId,
  targetLocales,
  runs,
  releaseName,
}: TranslationGridArgs): TranslationGrid {
  const documentStore = useDocumentStore()
  const publishedId = getPublishedId(documentId)
  const metadataId = getTranslationMetadataId(publishedId)
  const pendingPrefix = pendingPrefixFor(releaseName)

  const siblings$: Observable<TRANSLATION_SIBLINGS_QUERY_RESULT | null> = useMemo(
    () =>
      documentStore.listenQuery(
        TRANSLATION_SIBLINGS_QUERY,
        {metadataId, publishedId, pendingPrefix},
        DEFAULT_STUDIO_CLIENT_OPTIONS,
      ),
    [documentStore, metadataId, publishedId, pendingPrefix],
  )

  const metadata = useObservable(siblings$)

  return useMemo(() => {
    const byLocale = new Map(
      (metadata?.translations ?? []).flatMap((entry) =>
        entry.language && entry.ref ? [[entry.language, entry] as const] : [],
      ),
    )
    const documentIdByLocale = new Map(
      [...byLocale].flatMap(([locale, entry]) => (entry.ref ? [[locale, entry.ref]] : [])),
    )
    const stages = stageByLocale(runs)
    const detail = new Map<string, readonly DetailField[]>()

    const snapshots = targetLocales.map((locale): LocaleSnapshot => {
      const entry = byLocale.get(locale)
      const pending = entry?.pending ?? null
      const published = entry?.published ?? null
      const changes = pending
        ? computeFieldChanges(published ?? {}, pending).filter((change) => change.changed)
        : []

      detail.set(locale, detailFor(changes, {}))

      return {
        locale,
        stage: stages.get(locale)?.stage ?? null,
        absent: !entry,
        targetDocumentId: entry?.ref ?? null,
        changes,
        present: null,
      }
    })

    return assemble(
      snapshots,
      undefined,
      detail,
      metadata?._id ?? null,
      documentIdByLocale,
      NO_ANCHORS,
      metadata === undefined,
    )
    // `documentType` is unused here: a document-tier compare is whole documents.
  }, [metadata, runs, targetLocales])
}

/**
 * The field tier: no sibling to join, so the subject's own edit state is the
 * grid. Columns are the schema's internationalized fields rather than a
 * data-driven union, because a locale that is simply absent from one of them is
 * the half-coverage the reviewer most needs to see.
 */
export function useFieldTierGrid({
  documentId,
  documentType,
  targetLocales,
  runs,
  releaseName,
}: TranslationGridArgs): TranslationGrid {
  const publishedId = getPublishedId(documentId)
  const editState = useEditState(publishedId, documentType, 'default', releaseName)
  const {ready, published, draft, version} = editState

  return useMemo(() => {
    const fields = internationalizedFields(documentType)
    const columns = fields.map((field) => field.path)
    const pending = version ?? draft ?? published ?? null
    const stages = stageByLocale(runs)
    const detail = new Map<string, readonly DetailField[]>()
    const anchors = new Map<string, string>()

    const snapshots = targetLocales.map((locale): LocaleSnapshot => {
      if (!pending) {
        detail.set(locale, [])
        return {
          locale,
          stage: stages.get(locale)?.stage ?? null,
          absent: false,
          targetDocumentId: null,
          changes: [],
          present: new Set(),
        }
      }

      const sides = compareSides({documentType, locale, published, pending})
      const changes = computeFieldChanges(sides.published, sides.pending).filter(
        (change) => change.changed,
      )
      const projection = sourceProjection(pending, fields, locale)
      const present = new Set(
        Object.entries(projection).flatMap(([path, value]) =>
          value == null || value === '' ? [] : [path],
        ),
      )

      detail.set(locale, detailFor(changes, sides.editPaths))
      // Ordered by the schema, so the row's `›` always lands on the same entry.
      const anchor = columns.map((path) => sides.editPaths[path]).find(Boolean)
      if (anchor) anchors.set(locale, anchor)

      return {
        locale,
        stage: stages.get(locale)?.stage ?? null,
        absent: false,
        targetDocumentId: null,
        changes,
        present,
      }
    })

    return assemble(snapshots, columns, detail, null, new Map(), anchors, !ready)
  }, [documentType, targetLocales, runs, ready, published, draft, version])
}
