import type {SubjectRun} from '@starter/l10n'

import {describe, expect, it} from 'vitest'

import {bucketRuns, sectionsEqual, sectionsFor} from './runSections'

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
