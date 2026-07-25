import {describe, expect, it} from 'vitest'

import {computeFieldChanges, computeMagnitude, detectFieldType} from './computeFieldChanges'

function ptBlock(text: string, key = text): unknown {
  return {_type: 'block', _key: key, children: [{_type: 'span', _key: `${key}s`, text}]}
}

function magnitudeOf(fieldName: string, oldDoc: object, newDoc: object): string | undefined {
  return computeFieldChanges({...oldDoc}, {...newDoc}).find(
    (change) => change.fieldName === fieldName,
  )?.magnitude
}

describe('computeMagnitude', () => {
  it('scores an insertion at the head of a string by what it inserted', () => {
    // The regression the positional scan produced: shifting the text by two
    // characters made every later character compare unequal, so this read as a
    // full rewrite. It is a two-character prefix.
    expect(computeMagnitude('produkten om nyheter', 'X produkten om nyheter')).toBe('minor')
  })

  it('scores the same insertion at the tail the same way', () => {
    expect(computeMagnitude('produkten om nyheter', 'produkten om nyheter X')).toBe('minor')
  })

  it('scores a word swap in a sentence as updated', () => {
    expect(computeMagnitude('The quick brown fox', 'The quick red fox')).toBe('updated')
  })

  it('scores a replacement of the whole value as rewritten', () => {
    expect(computeMagnitude('The cat sat on the mat', 'Un perro corrió por el parque')).toBe(
      'rewritten',
    )
  })

  it('scores a typo fix in a long paragraph as minor', () => {
    const paragraph = 'Sanity keeps content as structured data. '.repeat(5)
    expect(computeMagnitude(paragraph, paragraph.replace('keeps', 'kepes'))).toBe('minor')
  })

  it('reports absence on either side rather than a ratio', () => {
    expect(computeMagnitude(undefined, 'new')).toBe('added')
    expect(computeMagnitude('old', undefined)).toBe('removed')
    expect(computeMagnitude(undefined, undefined)).toBe('unchanged')
    expect(computeMagnitude('same', 'same')).toBe('unchanged')
  })

  it('treats a deeply empty value as absent', () => {
    // A machine result that echoed the field's envelope and nothing else has not
    // added content.
    expect(computeMagnitude(undefined, {_type: 'image'})).toBe('unchanged')
    expect(computeMagnitude([], [])).toBe('unchanged')
    expect(computeMagnitude([], [ptBlock('New paragraph.')])).toBe('added')
  })

  it('scores an edit inside one Portable Text block against the whole field', () => {
    const body = [ptBlock('The first paragraph is long enough to matter here.'), ptBlock('Second.')]
    const edited = [body[0], ptBlock('Second!', 'Second')]
    expect(computeMagnitude(body, edited)).toBe('minor')
  })

  it('scores a Portable Text field the run rewrote as rewritten', () => {
    expect(
      computeMagnitude(
        [ptBlock('The cat sat on the mat.')],
        [ptBlock('Un perro corrió por el parque.', 'The cat sat on the mat.')],
      ),
    ).toBe('rewritten')
  })
})

describe('detectFieldType', () => {
  it('reads a declared _type over the JS type', () => {
    expect(detectFieldType(undefined, {_type: 'image', asset: {_ref: 'image-abc'}})).toBe('image')
    expect(detectFieldType(undefined, {_type: 'reference', _ref: 'doc-1'})).toBe('reference')
  })

  it('reads a reference written without its _type', () => {
    expect(detectFieldType(undefined, {_ref: 'doc-1'})).toBe('reference')
  })

  it('separates Portable Text from any other array', () => {
    expect(detectFieldType(undefined, [ptBlock('Text')])).toBe('portableText')
    expect(detectFieldType(undefined, ['a', 'b'])).toBe('array')
  })

  it('reads the scalars', () => {
    expect(detectFieldType(undefined, 'title')).toBe('string')
    expect(detectFieldType(undefined, 3)).toBe('number')
    expect(detectFieldType(undefined, true)).toBe('boolean')
  })

  it('falls back to other for a value it cannot classify', () => {
    expect(detectFieldType(undefined, {_type: 'slug', current: 'x'})).toBe('other')
    expect(detectFieldType(undefined, undefined)).toBe('other')
    expect(detectFieldType(undefined, null)).toBe('other')
  })

  it('prefers the new value, then the old', () => {
    expect(detectFieldType('old title', undefined)).toBe('string')
    expect(detectFieldType(3, 'now a string')).toBe('string')
  })
})

describe('computeFieldChanges', () => {
  const base = {
    _id: 'article-1',
    _type: 'article',
    _rev: 'rev-1',
    language: 'en-US',
    title: 'Structured content',
    excerpt: 'Why it matters',
  }

  it('ignores the document envelope and the locale marker', () => {
    const changes = computeFieldChanges(base, {
      ...base,
      _id: 'article-2',
      _rev: 'rev-2',
      language: 'de-DE',
    })

    expect(changes.map((change) => change.fieldName).sort()).toEqual(['excerpt', 'title'])
    expect(changes.every((change) => !change.changed)).toBe(true)
  })

  it('reports a field that only exists on one side', () => {
    expect(magnitudeOf('excerpt', base, {...base, excerpt: undefined})).toBe('removed')
    expect(magnitudeOf('subtitle', base, {...base, subtitle: 'New'})).toBe('added')
  })

  it('sorts the most severe change first', () => {
    const changes = computeFieldChanges(base, {
      ...base,
      title: 'Structured content!',
      excerpt: 'A completely different summary of the piece',
    })

    expect(changes.map((change) => [change.fieldName, change.magnitude])).toEqual([
      ['excerpt', 'rewritten'],
      ['title', 'minor'],
    ])
  })

  it('carries both values through for the diff renderer', () => {
    const changes = computeFieldChanges(base, {...base, title: 'Structured data'})
    const title = changes.find((change) => change.fieldName === 'title')

    expect(title).toMatchObject({
      changed: true,
      fieldType: 'string',
      oldValue: 'Structured content',
      newValue: 'Structured data',
    })
  })

  it('returns nothing for two empty documents', () => {
    expect(computeFieldChanges({}, {})).toEqual([])
  })
})
