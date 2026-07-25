import {describe, expect, it} from 'vitest'

import {
  computeDistillDelta,
  distillText,
  MIN_CHANGED_WORDS,
  normalizeText,
  STYLE_ONLY_RATIO,
} from './distillDelta'

const MACHINE = 'Der Datensatz wird in der Cloud gespeichert und dort verwaltet'

function locale(machine: string, human: string, code = 'de-DE') {
  return {locale: code, machine: {bio: machine}, human: {bio: human}}
}

function block(text: string) {
  return {
    _key: 'b1',
    _type: 'block',
    style: 'normal',
    children: [{_key: 's1', _type: 'span', marks: [], text}],
  }
}

describe('normalizeText', () => {
  it('collapses whitespace runs and trims', () => {
    expect(normalizeText('  a \n\t b  ')).toBe('a b')
  })

  it('composes decomposed accents so the same word compares equal', () => {
    const decomposed = 'Büro'
    const composed = 'Büro'
    // Anti-vacuity: the two spellings are indistinguishable in a source file,
    // which is exactly why the comparison has to normalize.
    expect(decomposed).not.toBe(composed)
    expect(normalizeText(decomposed)).toBe(normalizeText(composed))
  })
})

describe('distillText', () => {
  it('passes a string through', () => {
    expect(distillText('Hallo')).toBe('Hallo')
  })

  it('flattens Portable Text to its span text', () => {
    expect(distillText([block('Erster Satz'), block('Zweiter Satz')])).toBe(
      'Erster Satz Zweiter Satz',
    )
  })

  it('yields nothing for values with no translation to correct', () => {
    expect(distillText(null)).toBe('')
    expect(distillText(42)).toBe('')
    expect(distillText({_type: 'slug', current: 'ada'})).toBe('')
    expect(distillText({_type: 'reference', _ref: 'x'})).toBe('')
  })
})

describe('the noise gate drops what teaches nothing', () => {
  it('drops a whitespace-only edit', () => {
    const delta = computeDistillDelta([locale(MACHINE, `  ${MACHINE.replace(/ /g, '  ')}  `)])
    expect(delta.locales).toEqual([])
    expect(delta.cleanLocales).toEqual(['de-DE'])
    expect(delta.skipReason).toBe('no-human-edits')
  })

  it('drops a punctuation-only edit', () => {
    const delta = computeDistillDelta([locale(`${MACHINE}.`, `${MACHINE}!`)])
    expect(delta.locales).toEqual([])
    expect(delta.cleanLocales).toEqual(['de-DE'])
  })

  it('drops a casing-only edit', () => {
    const delta = computeDistillDelta([locale(MACHINE, MACHINE.toUpperCase())])
    expect(delta.locales).toEqual([])
  })

  it('drops a reordering-only edit', () => {
    const reordered = MACHINE.split(' ').reverse().join(' ')
    const delta = computeDistillDelta([locale(MACHINE, reordered)])
    expect(delta.locales).toEqual([])
  })

  it('drops an accent-normalization-only edit', () => {
    const delta = computeDistillDelta([locale('Das Büro', 'Das Büro')])
    expect(delta.locales).toEqual([])
  })

  it('drops a span whose field the source itself changed', () => {
    const delta = computeDistillDelta(
      [locale(MACHINE, 'Ein ganz anderer Satz ueber etwas Neues und Unbekanntes')],
      {sourceChangedFields: ['bio']},
    )
    expect(delta.locales).toEqual([])
    expect(delta.cleanLocales).toEqual(['de-DE'])
  })

  it('ignores non-text fields entirely', () => {
    const delta = computeDistillDelta([
      {
        locale: 'de-DE',
        machine: {slug: {_type: 'slug', current: 'a'}, order: 1, hero: {_type: 'image'}},
        human: {slug: {_type: 'slug', current: 'b'}, order: 2, hero: null},
      },
    ])
    expect(delta.locales).toEqual([])
  })

  it('ignores the system and language fields a sibling translation carries', () => {
    const delta = computeDistillDelta([
      {
        locale: 'de-DE',
        machine: {_id: 'drafts.a', _rev: 'r1', language: 'de-DE', title: 'Gleich'},
        human: {_id: 'a', _rev: 'r2', language: 'de-DE', title: 'Gleich'},
      },
    ])
    expect(delta.locales).toEqual([])
  })
})

describe('the noise gate keeps real corrections', () => {
  it('keeps a terminology swap and reports both sides', () => {
    const human = MACHINE.replace('Datensatz', 'Dataset')
      .replace('Cloud', 'Content Lake')
      .replace('verwaltet', 'gepflegt')
    const delta = computeDistillDelta([locale(MACHINE, human)])

    expect(delta.locales).toHaveLength(1)
    expect(delta.cleanLocales).toEqual([])
    expect(delta.skipReason).toBeNull()

    const [span] = delta.locales[0].spans
    expect(span.fieldPath).toBe('bio')
    expect(span.machineText).toBe(MACHINE)
    expect(span.humanText).toBe(human)
    expect(span.changedWords).toBeGreaterThanOrEqual(MIN_CHANGED_WORDS)
  })

  it('keeps a Portable Text rewrite, flattened', () => {
    const delta = computeDistillDelta([
      {
        locale: 'de-DE',
        machine: {body: [block('Der Datensatz wird gespeichert')]},
        human: {body: [block('Das Dataset wird abgelegt')]},
      },
    ])
    expect(delta.locales[0].spans[0]).toMatchObject({
      fieldPath: 'body',
      machineText: 'Der Datensatz wird gespeichert',
      humanText: 'Das Dataset wird abgelegt',
    })
  })

  it('counts one field per changed path and totals them', () => {
    const delta = computeDistillDelta([
      {
        locale: 'de-DE',
        machine: {bio: 'Der Datensatz ist gespeichert', 'seo.metaTitle': 'Der Datensatz'},
        human: {bio: 'Das Dataset ist abgelegt', 'seo.metaTitle': 'Das Dataset'},
      },
    ])
    const [only] = delta.locales
    expect(only.spans.map((span) => span.fieldPath)).toEqual(['bio', 'seo.metaTitle'])
    expect(only.changedWords).toBe(only.spans.reduce((total, span) => total + span.changedWords, 0))
    expect(delta.changedWords).toBe(only.changedWords)
  })

  it('treats a field the human filled in as an edit', () => {
    const delta = computeDistillDelta([
      {locale: 'de-DE', machine: {bio: ''}, human: {bio: 'Ein neuer deutscher Satz'}},
    ])
    expect(delta.locales[0].spans[0].changedWords).toBe(4)
  })
})

describe('the changed-word threshold', () => {
  it('skips a one-word fix', () => {
    const delta = computeDistillDelta([locale(MACHINE, MACHINE.replace('Cloud', 'Wolke'))])
    expect(delta.locales).toHaveLength(1)
    expect(delta.changedWords).toBe(2)
    expect(delta.skipReason).toBe('below-threshold')
  })

  it('does not skip once the threshold is met', () => {
    const human = MACHINE.replace('Datensatz', 'Dataset').replace('Cloud', 'Wolke')
    const delta = computeDistillDelta([locale(MACHINE, human)])
    expect(delta.changedWords).toBe(4)
    expect(delta.skipReason).toBeNull()
  })

  it('sums the threshold across locales rather than per locale', () => {
    const delta = computeDistillDelta([
      locale(MACHINE, MACHINE.replace('Cloud', 'Wolke'), 'de-DE'),
      locale(MACHINE, MACHINE.replace('Datensatz', 'Dataset'), 'fr-FR'),
    ])
    expect(delta.locales).toHaveLength(2)
    expect(delta.changedWords).toBe(4)
    expect(delta.skipReason).toBeNull()
  })

  it('reports no-human-edits rather than below-threshold when nothing survived', () => {
    const delta = computeDistillDelta([locale(MACHINE, MACHINE)])
    expect(delta.skipReason).toBe('no-human-edits')
  })

  it('reports no-human-edits for an empty run', () => {
    expect(computeDistillDelta([])).toMatchObject({
      locales: [],
      cleanLocales: [],
      changedWords: 0,
      skipReason: 'no-human-edits',
    })
  })
})

describe('style-only classification', () => {
  it('flags a wholesale rewrite so no term is extracted from it', () => {
    const delta = computeDistillDelta([
      locale('Der Datensatz wird gespeichert', 'Wir bewahren alles sorgfaeltig auf'),
    ])
    const [only] = delta.locales
    expect(only.spans[0].changedRatio).toBeGreaterThan(STYLE_ONLY_RATIO)
    expect(only.styleOnly).toBe(true)
  })

  it('leaves a targeted correction open to term extraction', () => {
    const human = MACHINE.replace('Datensatz', 'Dataset').replace('Cloud', 'Content Lake')
    const delta = computeDistillDelta([locale(MACHINE, human)])
    expect(delta.locales[0].styleOnly).toBe(false)
  })

  it('reads a same-length wholesale swap as a complete change', () => {
    const delta = computeDistillDelta([locale('eins zwei drei', 'vier fuenf sechs')])
    expect(delta.locales[0].spans[0].changedRatio).toBe(1)
  })

  it('spares a locale whose other field was only corrected', () => {
    const delta = computeDistillDelta([
      {
        locale: 'de-DE',
        machine: {'seo.metaTitle': 'Der Datensatz', bio: MACHINE},
        human: {
          'seo.metaTitle': 'Das Handbuch',
          bio: MACHINE.replace('Datensatz', 'Dataset').replace('Cloud', 'Content Lake'),
        },
      },
    ])
    const [only] = delta.locales
    const rewritten = only.spans.filter((span) => span.changedRatio > STYLE_ONLY_RATIO)
    expect(rewritten.map((span) => span.fieldPath)).toEqual(['seo.metaTitle'])
    expect(only.styleOnly).toBe(false)
  })

  it('is per locale, not per run', () => {
    const targeted = MACHINE.replace('Datensatz', 'Dataset').replace('Cloud', 'Content Lake')
    const delta = computeDistillDelta([
      locale(MACHINE, targeted, 'de-DE'),
      locale('Der Datensatz wird gespeichert', 'Wir bewahren alles sorgfaeltig auf', 'fr-FR'),
    ])
    expect(delta.locales.map((entry) => [entry.locale, entry.styleOnly])).toEqual([
      ['de-DE', false],
      ['fr-FR', true],
    ])
  })
})

describe('clean locales', () => {
  it('separates untouched locales from edited ones', () => {
    const human = MACHINE.replace('Datensatz', 'Dataset').replace('Cloud', 'Content Lake')
    const delta = computeDistillDelta([
      locale(MACHINE, human, 'de-DE'),
      locale(MACHINE, MACHINE, 'fr-FR'),
      locale(MACHINE, `${MACHINE}.`, 'ja-JP'),
    ])
    expect(delta.locales.map((entry) => entry.locale)).toEqual(['de-DE'])
    expect(delta.cleanLocales).toEqual(['fr-FR', 'ja-JP'])
  })
})
