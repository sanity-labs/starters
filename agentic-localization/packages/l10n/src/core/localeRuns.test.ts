import {describe, expect, it} from 'vitest'
import type {SubworkflowEntry} from '@sanity/workflow-engine'

import {buildLocaleRuns, childInstanceIds, toChildRun} from './localeRuns'

function row(overrides: Partial<SubworkflowEntry> & {rowKey: string}): SubworkflowEntry {
  return {
    _key: overrides.rowKey,
    activity: 'translate',
    action: 'fan-out',
    definition: 'localize-locale',
    stageEntry: 'stage-1',
    cohortStage: 'translating',
    ref: {id: `dataset:p1:workflows:child-${overrides.rowKey}`, type: 'workflow.instance'},
    spawnedAt: '2026-07-24T10:00:00.000Z',
    ...overrides,
  }
}

describe('buildLocaleRuns', () => {
  it('reports a locale with no spawned child as queued', () => {
    expect(
      buildLocaleRuns({
        targetLocales: [{locale: 'de-DE', reason: 'body rewritten'}],
        subworkflows: [],
        children: [],
      }),
    ).toEqual([
      {
        locale: 'de-DE',
        reason: 'body rewritten',
        stage: 'queued',
        progress: null,
        childInstanceId: null,
        targetDocumentId: null,
        machineRev: null,
      },
    ])
  })

  it('takes a resolved row’s own stage rather than its settled status', () => {
    const runs = buildLocaleRuns({
      targetLocales: [{locale: 'de-DE'}, {locale: 'fr-FR'}],
      subworkflows: [
        row({rowKey: 'de-DE', resolved: {at: '2026-07-24T10:05:00.000Z', stage: 'failed'}}),
        row({rowKey: 'fr-FR', resolved: {at: '2026-07-24T10:05:00.000Z', stage: 'translated'}}),
      ],
      children: [],
    })
    expect(runs.map((run) => [run.locale, run.stage])).toEqual([
      ['de-DE', 'failed'],
      ['fr-FR', 'translated'],
    ])
  })

  it('treats a resolved row with no stage as failed — the child vanished', () => {
    const [run] = buildLocaleRuns({
      targetLocales: [{locale: 'de-DE'}],
      subworkflows: [row({rowKey: 'de-DE', resolved: {at: '2026-07-24T10:05:00.000Z'}})],
      children: [],
    })
    expect(run.stage).toBe('failed')
  })

  it('prefers the newest row when a retry accumulates rows for one locale', () => {
    const [run] = buildLocaleRuns({
      targetLocales: [{locale: 'de-DE'}],
      subworkflows: [
        row({rowKey: 'de-DE', resolved: {at: '2026-07-24T10:05:00.000Z', stage: 'failed'}}),
        row({
          rowKey: 'de-DE',
          spawnedAt: '2026-07-24T11:00:00.000Z',
          resolved: {at: '2026-07-24T11:05:00.000Z', stage: 'translated'},
        }),
      ],
      children: [],
    })
    expect(run.stage).toBe('translated')
  })

  it('reads a live child’s stage, progress and target from its own instance', () => {
    const [run] = buildLocaleRuns({
      targetLocales: [{locale: 'de-DE'}],
      subworkflows: [row({rowKey: 'de-DE'})],
      children: [
        toChildRun({
          _id: 'child-de-DE',
          currentStage: 'translating',
          fields: [
            {_key: 'a', _type: 'progress', name: 'translationProgress', value: 40},
            {
              _key: 'b',
              _type: 'doc.ref',
              name: 'target',
              value: {id: 'dataset:p1:production:article-de', type: 'article'},
            },
          ],
        }),
      ],
    })
    expect(run).toEqual({
      locale: 'de-DE',
      reason: undefined,
      stage: 'translating',
      progress: 40,
      childInstanceId: 'child-de-DE',
      targetDocumentId: 'article-de',
      machineRev: null,
    })
  })

  // The learning loop's whole read path starts here: without the revision the
  // machine draft landed at there is nothing to diff a human's edit against.
  it('carries the child’s machine revision through to the row', () => {
    const [run] = buildLocaleRuns({
      targetLocales: [{locale: 'de-DE'}],
      subworkflows: [
        row({rowKey: 'de-DE', resolved: {at: '2026-07-24T10:05:00.000Z', stage: 'translated'}}),
      ],
      children: [
        toChildRun({
          _id: 'child-de-DE',
          currentStage: 'translated',
          fields: [
            {_key: 'a', _type: 'string', name: 'machineRev', value: 'rev-machine-de'},
            {
              _key: 'b',
              _type: 'doc.ref',
              name: 'target',
              value: {id: 'dataset:p1:production:article-de', type: 'article'},
            },
          ],
        }),
      ],
    })
    expect(run.machineRev).toBe('rev-machine-de')
  })

  it('keeps a resolved child’s target, so a finished locale can still be compared', () => {
    const [run] = buildLocaleRuns({
      targetLocales: [{locale: 'de-DE'}],
      subworkflows: [
        row({rowKey: 'de-DE', resolved: {at: '2026-07-24T10:05:00.000Z', stage: 'translated'}}),
      ],
      children: [
        toChildRun({
          _id: 'child-de-DE',
          currentStage: 'translated',
          fields: [
            {
              _key: 'b',
              _type: 'doc.ref',
              name: 'target',
              value: {id: 'dataset:p1:production:person-elena-vasquez', type: 'person'},
            },
          ],
        }),
      ],
    })
    expect(run.stage).toBe('translated')
    expect(run.targetDocumentId).toBe('person-elena-vasquez')
  })

  it('surfaces a locale that only exists as a spawned row', () => {
    const runs = buildLocaleRuns({
      targetLocales: [],
      subworkflows: [row({rowKey: 'ja-JP'})],
      children: [],
    })
    expect(runs.map((run) => run.locale)).toEqual(['ja-JP'])
  })
})

describe('childInstanceIds', () => {
  it('deduplicates the rows a retry accumulated for one locale', () => {
    expect(
      childInstanceIds([
        row({rowKey: 'de-DE'}),
        row({rowKey: 'de-DE', spawnedAt: '2026-07-24T11:00:00.000Z'}),
      ]),
    ).toEqual(['child-de-DE'])
  })

  // Every row is resolved by the time the parent reaches `review`, and
  // `resolved` caches the child's stage but not its `target`. Dropping resolved
  // rows here means no compare on the one stage that exists for comparing.
  it('includes resolved rows, whose target the compare needs', () => {
    expect(
      childInstanceIds([
        row({rowKey: 'de-DE', resolved: {at: '2026-07-24T10:05:00.000Z', stage: 'translated'}}),
        row({rowKey: 'fr-FR', resolved: {at: '2026-07-24T10:05:00.000Z', stage: 'translated'}}),
      ]),
    ).toEqual(['child-de-DE', 'child-fr-FR'])
  })
})
