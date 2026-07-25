import {describe, expect, it} from 'vitest'

import {changedCharCount, diffBlockTexts, diffTextSegments} from './textDiff'

/** Compact form for assertions: `+added`, `-removed`, bare unchanged. */
function shape(fromText: string, toText: string): string[] {
  return diffTextSegments(fromText, toText).map(
    (segment) =>
      `${segment.action === 'added' ? '+' : segment.action === 'removed' ? '-' : ''}${segment.text}`,
  )
}

function block(text: string, key = text): unknown {
  return {_type: 'block', _key: key, children: [{_type: 'span', text}]}
}

describe('diffTextSegments', () => {
  /**
   * The named mismatch behind adopting `@sanity/diff`: it is character-granular
   * where `diffWords` was word-granular. These are the pairs a translation
   * review actually produces, and the assertion is that each one still reads as
   * whole words in a space-delimited script.
   */
  it('keeps a word swap on word boundaries', () => {
    expect(shape('The quick brown fox', 'The quick red fox')).toEqual([
      'The quick ',
      '-brown',
      '+red',
      ' fox',
    ])
  })

  it('keeps an inflection change on word boundaries rather than on morphemes', () => {
    // Raw character granularity splits this as `Katze` + `+n` and `schl` + `-äft`
    // + `+afen` — two half-words. Both edits come back whole.
    expect(shape('Die Katze schläft auf dem Sofa', 'Die Katzen schlafen auf dem Sofa')).toEqual([
      'Die ',
      '-Katze',
      '+Katzen',
      ' ',
      '-schläft',
      '+schlafen',
      ' auf dem Sofa',
    ])
  })

  it('reports a mid-sentence insertion as inserted words only', () => {
    expect(shape('We ship on Monday.', 'We ship the new release on Monday.')).toEqual([
      'We ship ',
      '+the new release ',
      'on Monday.',
    ])
  })

  it('reports a head-of-string insertion without cutting the first word in half', () => {
    // The case raw `cleanupSemantic` gets wrong: removed `N` / added `Viktiga n`.
    expect(shape('Nyheter om produkten', 'Viktiga nyheter om produkten')).toEqual([
      '-Nyheter',
      '+Viktiga nyheter',
      ' om produkten',
    ])
  })

  it('leaves an unsegmented script at character granularity', () => {
    // Japanese has no word delimiter, so growing to a "word boundary" would
    // swallow the sentence. One inserted ideograph stays one inserted ideograph.
    expect(shape('これは製品の説明です。', 'これは新製品の説明です。')).toEqual([
      'これは',
      '+新',
      '製品の説明です。',
    ])
  })

  it('keeps a CJK rewrite as coherent runs', () => {
    // `diffWords` fragments this into six alternating pairs — there is no
    // whitespace to tokenize on. The semantic cleanup keeps it to three.
    expect(
      shape('弊社の製品は世界中で使われています。', '当社のサービスは世界各国で利用されています。'),
    ).toEqual([
      '-弊',
      '+当',
      '社の',
      '-製品は世界中で使わ',
      '+サービスは世界各国で利用さ',
      'れています。',
    ])
  })

  it('reports a trailing punctuation edit without touching the word before it', () => {
    expect(shape('Hello world', 'Hello world!')).toEqual(['Hello world', '+!'])
  })

  it('reports a full rewrite as one removal and one addition', () => {
    expect(shape('The cat sat on the mat', 'Un perro corrió por el parque')).toEqual([
      '-The cat sat on the mat',
      '+Un perro corrió por el parque',
    ])
  })

  it('returns one unchanged segment for equal strings', () => {
    expect(diffTextSegments('same', 'same')).toEqual([{action: 'unchanged', text: 'same'}])
  })

  it('handles an empty side', () => {
    expect(shape('', 'Neuer Text')).toEqual(['+Neuer Text'])
    expect(shape('Alter Text', '')).toEqual(['-Alter Text'])
    expect(diffTextSegments('', '')).toEqual([])
  })
})

describe('diffTextSegments losslessness', () => {
  /**
   * The invariant the word alignment rests on: it only moves text into both
   * sides of a change at once, so the two strings the segments reconstruct are
   * still exactly the two strings that went in. Anything else would put text in
   * front of a reviewer that neither revision contains.
   */
  const PAIRS: Array<[string, string]> = [
    ['The quick brown fox', 'The quick red fox'],
    ['Die Katze schläft auf dem Sofa', 'Die Katzen schlafen auf dem Sofa'],
    ['Nyheter om produkten', 'Viktiga nyheter om produkten'],
    ['これは製品の説明です。', 'これは新製品の説明です。'],
    ['a b c d e f g', 'a X c Y e Z g'],
    ['Größe und Maß', 'Grösse und Mass'],
    ['no-break space here', 'no-break spaces here'],
    ['emoji 🎉 party', 'emoji 🎊 party'],
    ['', 'all new'],
    ['all gone', ''],
  ]

  it.each(PAIRS)('reconstructs both sides of %j → %j', (fromText, toText) => {
    const segments = diffTextSegments(fromText, toText)
    const reconstruct = (skip: string) =>
      segments
        .filter((segment) => segment.action !== skip)
        .map((segment) => segment.text)
        .join('')

    expect(reconstruct('added')).toBe(fromText)
    expect(reconstruct('removed')).toBe(toText)
  })
})

describe('changedCharCount', () => {
  it('counts added and removed characters on both sides', () => {
    expect(changedCharCount(diffTextSegments('The quick brown fox', 'The quick red fox'))).toBe(8)
  })

  it('counts nothing for equal strings', () => {
    expect(changedCharCount(diffTextSegments('same', 'same'))).toBe(0)
  })
})

describe('diffBlockTexts', () => {
  it('pairs an edited block into one row so the reviewer reads a word diff', () => {
    const rows = diffBlockTexts(
      [block('Intro.'), block('Second paragraph here.'), block('Third.')],
      [block('Intro.'), block('Second paragraph, edited.'), block('Third.')],
    )

    expect(rows).toEqual([
      {blockNumber: 1, type: 'context', oldText: 'Intro.', newText: 'Intro.'},
      {
        blockNumber: 2,
        type: 'changed',
        oldText: 'Second paragraph here.',
        newText: 'Second paragraph, edited.',
      },
      {blockNumber: 3, type: 'context', oldText: 'Third.', newText: 'Third.'},
    ])
  })

  it('reports a reordered block as moved rather than as a removal plus an addition', () => {
    const rows = diffBlockTexts(
      [block('A'), block('B'), block('C')],
      [block('C'), block('A'), block('B')],
    )

    expect(rows.filter((row) => row.type === 'moved')).toEqual([
      {blockNumber: 1, type: 'moved', oldText: 'C', newText: 'C'},
    ])
  })

  it('zips a multi-block rewrite position by position', () => {
    const rows = diffBlockTexts([block('A'), block('B')], [block('X'), block('Y')])

    expect(rows).toEqual([
      {blockNumber: 1, type: 'changed', oldText: 'A', newText: 'X'},
      {blockNumber: 2, type: 'changed', oldText: 'B', newText: 'Y'},
    ])
  })

  it('keeps an insertion separate from an edit that follows it', () => {
    const rows = diffBlockTexts(
      [block('A'), block('B'), block('C')],
      [block('NEW'), block('A'), block('B2'), block('C')],
    )

    expect(rows).toEqual([
      {blockNumber: 1, type: 'added', newText: 'NEW'},
      {blockNumber: 2, type: 'context', oldText: 'A', newText: 'A'},
      {blockNumber: 3, type: 'changed', oldText: 'B', newText: 'B2'},
      {blockNumber: 4, type: 'context', oldText: 'C', newText: 'C'},
    ])
  })

  it('reports a removed block at the position it left', () => {
    const rows = diffBlockTexts([block('A'), block('B'), block('C')], [block('A'), block('C')])

    expect(rows).toEqual([
      {blockNumber: 1, type: 'context', oldText: 'A', newText: 'A'},
      {blockNumber: 2, type: 'removed', oldText: 'B'},
      {blockNumber: 2, type: 'context', oldText: 'C', newText: 'C'},
    ])
  })

  it('separates non-adjacent change groups and drops the blocks between them', () => {
    const unchanged = ['u1', 'u2', 'u3', 'u4', 'u5'].map((text) => block(text))
    const rows = diffBlockTexts(
      [block('first'), ...unchanged, block('last')],
      [block('first edited'), ...unchanged, block('last edited')],
    )

    expect(rows.map((row) => `${row.type}:${row.newText ?? row.oldText ?? ''}`)).toEqual([
      'changed:first edited',
      'context:u1',
      'separator:',
      'context:u5',
      'changed:last edited',
    ])
  })

  it('reports no change for identical arrays', () => {
    const blocks = [block('A'), block('B')]
    expect(diffBlockTexts(blocks, blocks)).toEqual([])
  })

  it('handles an empty side', () => {
    expect(diffBlockTexts([], [block('A')])).toEqual([
      {blockNumber: 1, type: 'added', newText: 'A'},
    ])
    expect(diffBlockTexts([block('A')], [])).toEqual([
      {blockNumber: 1, type: 'removed', oldText: 'A'},
    ])
  })

  it('names a non-text block by its type', () => {
    const rows = diffBlockTexts([], [{_type: 'image', _key: 'i1', asset: {_ref: 'image-abc'}}])
    expect(rows).toEqual([{blockNumber: 1, type: 'added', newText: '[image]'}])
  })
})
