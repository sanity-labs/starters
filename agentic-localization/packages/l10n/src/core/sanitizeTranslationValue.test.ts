import {describe, expect, it} from 'vitest'

import {sanitizeTranslationValue} from './sanitizeTranslationValue'

/** Built from char codes: none of these are writable as source text. */
const NUL = String.fromCharCode(0x0000)
const NON_CHARACTER_FE = String.fromCharCode(0xfffe)
const NON_CHARACTER_FF = String.fromCharCode(0xffff)
const HIGH_SURROGATE = String.fromCharCode(0xd800)
const LOW_SURROGATE = String.fromCharCode(0xdc00)

describe('sanitizeTranslationValue', () => {
  it.each([
    ['null byte', NUL],
    ['U+FFFE', NON_CHARACTER_FE],
    ['U+FFFF', NON_CHARACTER_FF],
    ['lone high surrogate', HIGH_SURROGATE],
    ['lone low surrogate', LOW_SURROGATE],
  ])('strips a %s, which fails the whole transaction otherwise', (_label, code) => {
    expect(sanitizeTranslationValue(`a${code}b`)).toBe('ab')
  })

  it('keeps a well-formed surrogate pair', () => {
    const emoji = `${HIGH_SURROGATE}${String.fromCharCode(0xdd7b)}`
    expect(sanitizeTranslationValue(`a${emoji}b`)).toBe(`a${emoji}b`)
  })

  it('walks arrays and nested objects', () => {
    expect(
      sanitizeTranslationValue([
        {_type: 'block', children: [{_type: 'span', text: `hi${HIGH_SURROGATE}`}]},
        `t${NUL}`,
      ]),
    ).toEqual([{_type: 'block', children: [{_type: 'span', text: 'hi'}]}, 't'])
  })

  it('passes non-string leaves through', () => {
    expect(sanitizeTranslationValue({n: 1, b: true, x: null})).toEqual({n: 1, b: true, x: null})
  })
})
