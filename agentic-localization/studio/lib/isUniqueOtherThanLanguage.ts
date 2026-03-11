import type { SlugValidationContext } from "sanity";

/**
 * Custom slug uniqueness check that scopes uniqueness to the same language.
 * This allows translated documents to share the same slug across different languages.
 *
 * @see https://github.com/sanity-io/document-internationalization/blob/main/docs/05-allowing-the-same-slug-for-translations.md
 */
export async function isUniqueOtherThanLanguage(slug: string, context: SlugValidationContext) {
  const { document, getClient } = context;
  if (!document?.language) {
    return true;
  }
  const client = getClient({ apiVersion: "2025-03-11" });
  const id = document._id.replace(/^drafts\./, "");
  const params = {
    id,
    language: document.language,
    slug,
  };
  const query = `!defined(*[
    !(sanity::versionOf($id)) &&
    slug.current == $slug &&
    language == $language
  ][0]._id)`;
  const result = await client.fetch(query, params);
  return result;
}
