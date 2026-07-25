/**
 * `translate-locale` — one source document into one target locale.
 *
 * The context this assembles goes through `buildTranslateParams`, the same
 * function the eval suite calls. That is the point of the seam: if the runtime
 * assembled glossaries and style guides its own way, the evals would keep
 * proving quality for a path production does not take.
 *
 * Two tiers, one effect. The document tier writes a sibling document per
 * locale and joins them on `translation.metadata`; the field tier writes
 * entries into the subject's own `internationalizedArray` fields. Only the
 * write target differs — the context assembly above it is shared.
 */

import type {EffectHandler, FieldOp, GdrUri} from '@sanity/workflow-engine'

import {ClientError, isHttpError} from '@sanity/client'
import {DocumentId, getDraftId, getPublishedId, getVersionId} from '@sanity/id-utils'
import {extractDocumentId, stripSystemFields} from '@sanity/workflow-engine'

import type {InternationalizedField} from '../core/fieldTier'
import type {TranslationReference} from '../core/types'
import type {Glossary, StyleGuide} from '../prompts/promptAssembly'
import type {ContentClient, EffectContext} from './effectRuntime'

import {buildTranslateParams, filterGlossaryByContent} from '../prompts/promptAssembly'
import {
  GLOSSARIES_QUERY,
  LOCALES_BY_CODE_QUERY,
  STYLE_GUIDE_FOR_LOCALE_QUERY,
  TRANSLATIONS_FOR_DOCUMENT_QUERY,
} from '../prompts/queries'
import {entriesOf, entryFor, internationalizedFields} from '../core/fieldTier'
import {getTranslationMetadataId} from '../core/ids'
import {sanitizeTranslationValue} from '../core/sanitizeTranslationValue'
import {postProcessTranslation} from '../translate'
import {SOURCE_LANGUAGE} from '../workflows/config'
import {
  agentClient,
  contentClientFor,
  effectAlreadyDone,
  optionalRelease,
  optionalString,
  readSubjectDocument,
  requireGdr,
  requireString,
  siblingGdr,
} from './effectRuntime'

const SCHEMA_ID = '_.schemas.default'
const LANGUAGE_FIELD_PATH = 'language'
const METADATA_TYPE = 'translation.metadata'

type LocaleRow = {code: string; title: null | string}
type TranslationRow = {language: null | string; ref: null | string}

/** What a tier leaves behind: where the translation landed, and at which revision. */
interface TranslationWrite {
  machineRev: null | string
  targetPublishedId: string
}

/** Everything both tiers need, resolved once before the branch. */
interface TranslationJob {
  client: ContentClient
  ctx: EffectContext
  documentType: string
  glossaries: Glossary[]
  locale: string
  publishedSourceId: string
  release: null | {releaseName: string}
  revisionNote: null | string
  sourceDoc: Record<string, unknown>
  sourceLocale: {code: string; title: string}
  styleGuide: null | StyleGuide
  targetLocale: {code: string; title: string}
}

export const translateLocale: EffectHandler = async (params, ctx) => {
  if (await effectAlreadyDone(ctx)) {
    ctx.log('Translation already recorded for this effect key')
    return
  }

  const source = requireGdr(params, 'source')
  const locale = requireString(params, 'locale')
  const release = optionalRelease(params, 'release')
  const revisionNote = optionalString(params, 'revisionNote')

  const client = contentClientFor(ctx, source)
  const publishedSourceId = getPublishedId(DocumentId(extractDocumentId(source)))

  const [sourceDoc, glossaries, styleGuide, locales] = await Promise.all([
    readSubjectDocument(client, ctx, publishedSourceId),
    // `published`, explicitly. Prompt context is a two-human gate — a distilled
    // proposal has to be accepted AND published before it can steer a
    // translation — and the drafts half of that gate would otherwise rest on
    // whatever perspective the client happened to default to. The shared query
    // stays perspective-neutral: `L10nProvider` needs it draft-aware.
    client.fetch<Glossary[]>(
      GLOSSARIES_QUERY,
      {},
      {perspective: 'published', tag: 'get-glossaries'},
    ),
    client.fetch<null | StyleGuide>(
      STYLE_GUIDE_FOR_LOCALE_QUERY,
      {localeCode: locale},
      {perspective: 'published', tag: 'get-style-guide'},
    ),
    client.fetch<LocaleRow[]>(
      LOCALES_BY_CODE_QUERY,
      {codes: [locale, SOURCE_LANGUAGE]},
      {tag: 'get-locales'},
    ),
  ])

  if (!sourceDoc) throw new Error(`Source document ${publishedSourceId} not found`)

  const documentType = sourceDoc._type
  if (typeof documentType !== 'string') {
    throw new Error(`Source document ${publishedSourceId} has no _type`)
  }

  await ctx.setProgress('translationProgress', 10)

  const job: TranslationJob = {
    client,
    ctx,
    documentType,
    glossaries,
    locale,
    publishedSourceId,
    release,
    revisionNote,
    sourceDoc,
    sourceLocale: namedLocale(locales, SOURCE_LANGUAGE),
    styleGuide,
    targetLocale: namedLocale(locales, locale),
  }

  const fields = internationalizedFields(documentType)
  const {machineRev, targetPublishedId} =
    fields.length > 0 ? await translateInPlace(job, fields) : await translateIntoSibling(job)

  await ctx.setProgress('translationProgress', 100)

  const ops: FieldOp[] = [targetOp(siblingGdr(source, targetPublishedId), documentType)]
  // Absent only when the write was a no-op — a redelivery that found the
  // version it had already created. There is no revision of its own to record.
  if (machineRev) ops.push(machineRevOp(machineRev))
  return {ops}
}

/**
 * The document tier: one document per locale, joined on `translation.metadata`.
 */
async function translateIntoSibling(job: TranslationJob): Promise<TranslationWrite> {
  const {client, ctx, documentType, locale, publishedSourceId, release} = job

  const metadata = await client.fetch<null | {_id: string; translations: null | TranslationRow[]}>(
    TRANSLATIONS_FOR_DOCUMENT_QUERY,
    {metadataId: getTranslationMetadataId(publishedSourceId), publishedId: publishedSourceId},
    {tag: 'get-translation-metadata'},
  )

  // An existing translation is overwritten in place; a new one lets the agent
  // mint the id.
  const existingId = metadata?.translations?.find((row) => row.language === locale)?.ref ?? null

  const translateParams = buildTranslateParams({
    ...sharedParams(job),
    languageFieldPath: LANGUAGE_FIELD_PATH,
    operation: existingId ? 'edit' : 'create',
    ...(existingId ? {targetDocumentId: existingId} : {}),
  })

  const {targetDocument} = translateParams
  if (!targetDocument) {
    throw new Error('buildTranslateParams produced no target document')
  }

  await ctx.setProgress('translationProgress', 25)

  // Field by field, not a spread: `translate()`'s parameter is a sync/async
  // union that loses its narrowing through one.
  const translated = await agentClient(client, ctx).agent.action.translate({
    schemaId: translateParams.schemaId,
    documentId: translateParams.documentId,
    noWrite: true,
    fromLanguage: translateParams.fromLanguage,
    toLanguage: translateParams.toLanguage,
    styleGuide: withRevisionNote(translateParams.styleGuide, job.revisionNote),
    protectedPhrases: translateParams.protectedPhrases,
    languageFieldPath: translateParams.languageFieldPath,
    targetDocument,
  })

  await ctx.setProgress('translationProgress', 70)

  const targetPublishedId = existingId
    ? getPublishedId(DocumentId(existingId))
    : getPublishedId(DocumentId(translated._id))

  const processed = await postProcessTranslation({
    baseDocumentId: publishedSourceId,
    baseLanguage: SOURCE_LANGUAGE,
    client,
    documentType,
    targetLocaleId: locale,
    translatedResult: translated,
  })

  const document = {...processed, _type: documentType, [LANGUAGE_FIELD_PATH]: locale}

  let machineRev: null | string
  if (release) {
    machineRev = await createVersion(client, {
      document: {
        ...document,
        _id: getVersionId(DocumentId(targetPublishedId), release.releaseName),
      },
      publishedId: targetPublishedId,
      log: ctx.log,
    })
  } else {
    // A mutation answers with the document it wrote, `_rev` and all.
    const written = await client.createOrReplace(
      {...document, _id: getDraftId(DocumentId(targetPublishedId))},
      {tag: 'write-draft'},
    )
    machineRev = written._rev
  }

  // A locale the join document had never heard of. Registering it is what makes
  // the translation discoverable to the i18n plugin — and to the next analysis,
  // which reads coverage from exactly this document.
  if (!existingId) {
    await linkTranslation(client, {
      documentType,
      locale,
      // The document-internationalization plugin mints the join document with a
      // random uuid, so an existing one is not at our deterministic id. The
      // query finds it either way; writing to our id instead would create a
      // second join document for the same source.
      metadataId: metadata?._id ?? getTranslationMetadataId(publishedSourceId),
      sourcePublishedId: publishedSourceId,
      targetPublishedId,
    })
  }

  return {machineRev, targetPublishedId}
}

/**
 * The field tier: every locale lives in the subject, so this child writes
 * entries into the subject's own draft (or release version) rather than a
 * document of its own.
 *
 * Sibling locale children run concurrently against that one document. They do
 * not conflict: each patch touches only its own locale's entries, and a Content
 * Lake transaction takes an exclusive lock on the document it mutates, so
 * without an `ifRevisionID` there is nothing to lose a race over.
 */
async function translateInPlace(
  job: TranslationJob,
  fields: InternationalizedField[],
): Promise<TranslationWrite> {
  const {client, ctx, locale, publishedSourceId, release, sourceDoc} = job

  // Only the fields that carry source content: an empty bio has nothing to
  // translate and no entry key to translate it at.
  const targets = fields.flatMap((field) => {
    const entry = entryFor(sourceDoc, field, SOURCE_LANGUAGE)
    return entry ? [{entry, field}] : []
  })
  if (targets.length === 0) {
    throw new Error(`${publishedSourceId} has no ${SOURCE_LANGUAGE} content to translate`)
  }

  const translateParams = buildTranslateParams({
    ...sharedParams(job),
    // The agent has to read the same layer the entry keys came from, or the
    // target paths resolve to nothing. Under the field tier's published
    // perspective that is the published document; under a campaign's default
    // it is the draft the perspective read resolved to.
    documentId: readIdOf(sourceDoc, publishedSourceId),
    // No `languageFieldPath`: a field-tier document has no language field, and
    // naming an absent path is a 400. The locale lives on each array entry.
    inPlace: true,
  })

  await ctx.setProgress('translationProgress', 25)

  // One call for every field of this locale. The targets name the SOURCE
  // entries, so the agent translates them where they lie and `noWrite` keeps
  // the document untouched — the translated values come back at the same keys
  // and this handler writes its own entries from them. Verified against the
  // live API: disjoint roots (`bio`, `seo.*`) coalesce into a single request.
  const translated = await agentClient(client, ctx).agent.action.translate({
    schemaId: translateParams.schemaId,
    documentId: translateParams.documentId,
    noWrite: true,
    fromLanguage: translateParams.fromLanguage,
    toLanguage: translateParams.toLanguage,
    styleGuide: withRevisionNote(translateParams.styleGuide, job.revisionNote),
    protectedPhrases: translateParams.protectedPhrases,
    target: targets.map(({entry, field}) => ({
      // A registered field path is a plain dot path, so every segment before
      // the entry key is a field name.
      path: [...field.path.split('.'), {_key: entry._key}, 'value'],
    })),
  })

  await ctx.setProgress('translationProgress', 70)

  const targetId = release
    ? getVersionId(DocumentId(publishedSourceId), release.releaseName)
    : getDraftId(DocumentId(publishedSourceId))

  // The layer being patched has to exist first. Both forms are idempotent, so
  // whichever sibling locale gets there first wins and the rest are no-ops.
  const base = documentBody(sourceDoc, targetId, job.documentType)
  if (release) {
    await createVersion(client, {document: base, publishedId: publishedSourceId, log: ctx.log})
  } else {
    await client.createIfNotExists(base, {tag: 'write-draft'})
  }

  const tx = client.transaction()
  // A Sanity patch does not create missing parents, so `seo` has to exist
  // before `seo.metaTitle` can be set. Deduped: two fields share one container.
  for (const container of containersOf(targets.map(({field}) => field))) {
    tx.patch(targetId, (patch) => patch.setIfMissing({[container.path]: container.value}))
  }
  for (const {entry, field} of targets) {
    const value = translatedValue(translated, field, entry._key, locale)
    // One `append` per patch: @sanity/client's Patch keeps `insert` in a single
    // slot, so chaining a second one overwrites the first. Unset-then-append
    // makes a redelivered effect replace its own entry rather than add a second.
    tx.patch(targetId, (patch) =>
      patch
        .setIfMissing({[field.path]: []})
        .unset([`${field.path}[language=="${locale}"]`])
        .append(field.path, [{_type: field.itemType, language: locale, value}]),
    )
  }
  await tx.commit({autoGenerateArrayKeys: true, tag: 'write-locale-entries'})

  // A commit answers with its transaction, not with the document it patched, so
  // the revision the entries landed at costs one read. `raw`: `targetId` is a
  // literal draft or version id, which a resolving perspective never matches.
  const machineRev = await client.fetch<null | string>(
    `*[_id == $targetId][0]._rev`,
    {targetId},
    {perspective: 'raw', tag: 'read-machine-rev'},
  )

  return {machineRev, targetPublishedId: publishedSourceId}
}

/** The half of `buildTranslateParams` neither tier varies. */
function sharedParams(job: TranslationJob) {
  return {
    schemaId: SCHEMA_ID,
    documentId: job.publishedSourceId,
    glossaries: filterGlossaryByContent(job.glossaries, job.sourceDoc),
    targetLocale: job.targetLocale,
    sourceLocale: job.sourceLocale,
    styleGuide: job.styleGuide ?? undefined,
  }
}

/** Each distinct ancestor object the target fields need, in declaration order. */
function containersOf(fields: InternationalizedField[]): InternationalizedField['containers'] {
  const seen = new Map<string, {path: string; value: {_type: string}}>()
  for (const field of fields) {
    for (const container of field.containers) seen.set(container.path, container)
  }
  return [...seen.values()]
}

/** The translated text, read back from the source entry it was translated at. */
function translatedValue(
  translated: Record<string, unknown>,
  field: InternationalizedField,
  key: string,
  locale: string,
): unknown {
  const value = entriesOf(translated, field).find((entry) => entry._key === key)?.value
  if (value == null || value === '') {
    throw new Error(`Translation returned no ${locale} value for "${field.path}"`)
  }
  // The translate action occasionally emits Unicode null bytes, which the
  // Content Lake rejects — and this value goes straight into a patch.
  return sanitizeTranslationValue(value)
}

/** The id the perspective read actually resolved to. */
function readIdOf(source: Record<string, unknown>, publishedId: string): string {
  return typeof source._originalId === 'string' ? source._originalId : publishedId
}

/**
 * The source content as the body of a new draft or version. The engine's
 * helper drops `_rev`/`_createdAt`/`_updatedAt`; `_originalId` is an artifact
 * of reading under a perspective, not content, so it goes too.
 */
function documentBody(
  source: Record<string, unknown>,
  id: string,
  type: string,
): Record<string, unknown> & {_id: string; _type: string} {
  const body = stripSystemFields(source)
  delete body._originalId
  return {...body, _id: id, _type: type}
}

/**
 * Register the translation on the `translation.metadata` join document.
 *
 * Idempotent by locale: the caller resolves the id — the existing document's,
 * else the deterministic one — `createIfNotExists` tolerates a concurrent
 * sibling locale creating it first, and the row is unset before it is appended
 * so a redelivered effect replaces its own row rather than adding a second one.
 */
async function linkTranslation(
  client: ContentClient,
  args: {
    documentType: string
    locale: string
    /** The join document that exists, or the deterministic id to create one at. */
    metadataId: string
    sourcePublishedId: string
    targetPublishedId: string
  },
): Promise<void> {
  const {metadataId} = args
  const sourceRef = translationReference(SOURCE_LANGUAGE, args.sourcePublishedId, args.documentType)

  const tx = client.transaction()
  tx.createIfNotExists({
    _id: metadataId,
    _type: METADATA_TYPE,
    schemaTypes: [args.documentType],
    translations: [sourceRef],
  })
  // One `append` per patch: @sanity/client's Patch keeps `insert` in a single
  // slot, so chaining a second one overwrites the first.
  tx.patch(metadataId, (patch) =>
    patch
      .setIfMissing({translations: [sourceRef]})
      .unset([`translations[language=="${args.locale}"]`])
      .append('translations', [
        translationReference(args.locale, args.targetPublishedId, args.documentType),
      ]),
  )
  await tx.commit({autoGenerateArrayKeys: true, tag: 'link-locale'})
}

/**
 * A `translation.metadata` row. `_key` comes from `autoGenerateArrayKeys`;
 * `_strengthenOnPublish` upgrades the weak ref once the target is published.
 */
function translationReference(
  language: string,
  ref: string,
  type: string,
): Omit<TranslationReference, '_key'> {
  return {
    _type: 'internationalizedArrayReferenceValue',
    language,
    value: {_ref: ref, _type: 'reference', _weak: true, _strengthenOnPublish: {type}},
  }
}

function namedLocale(locales: LocaleRow[], code: string): {code: string; title: string} {
  const match = locales.find((row) => row.code === code)
  return {code, title: match?.title ?? code}
}

/**
 * A reviewer's "redo it, but ..." note. It has no home in the translate
 * parameters, so it rides along on the assembled style guide rather than
 * bypassing `buildTranslateParams`.
 */
function withRevisionNote(styleGuide: string | undefined, note: null | string): string | undefined {
  if (!note) return styleGuide
  const section = `## Revision request\n\n${note}`
  return styleGuide ? `${styleGuide}\n\n${section}` : section
}

/**
 * Returns the revision the version was written at, or null when nothing was
 * written. The actions API answers with the id of the transaction it committed,
 * which is the revision that transaction stamped on the document — the same
 * identifier the History API reads a revision back by.
 */
async function createVersion(
  client: {action: (action: unknown, options?: {tag?: string}) => Promise<unknown>},
  args: {
    document: Record<string, unknown> & {_id: string}
    publishedId: string
    log: (message: string) => void
  },
): Promise<null | string> {
  try {
    const result = await client.action(
      {
        actionType: 'sanity.action.document.version.create',
        document: args.document,
        publishedId: args.publishedId,
      },
      {tag: 'write-to-release'},
    )
    return transactionIdOf(result)
  } catch (err) {
    // A redelivered effect finds the version it already created. The engine
    // guarantees at-least-once, so this is an expected outcome, not a failure.
    if (!isConflict(err)) throw err
    args.log(`Version ${args.document._id} already exists`)
    return null
  }
}

function transactionIdOf(result: unknown): null | string {
  if (typeof result !== 'object' || result === null || !('transactionId' in result)) return null
  return typeof result.transactionId === 'string' ? result.transactionId : null
}

/** Structural as well as `instanceof`: a bundled second copy of `@sanity/client` breaks the class check. */
function isConflict(err: unknown): boolean {
  if (err instanceof ClientError) return err.statusCode === 409
  return isHttpError(err) && err.statusCode === 409
}

function targetOp(id: GdrUri, type: string): FieldOp {
  return {
    type: 'field.set',
    target: {scope: 'workflow', field: 'target'},
    value: {type: 'literal', value: {id, type}},
  }
}

/** The revision the machine output was written at, for the learning loop to diff against. */
function machineRevOp(rev: string): FieldOp {
  return {
    type: 'field.set',
    target: {scope: 'workflow', field: 'machineRev'},
    value: {type: 'literal', value: rev},
  }
}
