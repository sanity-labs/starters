import type {SlugValidationContext} from 'sanity'

import {DocumentId, getPublishedId} from '@sanity/id-utils'
import {defineQuery} from 'groq'

/**
 * `sanity::versionOf($id)` is true for the published document and for every
 * draft and release version of it — but only when `$id` is the published id.
 * Hand it a `drafts.`/`versions.` id and it matches that one document alone.
 */
export const SLUG_UNIQUE_QUERY = defineQuery(`!defined(*[
  !(sanity::versionOf($id)) &&
  slug.current == $slug &&
  language == $language
][0]._id)`)

/** What the validator reads off the slug validation context. */
type SlugUniquenessContext = Pick<SlugValidationContext, 'document' | 'getClient'>

/**
 * Slug uniqueness scoped to one language, so translations of a document share
 * a slug while two documents in the same language cannot.
 *
 * @see https://github.com/sanity-io/document-internationalization/blob/main/docs/05-allowing-the-same-slug-for-translations.md
 */
export async function isUniqueOtherThanLanguage(
  slug: string,
  context: SlugUniquenessContext,
): Promise<boolean> {
  const {document, getClient} = context
  if (!document?.language) {
    return true
  }
  const client = getClient({apiVersion: '2025-03-11'})
  const params = {
    id: getPublishedId(DocumentId(document._id)),
    language: document.language,
    slug,
  }
  return client.fetch<boolean>(SLUG_UNIQUE_QUERY, params, {tag: 'validation.slug-unique'})
}
