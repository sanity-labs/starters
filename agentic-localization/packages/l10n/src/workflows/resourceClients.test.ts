import type {WorkflowResource} from '@sanity/workflow-engine'

import {createClient} from '@sanity/client'
import {gdrRef, parseGdr, releaseRef} from '@sanity/workflow-engine'
import {expect, test} from 'vitest'

import {WORKFLOWS_DATASET} from './config'
import {projectResourceClients} from './resourceClients'

const PROJECT_ID = 'proj1'
const CONTENT_DATASET = 'production'
const CONTENT_RESOURCE = {
  type: 'dataset',
  id: `${PROJECT_ID}.${CONTENT_DATASET}`,
} satisfies WorkflowResource

function engineClient() {
  return createClient({
    projectId: PROJECT_ID,
    dataset: WORKFLOWS_DATASET,
    apiVersion: '2025-05-16',
    useCdn: false,
  })
}

test('a content ref resolves to a client on the content dataset', () => {
  const resolve = projectResourceClients(engineClient())
  const subject = gdrRef({documentId: 'article-1', res: CONTENT_RESOURCE, type: 'article'})

  expect(resolve(parseGdr(subject.id))?.config().dataset).toBe(CONTENT_DATASET)
})

test('a release ref resolves too — the campaign start that needs it most', () => {
  const resolve = projectResourceClients(engineClient())
  const release = releaseRef({releaseName: 'spring-launch', res: CONTENT_RESOURCE})

  expect(resolve(parseGdr(release.id))?.config().dataset).toBe(CONTENT_DATASET)
})

test('the same dataset resolves to the same client object', () => {
  const resolve = projectResourceClients(engineClient())
  const parsed = parseGdr(gdrRef({documentId: 'a', res: CONTENT_RESOURCE, type: 'article'}).id)

  expect(resolve(parsed)).toBe(resolve(parsed))
})

test('another project is not this deployment to declare', () => {
  const resolve = projectResourceClients(engineClient())
  const foreign = gdrRef({
    documentId: 'article-1',
    res: {type: 'dataset', id: `other-project.${CONTENT_DATASET}`} satisfies WorkflowResource,
    type: 'article',
  })

  expect(resolve(parseGdr(foreign.id))).toBeUndefined()
})
