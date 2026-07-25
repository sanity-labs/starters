import {
  WORKFLOW_INSTANCE_TYPE,
  type ResolvedFieldEntry,
  type WorkflowInstance,
} from '@sanity/workflow-engine'
import {describe, expect, it} from 'vitest'

import {
  bucketRuns,
  sectionsEqual,
  sectionsFor,
  subjectRunFromInstance,
  type SubjectRun,
} from './runSections'

const SUBJECT_FIELD: ResolvedFieldEntry = {
  _key: 'k-subject',
  _type: 'subject',
  name: 'subject',
  value: {id: 'dataset:p1:production:article-1', type: 'article'},
}

function instance(overrides: Partial<WorkflowInstance> = {}): WorkflowInstance {
  return {
    _createdAt: '2026-07-24T09:00:00.000Z',
    _id: 'production.wf-instance.abc',
    _rev: 'rev-1',
    _type: WORKFLOW_INSTANCE_TYPE,
    _updatedAt: '2026-07-24T09:00:00.000Z',
    ancestors: [],
    context: [],
    currentStage: 'review',
    definition: 'localize-document',
    definitionSnapshot: '{}',
    effectHistory: [],
    fields: [SUBJECT_FIELD],
    history: [],
    lastChangedAt: '2026-07-24T09:00:00.000Z',
    pendingEffects: [],
    pinnedVersion: 1,
    stages: [],
    startedAt: '2026-07-24T09:00:00.000Z',
    tag: 'production',
    workflowResource: {id: 'p1.workflows', type: 'dataset'},
    ...overrides,
  }
}

function localesField(name: string, locales: string[]): ResolvedFieldEntry {
  return {
    _key: `k-${name}`,
    _type: 'array',
    name,
    of: [
      {name: 'locale', type: 'string'},
      {name: 'reason', type: 'string'},
    ],
    value: locales.map((locale) => ({_key: locale, locale, reason: 'body changed'})),
  }
}

function flagField(name: string, value: boolean): ResolvedFieldEntry {
  return {_key: `k-${name}`, _type: 'boolean', name, value}
}

function run(overrides: Partial<SubjectRun> = {}): SubjectRun {
  return {
    instanceId: 'production.wf-instance.abc',
    subjectId: 'article-1',
    stage: 'review',
    locales: ['de-DE'],
    sourceChanged: false,
    hasFailedLocales: false,
    startedAt: '2026-07-24T09:00:00.000Z',
    ...overrides,
  }
}

describe('subjectRunFromInstance', () => {
  it('reads the subject, stage and locales off the instance', () => {
    expect(
      subjectRunFromInstance(
        instance({fields: [SUBJECT_FIELD, localesField('targetLocales', ['de-DE', 'fr-FR'])]}),
      ),
    ).toEqual(run({locales: ['de-DE', 'fr-FR']}))
  })

  it('narrows to the locales a reviewer asked to redo', () => {
    const subject = subjectRunFromInstance(
      instance({
        fields: [
          SUBJECT_FIELD,
          localesField('targetLocales', ['de-DE', 'fr-FR', 'ja-JP']),
          localesField('retranslateLocales', ['fr-FR']),
        ],
      }),
    )
    expect(subject?.locales).toEqual(['fr-FR'])
  })

  it('is null when the instance carries no readable subject', () => {
    expect(subjectRunFromInstance(instance({fields: []}))).toBeNull()
  })

  it('carries the advisory flags through', () => {
    expect(
      subjectRunFromInstance(
        instance({
          fields: [
            SUBJECT_FIELD,
            flagField('sourceChanged', true),
            flagField('hasFailedLocales', true),
          ],
        }),
      ),
    ).toEqual(run({locales: [], sourceChanged: true, hasFailedLocales: true}))
  })
})

describe('sectionsFor', () => {
  it('routes an open review to needs-review', () => {
    expect(sectionsFor(run())).toEqual(['needs-review'])
  })

  it('routes a review whose source moved to source-changed instead', () => {
    expect(sectionsFor(run({sourceChanged: true}))).toEqual(['source-changed'])
  })

  it('routes both engine-working stages to translating', () => {
    expect(sectionsFor(run({stage: 'analyzing'}))).toEqual(['translating'])
    expect(sectionsFor(run({stage: 'translating'}))).toEqual(['translating'])
  })

  it('lists a review with a failed locale under both jobs', () => {
    expect(sectionsFor(run({hasFailedLocales: true}))).toEqual(['needs-review', 'failed-locales'])
  })

  it('counts a wholly failed run as a failed locale job', () => {
    expect(sectionsFor(run({stage: 'failed'}))).toEqual(['failed-locales'])
  })

  it('places a settled run in no section', () => {
    expect(sectionsFor(run({stage: 'approved'}))).toEqual([])
    expect(sectionsFor(run({stage: 'done'}))).toEqual([])
  })
})

describe('bucketRuns', () => {
  it('groups runs into the sections they belong to', () => {
    const review = run({instanceId: 'i-1', subjectId: 'article-1'})
    const working = run({instanceId: 'i-2', subjectId: 'article-2', stage: 'translating'})
    const sections = bucketRuns([review, working])

    expect(sections['needs-review']).toEqual([review])
    expect(sections.translating).toEqual([working])
    expect(sections['source-changed']).toEqual([])
    expect(sections['failed-locales']).toEqual([])
  })

  it('orders each section oldest first', () => {
    const older = run({
      instanceId: 'i-1',
      subjectId: 'article-1',
      startedAt: '2026-07-24T08:00:00.000Z',
    })
    const newer = run({
      instanceId: 'i-2',
      subjectId: 'article-2',
      startedAt: '2026-07-24T12:00:00.000Z',
    })

    expect(bucketRuns([newer, older])['needs-review']).toEqual([older, newer])
  })

  it('keeps one row per subject, the newest run', () => {
    const stale = run({instanceId: 'i-1', startedAt: '2026-07-24T08:00:00.000Z'})
    const current = run({instanceId: 'i-2', startedAt: '2026-07-24T12:00:00.000Z'})

    expect(bucketRuns([stale, current])['needs-review']).toEqual([current])
  })
})

describe('sectionsEqual', () => {
  it('holds when the same runs are in the same places', () => {
    expect(sectionsEqual(bucketRuns([run()]), bucketRuns([run()]))).toBe(true)
  })

  it('breaks when a run advances a stage', () => {
    expect(sectionsEqual(bucketRuns([run()]), bucketRuns([run({stage: 'translating'})]))).toBe(
      false,
    )
  })

  it('breaks when a locale is added to a run', () => {
    expect(
      sectionsEqual(bucketRuns([run()]), bucketRuns([run({locales: ['de-DE', 'fr-FR']})])),
    ).toBe(false)
  })
})
