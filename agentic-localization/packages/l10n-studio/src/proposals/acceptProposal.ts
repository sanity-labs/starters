/**
 * Accepting a proposal, and the two rules that govern it.
 *
 * - **`status` is written explicitly, always.** `GLOSSARIES_QUERY` defaults a
 *   status-less entry to `approved` for the sake of hand-authored glossaries that
 *   predate the field. An accepted proposal must never lean on that default: an
 *   entry written without a status would be live the moment it is published,
 *   which is the opposite of the review the status field exists for.
 * - **Never `doNotTranslate`.** The loop cannot propose it and Accept cannot
 *   write it. Pinning a phrase in the source language is a brand decision.
 *
 * Accept writes into the target's DRAFT and then deletes the proposal. Publishing
 * the glossary is the reviewer's second act, and only then does prompt assembly
 * see it — the two-human gate ADR-002 is built on.
 */

import type {SanityClient} from '@sanity/client'
import type {ACCEPT_TARGETS_QUERY_RESULT} from '@starter/sanity-types'

import {DocumentId, getDraftId, getPublishedId} from '@sanity/id-utils'
import {defineQuery} from 'groq'
import {
  glossaryEntryTypeName,
  glossaryTypeName,
  isProposalKind,
  localeTranslationTypeName,
  localeTypeName,
  proposalTypeName,
  styleGuideTypeName,
  type ProposalKind,
} from '@starter/l10n'
import {SOURCE_LANGUAGE} from '@starter/l10n/workflows'

/** A proposal, as much of it as accepting one needs. */
export interface AcceptableProposal {
  _id: string
  kind: ProposalKind
  locale: string
  term?: string
  translation?: string
  rule?: string
}

/**
 * Where an accepted proposal goes. Absent halves are what blocks it.
 *
 * TypeGen's inference over `ACCEPT_TARGETS_QUERY`, not a hand-written mirror of
 * it — a projection that drifts should break the compiler, not the reviewer.
 */
export type AcceptTargets = ACCEPT_TARGETS_QUERY_RESULT

/**
 * The glossary a term is appended to, the style guide for the locale, and the
 * locale document a translation row references.
 *
 * One query, because a document action's job is to be instant. `drafts`
 * perspective: the reviewer's own unpublished edits to a glossary are the state
 * being appended to, and `_id` still resolves to the published id.
 *
 * The style guide is `[0]`-over-type by locale, matching
 * `STYLE_GUIDE_FOR_LOCALE_QUERY` — so there is exactly one, and Accept patches it
 * rather than creating a second.
 */
export const ACCEPT_TARGETS_QUERY = defineQuery(`{
  "glossary": *[_type == "${glossaryTypeName}"]
    | order(select(sourceLocale->code == $sourceLanguage => 0, 1) asc, _createdAt asc)[0]{
      _id,
      "keys": entries[]._key
    },
  "styleGuide": *[_type == "${styleGuideTypeName}" && locale->code == $locale][0]{
    _id,
    "keys": additionalInstructions[]._key
  },
  "localeId": *[_type == "${localeTypeName}" && code == $locale][0]._id
}`)

/** Narrow a Studio document to the shape Accept works on, or refuse it. */
export function readProposal(document: unknown): AcceptableProposal | null {
  if (typeof document !== 'object' || document === null) return null
  const record: Record<string, unknown> = {...document}
  if (record._type !== proposalTypeName) return null
  if (typeof record._id !== 'string') return null
  if (!isProposalKind(record.kind)) return null
  if (typeof record.locale !== 'string' || !record.locale) return null

  return {
    _id: record._id,
    kind: record.kind,
    locale: record.locale,
    ...(typeof record.term === 'string' && {term: record.term}),
    ...(typeof record.translation === 'string' && {translation: record.translation}),
    ...(typeof record.rule === 'string' && {rule: record.rule}),
  }
}

/**
 * Why this proposal cannot be accepted yet, in words a reviewer can act on.
 *
 * A missing style guide is the interesting one: `STYLE_GUIDE_FOR_LOCALE_QUERY`
 * takes the first document of the type for a locale, so creating one here could
 * silently shadow a guide the reviewer is about to write. Accept patches; it
 * never creates.
 */
export function acceptBlocker(proposal: AcceptableProposal, targets: AcceptTargets): string | null {
  if (proposal.kind === 'glossary-term') {
    if (!proposal.term || !proposal.translation) return 'This proposal carries no term.'
    if (!targets.glossary) return 'There is no glossary to add this term to. Create one first.'
    if (!targets.localeId) return `No locale document is configured for ${proposal.locale}.`
    return null
  }

  if (proposal.kind === 'style-rule') {
    if (!proposal.rule) return 'This proposal carries no rule.'
    if (!targets.styleGuide) {
      return `There is no ${proposal.locale} style guide to add this rule to. Create one first.`
    }
    return null
  }

  return null
}

/**
 * The array key an accepted proposal is written at.
 *
 * The proposal's own id already hashes what it says, so reusing it makes accepting
 * a re-proposed correction a no-op rather than a duplicate row — and records in
 * the target document which proposal put it there.
 */
export function acceptedKey(proposalId: string): string {
  return `l10n-${getPublishedId(DocumentId(proposalId)).split('.').pop() ?? proposalId}`
}

/** The `l10n.glossary.entry` an accepted term becomes. */
export function glossaryEntryFor(
  proposal: AcceptableProposal,
  localeId: string,
): Record<string, unknown> {
  return {
    _key: acceptedKey(proposal._id),
    _type: glossaryEntryTypeName,
    term: proposal.term,
    // Explicit, never inherited from `coalesce(status, "approved")`.
    status: 'approved',
    translations: [
      {
        _key: `${acceptedKey(proposal._id)}-${proposal.locale}`,
        _type: localeTranslationTypeName,
        locale: {_type: 'reference', _ref: localeId},
        translation: proposal.translation,
      },
    ],
  }
}

/** The Portable Text block an accepted style rule appends to a style guide. */
export function styleRuleBlockFor(proposal: AcceptableProposal): Record<string, unknown> {
  return {
    // The key is the provenance: it names the proposal this sentence came from.
    _key: acceptedKey(proposal._id),
    _type: 'block',
    style: 'normal',
    markDefs: [],
    children: [
      {_key: `${acceptedKey(proposal._id)}-0`, _type: 'span', marks: [], text: proposal.rule},
    ],
  }
}

export async function readAcceptTargets(
  client: SanityClient,
  locale: string,
): Promise<AcceptTargets> {
  return client.fetch<AcceptTargets>(
    ACCEPT_TARGETS_QUERY,
    {locale, sourceLanguage: SOURCE_LANGUAGE},
    {perspective: 'drafts', tag: 'l10n.accept-targets'},
  )
}

/**
 * Accept a proposal: append it to the target's draft, then delete the proposal.
 *
 * An eval case has no target to append to — its value IS its coordinates — so
 * accepting one publishes it, which is how the fixture script tells a harvested
 * case from one still awaiting review.
 */
export async function acceptProposal(
  client: SanityClient,
  proposal: AcceptableProposal,
): Promise<void> {
  if (proposal.kind === 'eval-case') {
    await publishProposal(client, proposal._id)
    return
  }

  const targets = await readAcceptTargets(client, proposal.locale)
  const blocker = acceptBlocker(proposal, targets)
  if (blocker) throw new Error(blocker)

  if (proposal.kind === 'glossary-term' && targets.glossary && targets.localeId) {
    await appendToDraft(client, {
      publishedId: targets.glossary._id,
      field: 'entries',
      keys: targets.glossary.keys,
      item: glossaryEntryFor(proposal, targets.localeId),
    })
  }

  if (proposal.kind === 'style-rule' && targets.styleGuide) {
    await appendToDraft(client, {
      publishedId: targets.styleGuide._id,
      field: 'additionalInstructions',
      keys: targets.styleGuide.keys,
      item: styleRuleBlockFor(proposal),
    })
  }

  await client.delete(proposal._id, {tag: 'l10n.accept-proposal'})
}

/** Delete the draft. A rejected proposal leaves no trace but the run's history. */
export async function rejectProposal(client: SanityClient, proposalId: string): Promise<void> {
  await client.delete(proposalId, {tag: 'l10n.reject-proposal'})
}

/**
 * Append one keyed item to a document's DRAFT.
 *
 * `createIfNotExists` first: a glossary that has never been edited has no draft
 * to patch, and a patch does not create one. The key check makes accepting a
 * re-proposed correction idempotent.
 */
async function appendToDraft(
  client: SanityClient,
  args: {publishedId: string; field: string; keys: null | string[]; item: Record<string, unknown>},
): Promise<void> {
  const key = args.item._key
  if (typeof key === 'string' && (args.keys ?? []).includes(key)) return

  const draftId = getDraftId(DocumentId(args.publishedId))
  const published = await client.fetch<null | Record<string, unknown>>(
    '*[_id == $id][0]',
    {id: args.publishedId},
    {perspective: 'published', tag: 'l10n.accept-read-target'},
  )

  const transaction = client.transaction()
  if (published && typeof published._type === 'string') {
    transaction.createIfNotExists({...published, _id: draftId, _type: published._type})
  }
  transaction.patch(draftId, (patch) =>
    patch.setIfMissing({[args.field]: []}).append(args.field, [args.item]),
  )
  await transaction.commit({tag: 'l10n.accept-proposal'})
}

/** Promote the eval case's draft — the harvested corpus is the published set. */
async function publishProposal(client: SanityClient, proposalId: string): Promise<void> {
  const publishedId = getPublishedId(DocumentId(proposalId))
  await client.action(
    {
      actionType: 'sanity.action.document.publish',
      draftId: getDraftId(DocumentId(proposalId)),
      publishedId,
    },
    {tag: 'l10n.accept-eval-case'},
  )
}
