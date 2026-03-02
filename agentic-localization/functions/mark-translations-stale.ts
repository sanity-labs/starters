/**
 * Sanity Function: Mark translations as stale when base-language document is published.
 *
 * Triggers on publish events for internationalized document types.
 * Guards on language === 'en-US' (base language) in the handler.
 * Finds the translation.metadata document that references the published doc,
 * then patches all non-missing workflowStates entries to 'stale'.
 *
 * Preserves existing `source` (ai/manual) — staleness is orthogonal to
 * how the translation was produced. Stores `staleSourceRev` for future
 * "what changed since translation" diff UI.
 */

import type {TranslationWorkflowStatus, WorkflowStateEntry} from '@starter/l10n/core/types'

import {createClient} from '@sanity/client'
import {documentEventHandler} from '@sanity/functions'
import {defineQuery} from 'groq'
import {getPublishedId} from 'sanity'

/** The base language — only publish events for this language trigger stale marking. */
const BASE_LANGUAGE = 'en-US'

/** Workflow statuses that should NOT be marked stale (nothing to go stale). */
const SKIP_STATUSES: Set<TranslationWorkflowStatus> = new Set(['missing', 'stale'])

import type {METADATA_FOR_DOCUMENT_QUERY_RESULT} from '@starter/sanity-types'

/** Metadata doc shape from GROQ, narrowed to non-null. */
type MetadataDoc = NonNullable<METADATA_FOR_DOCUMENT_QUERY_RESULT>

/** Event data from internationalized document publish events. */
interface StaleEventData {
  _id: string
  _rev: string
  _type: string
  language: string
}

/**
 * GROQ query to find the translation.metadata document that references a given document.
 * translation.metadata stores an array of references to all language versions.
 * We look for any metadata doc whose translations array contains a reference to our doc.
 */
const METADATA_FOR_DOCUMENT_QUERY = defineQuery(`*[
  _type == "translation.metadata" &&
  $publishedId in translations[].value._ref
][0]{
  _id,
  workflowStates
}`)

export const handler = documentEventHandler<StaleEventData>(async ({context, event}) => {
  const {_id, _rev, _type, language} = event.data

  // Guard: only base-language documents trigger stale marking.
  if (language !== BASE_LANGUAGE) {
    console.log(
      `[StaleDetection] Skipping ${_id} — language "${language}" is not base language "${BASE_LANGUAGE}"`,
    )
    return
  }

  console.log(`[StaleDetection] Base-language doc published: ${_type} "${_id}" (rev: ${_rev})`)

  const client = createClient({
    ...context.clientOptions,
    apiVersion: '2025-05-16',
    useCdn: false,
  })

  // Strip drafts./versions. prefix to get the published ID for reference matching.
  const publishedId = getPublishedId(_id)

  // Find the translation.metadata document that references this base-language doc.
  const metadata = await client.fetch<MetadataDoc | null>(METADATA_FOR_DOCUMENT_QUERY, {
    publishedId,
  })

  if (!metadata) {
    console.log(`[StaleDetection] No translation.metadata found referencing "${publishedId}"`)
    return
  }

  // Filter to entries with a valid status.
  const rawStates = metadata.workflowStates
  const workflowStates = !rawStates
    ? []
    : rawStates.filter((e): e is WorkflowStateEntry => !!e.status)

  if (workflowStates.length === 0) {
    console.log(
      `[StaleDetection] Metadata "${metadata._id}" has no workflowStates — nothing to mark stale`,
    )
    return
  }

  // Find entries that should be marked stale (not missing, not already stale).
  const entriesToMark = workflowStates.filter((entry) => !SKIP_STATUSES.has(entry.status))

  if (entriesToMark.length === 0) {
    console.log(
      `[StaleDetection] All ${workflowStates.length} entries are already missing or stale — no changes needed`,
    )
    return
  }

  console.log(
    `[StaleDetection] Marking ${entriesToMark.length} of ${workflowStates.length} locale(s) as stale on "${metadata._id}"`,
  )

  // Build the patch: for each entry to mark, set status to 'stale',
  // preserve source, add staleSourceRev and updatedAt.
  const now = new Date().toISOString()
  const patch = client.patch(metadata._id)

  for (const entry of entriesToMark) {
    const keyPath = `workflowStates[_key == "${entry._key}"]`
    patch.set({
      [`${keyPath}.staleSourceRev`]: _rev,
      [`${keyPath}.status`]: 'stale',
      [`${keyPath}.updatedAt`]: now,
      // source and reviewedBy are intentionally NOT overwritten — preserved from original translation.
    })
  }

  try {
    await patch.commit()
    console.log(
      `[StaleDetection] Successfully marked ${entriesToMark.length} locale(s) as stale: ${entriesToMark.map((e) => e._key).join(', ')}`,
    )
  } catch (error) {
    console.error(`[StaleDetection] Failed to patch metadata "${metadata._id}":`, error)
    throw error
  }
})
