/**
 * The engine's declared ref surface is `workflowResource` plus whatever
 * `resourceClients` answers for — a ref it serves is in, everything else is
 * refused with `RefResourceUndeclaredError`. A campaign start supplies nothing
 * but content refs, so these assertions are the difference between the batch
 * starting and the batch being rejected outright.
 */

import {createClient} from '@sanity/client'
import {gdrRef, parseGdr, releaseRef} from '@sanity/workflow-engine'
import {expect, test} from 'vitest'

import {
  CONTENT_RESOURCE,
  PROJECT_ID,
  WORKFLOWS_DATASET,
  WORKFLOWS_RESOURCE,
} from '../consts/workflows'
import {l10nEngineArgs} from './useL10nEngine'

/** The client the hook builds: project credentials, engine dataset. */
function engineClient() {
  return createClient({
    projectId: PROJECT_ID,
    dataset: WORKFLOWS_DATASET,
    apiVersion: '2026-07-01',
    useCdn: false,
  })
}

/** The engine's own membership test, verbatim. */
function declares(ref: {id: string}): boolean {
  return l10nEngineArgs(engineClient()).resourceClients?.(parseGdr(ref.id)) !== undefined
}

test('the engine is scoped to the workflows resource', () => {
  expect(l10nEngineArgs(engineClient()).workflowResource).toEqual(WORKFLOWS_RESOURCE)
})

test('a campaign start’s release ref is declared', () => {
  expect(declares(releaseRef({releaseName: 'spring-launch', res: CONTENT_RESOURCE}))).toBe(true)
})

test('so are the documents it batches', () => {
  expect(declares(gdrRef({documentId: 'article-1', res: CONTENT_RESOURCE, type: 'article'}))).toBe(
    true,
  )
})

test('another project stays outside the surface', () => {
  const foreign = gdrRef({
    documentId: 'article-1',
    res: {type: 'dataset', id: 'other-project.production'},
    type: 'article',
  })

  expect(declares(foreign)).toBe(false)
})
