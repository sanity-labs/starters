/**
 * Starting localization: the dashboard's whole write surface.
 *
 * Everything past `startInstance` — fan-out per locale, retries, review gates,
 * idempotency, publishing the release — belongs to the engine. This hook only
 * decides *what* to start and mints the ids that make a double-click a no-op.
 */

import type {GlobalDocumentReference} from '@sanity/workflow-engine'

import {DocumentId, getPublishedId} from '@sanity/id-utils'
import {useClient} from '@sanity/sdk-react'
import {gdrRef, releaseRef, StartNotAllowedError} from '@sanity/workflow-engine'
import {uuid} from '@sanity/uuid'
import {localizeCampaign, localizeDocument} from '@starter/l10n/workflows'
import {useCallback} from 'react'

import {CONTENT_RESOURCE} from '../consts/workflows'
import {useL10nEngine} from './useL10nEngine'

const CONTENT_API_VERSION = '2025-05-16'

/** The minimum a document has to carry to be localizable. */
export interface LocalizationTarget {
  _id: string
  _rev: string
  _type: string
}

/** Where a batch ships: drafts, an existing release, or one minted on start. */
export type CampaignTarget =
  | {kind: 'drafts'}
  | {kind: 'existing'; releaseName: string}
  | {kind: 'new'; title: string}

export interface StartReport {
  /** Documents whose start was refused because a run is already open. Ticked. */
  alreadyRunning: string[]
  failed: Array<{documentId: string; message: string}>
  /** The campaign instance, when the batch shipped as one. */
  campaignInstanceId?: string
  started: string[]
}

/** The published-id GDR an instance references its subject by. */
function subjectRef(target: LocalizationTarget): GlobalDocumentReference {
  return gdrRef({
    documentId: getPublishedId(DocumentId(target._id)),
    res: CONTENT_RESOURCE,
    type: target._type,
  })
}

/**
 * Start's idempotency key, derived exactly as `functions/start-localization`
 * derives it: same document at the same revision resumes the same run, a new
 * publish starts a new one. Bare form — Sanity rejects `:` in document ids.
 *
 * Not the engine's `idempotencyKey`: that dedupes one *request* inside a TTL.
 * This dedupes a *run* across processes and across time — the publish Function
 * and this dashboard have to land on the same instance id, and `instanceDocId`
 * is random.
 */
async function instanceIdFor(tag: string, target: LocalizationTarget): Promise<string> {
  const publishedId = getPublishedId(DocumentId(target._id))
  const seed = new TextEncoder().encode(`${publishedId}:${target._rev}`)
  const digest = await crypto.subtle.digest('SHA-256', seed)
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
  return `${tag}.wf-instance.${hex.join('').slice(0, 16)}`
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function useStartLocalization() {
  const engine = useL10nEngine()
  const contentClient = useClient({apiVersion: CONTENT_API_VERSION})

  /**
   * Which of these documents the engine already has a run for. The locked
   * decision: tell the operator and let them choose, rather than adding a start
   * requirement that would fail the whole batch because one document is busy.
   */
  const findRunning = useCallback(
    async (targets: LocalizationTarget[]): Promise<Set<string>> => {
      const running = new Set<string>()
      for (const target of targets) {
        const open = await engine.instancesForDocument({document: subjectRef(target).id})
        if (open.length > 0) running.add(target._id)
      }
      return running
    },
    [engine],
  )

  /** One `localize-document` run per document, writing drafts. */
  const startDocumentRuns = useCallback(
    async (targets: LocalizationTarget[]): Promise<StartReport> => {
      const report: StartReport = {alreadyRunning: [], failed: [], started: []}

      for (const target of targets) {
        try {
          await engine.startInstance({
            definition: localizeDocument.name,
            initialFields: [{name: 'subject', type: 'subject', value: subjectRef(target)}],
            instanceId: await instanceIdFor(engine.tag, target),
          })
          report.started.push(target._id)
        } catch (error) {
          if (!(error instanceof StartNotAllowedError)) {
            report.failed.push({documentId: target._id, message: messageOf(error)})
            continue
          }
          // Already running. Ticking it is what makes the open run observe the
          // revision the operator just acted on.
          const open = await engine.instancesForDocument({document: subjectRef(target).id})
          for (const instance of open) {
            await engine.tick({instanceId: instance._id})
          }
          report.alreadyRunning.push(target._id)
        }
      }

      return report
    },
    [engine],
  )

  /** Mint a Content Release in the content dataset. The campaign only references it. */
  const createRelease = useCallback(
    async (title: string): Promise<string> => {
      const releaseId = uuid()
      await contentClient.action(
        {
          actionType: 'sanity.action.release.create',
          metadata: {cardinality: 'many', releaseType: 'undecided', title},
          releaseId,
        },
        {tag: 'create-campaign-release'},
      )
      return releaseId
    },
    [contentClient],
  )

  /**
   * One `localize-campaign` over the whole batch. The release is the batching
   * mechanism: every locale writes a version into it and the campaign holds the
   * go-live decision until each document is settled.
   */
  const startCampaign = useCallback(
    async (targets: LocalizationTarget[], releaseName: string): Promise<string> => {
      const {instance} = await engine.startInstance({
        definition: localizeCampaign.name,
        initialFields: [
          {
            name: 'release',
            type: 'release.ref',
            value: releaseRef({releaseName, res: CONTENT_RESOURCE}),
          },
          {name: 'documents', type: 'doc.refs', value: targets.map(subjectRef)},
        ],
      })
      return instance._id
    },
    [engine],
  )

  /** Resolve the picker's choice, then start the shape it implies. */
  const startBatch = useCallback(
    async (targets: LocalizationTarget[], target: CampaignTarget): Promise<StartReport> => {
      if (targets.length === 0) return {alreadyRunning: [], failed: [], started: []}
      if (target.kind === 'drafts') return startDocumentRuns(targets)

      const releaseName =
        target.kind === 'new' ? await createRelease(target.title) : target.releaseName

      return {
        alreadyRunning: [],
        campaignInstanceId: await startCampaign(targets, releaseName),
        failed: [],
        started: targets.map((doc) => doc._id),
      }
    },
    [createRelease, startCampaign, startDocumentRuns],
  )

  return {createRelease, findRunning, startBatch, startCampaign, startDocumentRuns}
}
