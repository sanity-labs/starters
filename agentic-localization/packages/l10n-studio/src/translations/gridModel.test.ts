import {describe, expect, it} from 'vitest'

import type {FieldChange, FieldChangeMagnitude} from '@starter/l10n'

import {
  buildGrid,
  CELL_GLYPH,
  charDelta,
  defaultSelection,
  defersDiff,
  orderByImpact,
  unionColumns,
  type LocaleSnapshot,
} from './gridModel'

function change(
  fieldName: string,
  magnitude: FieldChangeMagnitude,
  overrides: Partial<FieldChange> = {},
): FieldChange {
  return {
    fieldName,
    changed: magnitude !== 'unchanged',
    magnitude,
    fieldType: 'string',
    oldValue: 'old',
    newValue: 'new',
    ...overrides,
  }
}

function snapshot(locale: string, overrides: Partial<LocaleSnapshot> = {}): LocaleSnapshot {
  return {
    locale,
    stage: 'translated',
    absent: false,
    targetDocumentId: `doc-${locale}`,
    changes: [],
    present: null,
    ...overrides,
  }
}

describe('unionColumns', () => {
  it('takes every field that changed in any locale', () => {
    const columns = unionColumns([
      snapshot('de-DE', {changes: [change('title', 'minor'), change('body', 'rewritten')]}),
      snapshot('fr-FR', {changes: [change('excerpt', 'updated')]}),
    ])

    expect(new Set(columns)).toEqual(new Set(['title', 'body', 'excerpt']))
  })

  it('orders by impact, then by weight, then by name', () => {
    const heavy = change('body', 'updated', {oldValue: '', newValue: 'x'.repeat(200)})
    const light = change('excerpt', 'updated', {oldValue: '', newValue: 'x'.repeat(10)})

    expect(
      unionColumns([
        snapshot('de-DE', {changes: [light, change('title', 'minor'), heavy]}),
        snapshot('fr-FR', {changes: [change('seo', 'rewritten')]}),
      ]),
    ).toEqual(['seo', 'body', 'excerpt', 'title'])
  })

  it('takes a field at its worst magnitude across locales', () => {
    expect(
      unionColumns([
        snapshot('de-DE', {changes: [change('title', 'minor'), change('body', 'minor')]}),
        snapshot('fr-FR', {changes: [change('body', 'rewritten')]}),
      ]),
    ).toEqual(['body', 'title'])
  })

  it('ignores fields the diff reported as unchanged', () => {
    expect(unionColumns([snapshot('de-DE', {changes: [change('title', 'unchanged')]})])).toEqual([])
  })
})

describe('buildGrid', () => {
  it('renders a row for every locale, changed or not', () => {
    const model = buildGrid({
      locales: [
        snapshot('de-DE', {changes: [change('title', 'minor')]}),
        snapshot('fr-FR'),
        snapshot('ja-JP'),
      ],
    })

    expect(model.rows.map((row) => row.locale)).toEqual(['de-DE', 'fr-FR', 'ja-JP'])
    expect(model.rows[1].cells.map((cell) => cell.state)).toEqual(['same'])
  })

  it('maps magnitude to the read-only cell vocabulary', () => {
    const model = buildGrid({
      locales: [
        snapshot('de-DE', {
          changes: [
            change('a', 'minor'),
            change('b', 'updated'),
            change('c', 'rewritten'),
            change('d', 'added'),
            change('e', 'removed'),
          ],
        }),
      ],
    })

    expect(model.rows[0].cells.map((cell) => CELL_GLYPH[cell.state])).toEqual(
      model.columns.map(
        (field) =>
          ({a: '~', b: '▰', c: '▰▰', d: '▰', e: '▰▰'})[field as 'a' | 'b' | 'c' | 'd' | 'e'],
      ),
    )
  })

  it('fails the whole row when the locale run failed', () => {
    const model = buildGrid({
      columns: ['bio', 'seo.metaTitle'],
      locales: [snapshot('ja-JP', {stage: 'failed', changes: [change('bio', 'rewritten')]})],
    })

    expect(model.rows[0].state).toBe('failed')
    expect(model.rows[0].cells.every((cell) => cell.state === 'failed')).toBe(true)
  })

  it('misses the whole row when no document holds the locale', () => {
    const model = buildGrid({
      columns: ['title'],
      locales: [snapshot('ja-JP', {absent: true, stage: null, targetDocumentId: null})],
    })

    expect(model.rows[0].state).toBe('missing')
    expect(model.rows[0].cells[0].state).toBe('missing')
  })

  it('misses a single cell when the field tier is half covered', () => {
    const model = buildGrid({
      columns: ['bio', 'seo.metaTitle', 'seo.metaDescription'],
      locales: [
        snapshot('de-DE', {
          present: new Set(['bio', 'seo.metaTitle']),
          changes: [change('bio', 'rewritten')],
        }),
      ],
    })

    expect(model.rows[0].cells.map((cell) => cell.state)).toEqual(['rewritten', 'same', 'missing'])
  })

  it('keeps the schema column order the field tier passes in', () => {
    const model = buildGrid({
      columns: ['bio', 'seo.metaTitle', 'seo.metaDescription'],
      locales: [snapshot('de-DE', {changes: [change('seo.metaDescription', 'rewritten')]})],
    })

    expect(model.columns).toEqual(['bio', 'seo.metaTitle', 'seo.metaDescription'])
  })

  it('counts the cells that need eyes', () => {
    const model = buildGrid({
      columns: ['a', 'b', 'c'],
      locales: [snapshot('de-DE', {changes: [change('a', 'minor'), change('b', 'rewritten')]})],
    })

    expect(model.rows[0].changed).toBe(2)
  })
})

describe('defaultSelection', () => {
  it('opens on the failed locale before anything else', () => {
    const model = buildGrid({
      columns: ['title'],
      locales: [
        snapshot('de-DE', {changes: [change('title', 'rewritten')]}),
        snapshot('ja-JP', {stage: 'failed'}),
      ],
    })

    expect(defaultSelection(model)).toBe('ja-JP')
  })

  it('otherwise opens on the heaviest change', () => {
    const model = buildGrid({
      columns: ['title'],
      locales: [
        snapshot('de-DE', {changes: [change('title', 'minor')]}),
        snapshot('fr-FR', {changes: [change('title', 'rewritten')]}),
      ],
    })

    expect(defaultSelection(model)).toBe('fr-FR')
  })

  it('is null with no locales', () => {
    expect(defaultSelection(buildGrid({locales: []}))).toBeNull()
  })
})

describe('orderByImpact', () => {
  it('sorts by magnitude, then by how much text moved', () => {
    const ordered = orderByImpact([
      change('title', 'minor'),
      change('excerpt', 'updated', {oldValue: '', newValue: 'x'.repeat(10)}),
      change('body', 'updated', {oldValue: '', newValue: 'x'.repeat(200)}),
      change('seo', 'rewritten'),
    ])

    expect(ordered.map((entry) => entry.fieldName)).toEqual(['seo', 'body', 'excerpt', 'title'])
  })
})

describe('charDelta', () => {
  it('counts every string under a Portable Text value', () => {
    const blocks = [{_type: 'block', _key: 'a', children: [{_type: 'span', text: 'hello'}]}]
    expect(charDelta(change('body', 'added', {oldValue: undefined, newValue: blocks}))).toBe(5)
  })

  it('is negative when the translation shortens', () => {
    expect(charDelta(change('title', 'updated', {oldValue: 'abcdef', newValue: 'ab'}))).toBe(-4)
  })
})

describe('defersDiff', () => {
  it('always defers Portable Text', () => {
    expect(defersDiff(change('body', 'minor', {fieldType: 'portableText'}))).toBe(true)
  })

  it('expands a short string change inline', () => {
    expect(defersDiff(change('title', 'updated'))).toBe(false)
  })

  it('defers anything heavier than a paragraph', () => {
    expect(
      defersDiff(change('excerpt', 'updated', {oldValue: 'x'.repeat(400), newValue: 'y'})),
    ).toBe(true)
  })
})
