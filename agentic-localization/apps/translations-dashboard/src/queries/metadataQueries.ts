import {defineQuery} from 'groq'

/** Check whether translation metadata already exists for a document. */
export const METADATA_EXISTS_QUERY = defineQuery(
  `*[_type == "translation.metadata" && references($docId)][0]._id`,
)

/** Fetch metadata document with translations for a base document. */
export const METADATA_WITH_TRANSLATIONS_QUERY = defineQuery(`*[
  _type == "translation.metadata"
  && references($documentId)
][0]{
  _id,
  translations
}`)

/** Batch fetch metadata statuses with document existence checks. */
export const BATCH_METADATA_STATUS_QUERY = defineQuery(`*[
  _type == "translation.metadata"
  && _id in $metadataIds
]{
  _id,
  workflowStates,
  "translations": translations[]{
    _key,
    "ref": value._ref,
    "publishedExists": defined(*[_id == ^.value._ref][0]),
    "draftExists": defined(*[_id == "drafts." + ^.value._ref][0]),
    "versionIds": *[_id match ("versions.*." + ^.value._ref)]._id
  }
}`)
