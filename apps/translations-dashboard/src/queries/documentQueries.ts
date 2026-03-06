import {defineQuery} from 'groq'

export const DOCUMENT_PREVIEW_QUERY = defineQuery(`{
  _id,
  _createdAt,
  title,
  language,
  "_translationMetadataRef": *[
    _type == "translation.metadata"
    && (
      references(^._id) 
      || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
    )
  ][0]._id
}`)

// Helper comment: The patterns below handle two separate issues:
// 1. Draft/published ID mismatch: useDocumentProjection may return drafts.{id} even when the metadata references {id}
//    Pattern: references(^._id) || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
// 2. Draft-only translation documents: Translations may only exist as drafts, not published
//    Pattern: coalesce(*[_id == ^.value._ref][0], *[_id == "drafts." + ^.value._ref][0])

export const DOCUMENT_DETAIL_QUERY = defineQuery(`{
  _createdAt,
  _id,
  title,
  language,
  "_translations": *[
    _type == "translation.metadata"
    && (
      references(^._id)
      || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
    )
  ].translations[]{
    "translation": coalesce(
      *[_id == ^.value._ref][0],
      *[_id == "drafts." + ^.value._ref][0]
    ){
      _id,
      title,
      language
    }
  }.translation,
  "_translationMetadataId": *[
    _type == "translation.metadata"
    && (
      references(^._id)
      || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
    )
  ]._id,
  "_hasMetadata": defined(*[
    _type == "translation.metadata"
    && (
      references(^._id)
      || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
    )
  ][0]),
  "_translationStatus": select(
    count(*[
      _type == "translation.metadata"
      && (
        references(^._id)
        || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
      )
    ].translations[].value) == 0 => "none",
    count(*[
      _type == "translation.metadata"
      && (
        references(^._id)
        || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
      )
    ].translations[].value) == count(*[_type == "l10n.locale"]) => "fully translated",
    true => "partial"
  ),
}`)

// Query to fetch translations in a specific release
export const DOCUMENT_DETAIL_WITH_RELEASE_QUERY = defineQuery(`{
  _createdAt,
  _id,
  title,
  language,
  "_translations": *[
    _type == "translation.metadata"
    && (
      references(^._id)
      || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
    )
  ].translations[]{
    "translation": coalesce(
      *[_id == ^.value._ref][0],
      *[_id == "drafts." + ^.value._ref][0]
    ){
      _id,
      title,
      language
    }
  }.translation,
  "_releaseTranslations": *[
    _type == "translation.metadata"
    && (
      references(^._id)
      || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
    )
  ].translations[]{
    _key,
    "publishedId": value._ref,
    "versionId": "versions." + $releaseId + "." + value._ref,
    "version": *[_id == "versions." + $releaseId + "." + ^.value._ref][0]{
      _id,
      title,
      language
    },
    "published": coalesce(
      *[_id == ^.value._ref][0],
      *[_id == "drafts." + ^.value._ref][0]
    ){
      _id,
      title,
      language
    }
  },
  "_translationMetadataId": *[
    _type == "translation.metadata"
    && (
      references(^._id)
      || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
    )
  ]._id,
  "_hasMetadata": defined(*[
    _type == "translation.metadata"
    && (
      references(^._id)
      || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
    )
  ][0]),
  "_translationStatus": select(
    count(*[
      _type == "translation.metadata"
      && (
        references(^._id)
        || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
      )
    ].translations[].value) == 0 => "none",
    count(*[
      _type == "translation.metadata"
      && (
        references(^._id)
        || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
      )
    ].translations[].value) == count(*[_type == "l10n.locale"]) => "fully translated",
    true => "partial"
  ),
}`)

/** Check if a document has a language field set. */
export const DOC_LANGUAGE_QUERY = defineQuery(`*[_id == $docId][0]{ _id, language }`)

/** Validate selected documents for batch translation (checks language, metadata, translation status). */
export const BATCH_VALIDATE_DOCUMENTS_QUERY = defineQuery(`*[_id in $documentIds]{
  _id,
  _type,
  title,
  language,
  "hasMetadata": defined(*[_type == "translation.metadata" && references(^._id)][0]),
  "_translationStatus": select(
    count(*[
      _type == "translation.metadata"
      && references(^._id)
    ].translations[].value) == 0 => "none",
    count(*[
      _type == "translation.metadata"
      && references(^._id)
    ].translations[].value) == count(*[_type == "l10n.locale"]) => "fully translated",
    true => "partial"
  )
}`)

export const BATCH_DOCUMENT_PREVIEW_QUERY = defineQuery(`{
  _id,
  "_translations": *[
    _type == "translation.metadata"
    && (
      references(^._id)
      || references(select(^._id in path("drafts.*") => string::split(^._id, "drafts.")[1], ^._id))
    )
  ].translations[]{
    "translation": coalesce(
      *[_id == ^.value._ref][0],
      *[_id == "drafts." + ^.value._ref][0]
    ){
      _id,
      title,
      slug,
      language
    }
  }.translation,
}`)
