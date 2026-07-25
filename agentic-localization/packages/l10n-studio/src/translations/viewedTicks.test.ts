import {describe, expect, it} from 'vitest'

import {fingerprint, isViewed, NO_TICKS, toggleViewed, viewedCount, viewedKey} from './viewedTicks'

describe('fingerprint', () => {
  it('is stable across key order', () => {
    expect(fingerprint({a: 1, b: 2})).toBe(fingerprint({b: 2, a: 1}))
  })

  it('ignores Sanity keys, so a re-keyed block is the same content', () => {
    const before = [{_type: 'block', _key: 'aaa', children: [{_type: 'span', text: 'hi'}]}]
    const after = [{_type: 'block', _key: 'zzz', children: [{_type: 'span', text: 'hi'}]}]
    expect(fingerprint(before)).toBe(fingerprint(after))
  })

  it('moves when the text moves', () => {
    expect(fingerprint('Bonjour')).not.toBe(fingerprint('Bonsoir'))
  })

  it('tells an absent value from an empty one', () => {
    expect(fingerprint(undefined)).not.toBe(fingerprint(''))
  })
})

describe('ticks', () => {
  const key = viewedKey('fr-FR', 'body')

  it('ticks and un-ticks the same pair', () => {
    const stamp = fingerprint('Bonjour')
    const ticked = toggleViewed(NO_TICKS, key, stamp)

    expect(isViewed(ticked, key, stamp)).toBe(true)
    expect(isViewed(toggleViewed(ticked, key, stamp), key, stamp)).toBe(false)
  })

  it('un-ticks itself when the value changes underneath', () => {
    const ticked = toggleViewed(NO_TICKS, key, fingerprint('Bonjour'))

    expect(isViewed(ticked, key, fingerprint('Bonsoir'))).toBe(false)
  })

  it('re-ticks against the new value', () => {
    const ticked = toggleViewed(NO_TICKS, key, fingerprint('Bonjour'))
    const next = fingerprint('Bonsoir')

    expect(isViewed(toggleViewed(ticked, key, next), key, next)).toBe(true)
  })

  it('keys pairs, not locales', () => {
    const stamp = fingerprint('Bonjour')
    const ticks = toggleViewed(NO_TICKS, viewedKey('fr-FR', 'body'), stamp)

    expect(isViewed(ticks, viewedKey('de-DE', 'body'), stamp)).toBe(false)
    expect(isViewed(ticks, viewedKey('fr-FR', 'title'), stamp)).toBe(false)
  })

  it('counts only the pairs still matching their value', () => {
    const stale = viewedKey('de-DE', 'title')
    const fresh = viewedKey('fr-FR', 'title')
    let ticks = toggleViewed(NO_TICKS, stale, fingerprint('alt'))
    ticks = toggleViewed(ticks, fresh, fingerprint('neuf'))

    expect(
      viewedCount(ticks, [
        {key: stale, fingerprint: fingerprint('neu')},
        {key: fresh, fingerprint: fingerprint('neuf')},
      ]),
    ).toBe(1)
  })
})
