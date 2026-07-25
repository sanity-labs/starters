/**
 * Fixture content, created the way an editor would: a draft, then a publish
 * action. The publish is not decoration — `start-localization` triggers on
 * publish events, and the analysis handler reads the published document's
 * transaction log to find what it changed from.
 */

import type {SanityClient} from '@sanity/client'
import type {Harness} from './harness'

import {localeTypeName} from '@starter/l10n'

import {FIXTURE_PREFIX} from './env'

/** A published document and the revision it landed at — the publish event's payload. */
export interface Published {
  _id: string
  _rev: string
  _type: string
}

/** The shape a fixture write needs: a document with an id and a type. */
type FixtureDocument = Record<string, unknown> & {_id: string; _type: string}

/** Locale fixtures are stable across runs: `LOCALE_CODES_QUERY` reads them by type. */
export function localeId(code: string): string {
  return `${FIXTURE_PREFIX}locale-${code}`
}

/**
 * The locales the analysis handler considers. Every code but the source one is
 * a candidate, so the set decides how wide the fan-out goes.
 */
export async function seedLocales(client: SanityClient, codes: string[]): Promise<void> {
  const transaction = client.transaction()
  for (const code of codes) {
    transaction.createOrReplace({
      _id: localeId(code),
      _type: localeTypeName,
      code,
      title: code,
    })
  }
  await transaction.commit({tag: 'seed-locales'})
}

/**
 * Empty a type outright.
 *
 * For the assertions that read the dataset rather than one document — the
 * candidate locale set, "no sibling was created", "no join document was
 * created". These datasets are the suite's alone, so a leftover from a run that
 * was killed before it could dispose is litter, not data.
 */
export async function clearTypes(client: SanityClient, types: string[]): Promise<void> {
  await client.delete({query: '*[_type in $types]', params: {types}})
}

export function articleBody(text: string): unknown[] {
  return [
    {
      _key: 'block-1',
      _type: 'block',
      style: 'normal',
      children: [{_key: 'span-1', _type: 'span', marks: [], text}],
    },
  ]
}

/** A document-tier source: one document per locale, joined on `translation.metadata`. */
export async function publishArticle(
  harness: Harness,
  args: {title: string; body?: string},
): Promise<Published> {
  const id = harness.newId('article')
  return createThenPublish(harness, {
    _id: id,
    _type: 'article',
    language: 'en-US',
    title: args.title,
    slug: {_type: 'slug', current: id},
    body: articleBody(args.body ?? 'The original English body copy.'),
  })
}

/** A field-tier source: every locale lives in the document's own arrays. */
export async function publishPerson(
  harness: Harness,
  args: {name: string; bio?: string; metaTitle?: string; metaDescription?: string},
): Promise<Published> {
  const id = harness.newId('person')
  const body: FixtureDocument = {_id: id, _type: 'person', name: args.name}

  if (args.bio !== undefined) {
    body.bio = [entry('internationalizedArrayTextValue', 'bio-en', args.bio)]
  }
  if (args.metaTitle !== undefined || args.metaDescription !== undefined) {
    body.seo = {
      _type: 'seo',
      ...(args.metaTitle !== undefined && {
        metaTitle: [entry('internationalizedArrayStringValue', 'title-en', args.metaTitle)],
      }),
      ...(args.metaDescription !== undefined && {
        metaDescription: [
          entry('internationalizedArrayTextValue', 'description-en', args.metaDescription),
        ],
      }),
    }
  }

  return createThenPublish(harness, body)
}

function entry(itemType: string, key: string, value: string) {
  return {_key: key, _type: itemType, language: 'en-US', value}
}

/**
 * Draft, then publish — and the reason the nightly budget is what it is.
 *
 * Measured against the History API (2026-07-25): a draft write followed by a
 * publish action leaves exactly ONE transaction on the published id — the
 * publish commits the `createOrReplace` and the draft `delete` together, and
 * the draft's own create never identifies the published document. So
 * `analyzeSource`'s `previousRevision` finds no prior revision on a first
 * publish, the field diff is empty, and the handler returns before it reaches
 * `agent.action.prompt`. A first-publish analysis spends zero AI; the second
 * publish of the same document is the first one that can.
 */
async function createThenPublish(harness: Harness, document: FixtureDocument): Promise<Published> {
  const publishedId = document._id
  await harness.content.createOrReplace(
    {...document, _id: `drafts.${publishedId}`},
    {tag: 'fixture-draft'},
  )
  return publish(harness, publishedId)
}

/**
 * Promote the draft. Also the "republish" step: after a field-tier run the draft
 * carries the translations the handlers wrote, and publishing it is what the
 * publish-no-restart invariant is about.
 */
export async function publish(harness: Harness, publishedId: string): Promise<Published> {
  await harness.content.action(
    {
      actionType: 'sanity.action.document.publish',
      draftId: `drafts.${publishedId}`,
      publishedId,
    },
    {tag: 'fixture-publish'},
  )

  const published = await harness.content.fetch<null | Published>(
    '*[_id == $id][0]{_id, _rev, _type}',
    {id: publishedId},
    {perspective: 'raw', tag: 'fixture-read-published'},
  )
  if (!published?._rev) throw new Error(`[e2e] ${publishedId} did not publish`)
  return published
}
