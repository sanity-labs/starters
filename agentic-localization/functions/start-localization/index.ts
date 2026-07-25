/**
 * Sanity Function: start (or advance) a localization run when a source
 * document is published.
 *
 * Replaces the old `mark-translations-stale` chain: no staleness is written
 * anywhere, the run itself is the record.
 */

import {createHash} from 'node:crypto'

import {documentEventHandler} from '@sanity/functions'
import {DocumentId, getPublishedId} from '@sanity/id-utils'
import {gdrUri, StartNotAllowedError} from '@sanity/workflow-engine'
import {localizeDocument} from '@starter/l10n/workflows'

import {localizationEngine, requireEnv, workflowsClient} from '../engine'

const NAME = 'start-localization'

/** The published source document, under the blueprint's projection. */
interface PublishEventData {
  _id: string
  _rev: string
  _type: string
  language?: string
}

export const handler = documentEventHandler<PublishEventData>(async ({context, event}) => {
  const {_rev, _type} = event.data
  const publishedId = getPublishedId(DocumentId(event.data._id))

  // The event source is the content dataset; the engine's store is not.
  const client = workflowsClient(context.clientOptions, NAME).withConfig({
    dataset: requireEnv('WORKFLOWS_DATASET_NAME'),
  })
  const engine = localizationEngine(client, NAME)

  const subject = gdrUri({
    scheme: 'dataset',
    projectId: context.clientOptions.projectId,
    dataset: context.clientOptions.dataset,
    documentId: publishedId,
  })

  // Start's idempotency key. Derived from the revision, so a redelivered event
  // resumes the same run while a genuinely new publish starts a new one.
  // Bare form: Sanity rejects `:` in document ids.
  const digest = createHash('sha256').update(`${publishedId}:${_rev}`).digest('hex').slice(0, 16)
  const instanceId = `${engine.tag}.wf-instance.${digest}`

  try {
    await engine.startInstance({
      definition: localizeDocument.name,
      instanceId,
      initialFields: [{type: 'subject', name: 'subject', value: {id: subject, type: _type}}],
    })
    console.log(`[${NAME}] started ${instanceId} for ${publishedId}`)
  } catch (error) {
    if (!(error instanceof StartNotAllowedError)) throw error

    // A run is already open for this document. Ticking it is what makes the
    // definition's `sourceChanged` trigger observe the new revision.
    const open = await engine.instancesForDocument({document: subject})
    for (const instance of open) {
      await engine.tick({instanceId: instance._id})
    }
    console.log(`[${NAME}] ${publishedId} already running — ticked ${open.length} instance(s)`)
  }
})
