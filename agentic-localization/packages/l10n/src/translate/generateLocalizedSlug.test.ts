import {describe, expect, it} from 'vitest'

import {generateLocalizedSlug} from './generateLocalizedSlug'

describe('generateLocalizedSlug', () => {
  it('slugifies a title and prefixes the locale path', () => {
    expect(generateLocalizedSlug('The Acme Widget Launch', 'es-MX')).toEqual({
      current: 'the-acme-widget-launch',
      fullUrl: '/es-mx/the-acme-widget-launch',
    })
  })

  it('strips diacritics and punctuation', () => {
    expect(generateLocalizedSlug('Café — crème brûlée!', 'fr-FR').current).toBe('cafe-creme-brulee')
  })

  it('caps the slug at 60 characters', () => {
    const slug = generateLocalizedSlug('a'.repeat(80), 'de-DE').current
    expect(slug).toHaveLength(60)
  })
})
