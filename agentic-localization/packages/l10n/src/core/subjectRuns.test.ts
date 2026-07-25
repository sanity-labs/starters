import {
  WORKFLOW_INSTANCE_TYPE,
  type ResolvedFieldEntry,
  type WorkflowInstance,
} from '@sanity/workflow-engine'
import {describe, expect, it} from 'vitest'

import {readSubjectRun, type SubjectRun} from './subjectRuns'

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

const BARE_RUN: SubjectRun = {
  instanceId: 'production.wf-instance.abc',
  subjectId: 'article-1',
  stage: 'review',
  locales: [],
  sourceChanged: false,
  hasFailedLocales: false,
  startedAt: '2026-07-24T09:00:00.000Z',
}

describe('readSubjectRun', () => {
  it('reads the subject as a bare document id, with the stage it is at', () => {
    expect(readSubjectRun(instance({currentStage: 'analyzing'}))).toEqual({
      ...BARE_RUN,
      stage: 'analyzing',
    })
  })

  it('is null without a readable subject — a half-formed run is not a run', () => {
    expect(readSubjectRun(instance({fields: []}))).toBeNull()
  })

  it('carries the locales the analysis flagged', () => {
    expect(
      readSubjectRun(
        instance({fields: [SUBJECT_FIELD, localesField('targetLocales', ['de-DE', 'fr-FR'])]}),
      )?.locales,
    ).toEqual(['de-DE', 'fr-FR'])
  })

  it('narrows to the locales a reviewer asked to redo', () => {
    expect(
      readSubjectRun(
        instance({
          fields: [
            SUBJECT_FIELD,
            localesField('targetLocales', ['de-DE', 'fr-FR', 'ja-JP']),
            localesField('retranslateLocales', ['fr-FR']),
          ],
        }),
      )?.locales,
    ).toEqual(['fr-FR'])
  })

  it('defaults the advisory flags to false rather than undefined', () => {
    expect(readSubjectRun(instance())).toEqual(BARE_RUN)
  })

  it('carries the advisory flags through when set', () => {
    expect(
      readSubjectRun(
        instance({
          fields: [
            SUBJECT_FIELD,
            flagField('sourceChanged', true),
            flagField('hasFailedLocales', true),
          ],
        }),
      ),
    ).toEqual({...BARE_RUN, sourceChanged: true, hasFailedLocales: true})
  })
})
