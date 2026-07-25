import type {ResolvedFieldEntry, WorkflowInstance} from '@sanity/workflow-engine'

import {WORKFLOW_INSTANCE_TYPE} from '@sanity/workflow-engine'
import {describe, expect, test} from 'vitest'

import type {LocalizationRun} from './localizationRun'

import {resolveLocaleStatus, runFromInstance} from './localizationRun'

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
    currentStage: 'analyzing',
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

function run(overrides: Partial<LocalizationRun> = {}): LocalizationRun {
  return {
    hasFailedLocales: false,
    instanceId: 'production.wf-instance.abc',
    locales: ['de-DE'],
    sourceChanged: false,
    stage: 'review',
    startedAt: '2026-07-24T09:00:00.000Z',
    subjectId: 'article-1',
    ...overrides,
  }
}

describe('runFromInstance', () => {
  test('reads the subject as a bare document id', () => {
    expect(runFromInstance(instance())?.subjectId).toBe('article-1')
  })

  test('is null without a readable subject — a half-formed run is not a run', () => {
    expect(runFromInstance(instance({fields: []}))).toBeNull()
  })

  test('carries the locales the analysis flagged', () => {
    const parsed = runFromInstance(
      instance({fields: [...instance().fields, localesField('targetLocales', ['de-DE', 'fr-FR'])]}),
    )
    expect(parsed?.locales).toEqual(['de-DE', 'fr-FR'])
  })

  test('a narrowed re-run narrows the locales', () => {
    const parsed = runFromInstance(
      instance({
        fields: [
          ...instance().fields,
          localesField('targetLocales', ['de-DE', 'fr-FR']),
          localesField('retranslateLocales', ['fr-FR']),
        ],
      }),
    )
    expect(parsed?.locales).toEqual(['fr-FR'])
  })

  test('advisory flags default to false rather than undefined', () => {
    const parsed = runFromInstance(instance())
    expect(parsed?.hasFailedLocales).toBe(false)
    expect(parsed?.sourceChanged).toBe(false)
  })
})

describe('resolveLocaleStatus without a run', () => {
  test('a direct translation reads as complete', () => {
    expect(
      resolveLocaleStatus({
        fallbackTranslated: false,
        localeTag: 'de-DE',
        run: undefined,
        translated: true,
      }),
    ).toEqual({hasFailedLocales: false, instanceId: null, sourceChanged: false, status: 'approved'})
  })

  test('a fallback covers the gap', () => {
    expect(
      resolveLocaleStatus({
        fallbackTranslated: true,
        localeTag: 'de-DE',
        run: undefined,
        translated: false,
      }).status,
    ).toBe('usingFallback')
  })

  test('no translation and no run is missing', () => {
    expect(
      resolveLocaleStatus({
        fallbackTranslated: false,
        localeTag: 'de-DE',
        run: undefined,
        translated: false,
      }).status,
    ).toBe('missing')
  })
})

describe('resolveLocaleStatus with an open run', () => {
  test.each(['analyzing', 'translating'])('%s reads as in progress', (stage) => {
    expect(
      resolveLocaleStatus({
        fallbackTranslated: false,
        localeTag: 'de-DE',
        run: run({stage}),
        translated: true,
      }).status,
    ).toBe('translating')
  })

  test('review is a pending human decision', () => {
    expect(
      resolveLocaleStatus({
        fallbackTranslated: false,
        localeTag: 'de-DE',
        run: run({stage: 'review'}),
        translated: true,
      }).status,
    ).toBe('needsReview')
  })

  test('a source that moved under review reads as stale', () => {
    const status = resolveLocaleStatus({
      fallbackTranslated: false,
      localeTag: 'de-DE',
      run: run({sourceChanged: true, stage: 'review'}),
      translated: true,
    })
    expect(status.status).toBe('stale')
    expect(status.sourceChanged).toBe(true)
  })

  test('a failed locale is surfaced as a flag, never as a blocked status', () => {
    const status = resolveLocaleStatus({
      fallbackTranslated: false,
      localeTag: 'de-DE',
      run: run({hasFailedLocales: true, stage: 'review'}),
      translated: true,
    })
    expect(status.status).toBe('needsReview')
    expect(status.hasFailedLocales).toBe(true)
  })

  test.each(['approved', 'done'])('%s reads as complete', (stage) => {
    expect(
      resolveLocaleStatus({
        fallbackTranslated: false,
        localeTag: 'de-DE',
        run: run({stage}),
        translated: true,
      }).status,
    ).toBe('approved')
  })

  test('a failed run falls through to what the content says', () => {
    expect(
      resolveLocaleStatus({
        fallbackTranslated: false,
        localeTag: 'de-DE',
        run: run({stage: 'failed'}),
        translated: false,
      }).status,
    ).toBe('missing')
  })

  test('a locale outside the run keeps its content status', () => {
    const status = resolveLocaleStatus({
      fallbackTranslated: false,
      localeTag: 'ja-JP',
      run: run({locales: ['de-DE'], stage: 'translating'}),
      translated: false,
    })
    expect(status.status).toBe('missing')
    expect(status.instanceId).toBeNull()
  })

  test('an empty locale set covers the whole document — analysis has not decided yet', () => {
    expect(
      resolveLocaleStatus({
        fallbackTranslated: false,
        localeTag: 'ja-JP',
        run: run({locales: [], stage: 'analyzing'}),
        translated: false,
      }).status,
    ).toBe('translating')
  })
})
