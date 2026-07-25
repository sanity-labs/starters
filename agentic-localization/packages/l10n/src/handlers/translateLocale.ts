/**
 * `translate-locale` — one source document into one target locale.
 *
 * The context this assembles goes through `buildTranslateParams`, the same
 * function the eval suite calls. That is the point of the seam: if the runtime
 * assembled glossaries and style guides its own way, the evals would keep
 * proving quality for a path production does not take.
 */

import type {TranslationReference} from '@sanity/document-internationalization'
import type {EffectHandler, FieldOp, GdrUri} from '@sanity/workflow-engine'

import {DocumentId, getDraftId, getPublishedId, getVersionId} from '@sanity/id-utils'
import {extractDocumentId} from '@sanity/workflow-engine'

import type {Glossary, StyleGuide} from '../promptAssembly'
import type {ContentClient} from './effectRuntime'

import {buildTranslateParams, filterGlossaryByContent} from '../promptAssembly'
import {
  GLOSSARIES_QUERY,
  LOCALES_BY_CODE_QUERY,
  STYLE_GUIDE_FOR_LOCALE_QUERY,
  TRANSLATIONS_FOR_DOCUMENT_QUERY,
} from '../queries'
import {getTranslationMetadataId} from '../core/ids'
import {postProcessTranslation} from '../translate'
import {SOURCE_LANGUAGE} from '../workflows/effects'
import {
  agentClient,
  contentClientFor,
  effectAlreadyDone,
  optionalRelease,
  optionalString,
  requireGdr,
  requireString,
  siblingGdr,
} from './effectRuntime'

const SCHEMA_ID = '_.schemas.default'
const LANGUAGE_FIELD_PATH = 'language'
const METADATA_TYPE = 'translation.metadata'

type LocaleRow = {code: string; title: null | string}
type TranslationRow = {language: null | string; ref: null | string}

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
  const sourceId = DocumentId(extractDocumentId(source))
  const publishedSourceId = getPublishedId(sourceId)

  const [sourceDoc, glossaries, styleGuide, locales, metadata] = await Promise.all([
    client.fetch<null | Record<string, unknown>>(
      `*[_id == $id || _id == $draftId] | order(_id asc)[0]`,
      {id: publishedSourceId, draftId: getDraftId(sourceId)},
      {tag: 'get-source-doc'},
    ),
    client.fetch<Glossary[]>(GLOSSARIES_QUERY, {}, {tag: 'get-glossaries'}),
    client.fetch<null | StyleGuide>(
      STYLE_GUIDE_FOR_LOCALE_QUERY,
      {localeCode: locale},
      {tag: 'get-style-guide'},
    ),
    client.fetch<LocaleRow[]>(
      LOCALES_BY_CODE_QUERY,
      {codes: [locale, SOURCE_LANGUAGE]},
      {tag: 'get-locales'},
    ),
    client.fetch<null | {translations: null | TranslationRow[]}>(
      TRANSLATIONS_FOR_DOCUMENT_QUERY,
      {metadataId: getTranslationMetadataId(publishedSourceId), publishedId: publishedSourceId},
      {tag: 'get-translation-metadata'},
    ),
  ])

  if (!sourceDoc) throw new Error(`Source document ${publishedSourceId} not found`)

  const documentType = sourceDoc._type
  if (typeof documentType !== 'string') {
    throw new Error(`Source document ${publishedSourceId} has no _type`)
  }

  const targetLocale = namedLocale(locales, locale)
  const sourceLocale = namedLocale(locales, SOURCE_LANGUAGE)

  await ctx.setProgress('translationProgress', 10)

  // An existing translation is overwritten in place; a new one lets the agent
  // mint the id, which is how the dashboard's executor has always worked.
  const existingId = metadata?.translations?.find((row) => row.language === locale)?.ref ?? null

  const translateParams = buildTranslateParams({
    schemaId: SCHEMA_ID,
    documentId: publishedSourceId,
    glossaries: filterGlossaryByContent(glossaries, sourceDoc),
    targetLocale,
    sourceLocale,
    styleGuide: styleGuide ?? undefined,
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
    styleGuide: withRevisionNote(translateParams.styleGuide, revisionNote),
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

  const document = {
    ...processed,
    _type: documentType,
    [LANGUAGE_FIELD_PATH]: locale,
  }

  if (release) {
    await createVersion(client, {
      document: {
        ...document,
        _id: getVersionId(DocumentId(targetPublishedId), release.releaseName),
      },
      publishedId: targetPublishedId,
      log: ctx.log,
    })
  } else {
    await client.createOrReplace(
      {...document, _id: getDraftId(DocumentId(targetPublishedId))},
      {tag: 'write-draft'},
    )
  }

  // A locale the join document had never heard of. Registering it is what makes
  // the translation discoverable to the i18n plugin — and to the next analysis,
  // which reads coverage from exactly this document.
  if (!existingId) {
    await linkTranslation(client, {
      documentType,
      locale,
      sourcePublishedId: publishedSourceId,
      targetPublishedId,
    })
  }

  await ctx.setProgress('translationProgress', 100)

  return {ops: [targetOp(siblingGdr(source, targetPublishedId), documentType)]}
}

/**
 * Register the translation on the `translation.metadata` join document.
 *
 * Idempotent by locale: the id is deterministic, `createIfNotExists` tolerates a
 * concurrent sibling locale creating it first, and the row is unset before it is
 * appended so a redelivered effect replaces its own row rather than adding a
 * second one.
 */
async function linkTranslation(
  client: ContentClient,
  args: {
    documentType: string
    locale: string
    sourcePublishedId: string
    targetPublishedId: string
  },
): Promise<void> {
  const metadataId = getTranslationMetadataId(args.sourcePublishedId)
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

async function createVersion(
  client: {action: (action: unknown, options?: {tag?: string}) => Promise<unknown>},
  args: {
    document: Record<string, unknown> & {_id: string}
    publishedId: string
    log: (message: string) => void
  },
): Promise<void> {
  try {
    await client.action(
      {
        actionType: 'sanity.action.document.version.create',
        document: args.document,
        publishedId: args.publishedId,
      },
      {tag: 'write-to-release'},
    )
  } catch (err) {
    // A redelivered effect finds the version it already created. The engine
    // guarantees at-least-once, so this is an expected outcome, not a failure.
    if (!isConflict(err)) throw err
    args.log(`Version ${args.document._id} already exists`)
  }
}

function isConflict(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'statusCode' in err && err.statusCode === 409
}

function targetOp(id: GdrUri, type: string): FieldOp {
  return {
    type: 'field.set',
    target: {scope: 'workflow', field: 'target'},
    value: {type: 'literal', value: {id, type}},
  }
}
