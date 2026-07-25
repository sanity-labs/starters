import type {SubjectRun} from '@starter/l10n'

import {describe, expect, test} from 'vitest'

import {resolveLocaleStatus} from './localizationRun'

function run(overrides: Partial<SubjectRun> = {}): SubjectRun {
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
