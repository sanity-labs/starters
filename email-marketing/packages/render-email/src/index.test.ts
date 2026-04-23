import {describe, it, expect} from 'vitest'
import {renderPromotionLocal, renderPromotionKlaviyo} from './index.js'

const BASE_PROMOTION = {
  subjectLine: 'Test Subject',
  preheader: 'Test preheader',
  disruptor: 'New',
  emailSlots: [
    {_type: 'emailHeader' as const, brandName: 'Test Brand'},
    {
      _type: 'emailSection' as const,
      headline: 'Big Sale Headline',
      body: 'Up to 50% off everything',
      imageUrl: 'https://example.com/image.jpg',
    },
    {
      _type: 'emailCTA' as const,
      text: 'Shop Now',
      url: 'https://example.com/sale',
      style: 'primary' as const,
    },
    {_type: 'emailDivider' as const, spacing: 'medium' as const},
    {
      _type: 'emailSection' as const,
      headline: 'Featured Products',
    },
    {
      _type: 'emailFooter' as const,
      legalText: 'Legal text here',
      unsubscribeText: 'Unsubscribe',
    },
  ],
}

describe('renderPromotionLocal', () => {
  it('returns an HTML string', async () => {
    const html = await renderPromotionLocal(BASE_PROMOTION)
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
  })

  it('includes section headlines', async () => {
    const html = await renderPromotionLocal(BASE_PROMOTION)
    expect(html).toContain('Big Sale Headline')
    expect(html).toContain('Featured Products')
  })

  it('includes section body text', async () => {
    const html = await renderPromotionLocal(BASE_PROMOTION)
    expect(html).toContain('Up to 50% off everything')
  })

  it('includes CTA text', async () => {
    const html = await renderPromotionLocal(BASE_PROMOTION)
    expect(html).toContain('Shop Now')
  })

  it('includes image src', async () => {
    const html = await renderPromotionLocal(BASE_PROMOTION)
    expect(html).toContain('https://example.com/image.jpg')
  })

  it('renders disruptor banner', async () => {
    const html = await renderPromotionLocal(BASE_PROMOTION)
    expect(html).toContain('New')
  })

  it('renders header brand name', async () => {
    const html = await renderPromotionLocal(BASE_PROMOTION)
    expect(html).toContain('Test Brand')
  })

  it('renders footer legal text', async () => {
    const html = await renderPromotionLocal(BASE_PROMOTION)
    expect(html).toContain('Legal text here')
  })

  it('resolves preview context tokens', async () => {
    const promotion = {
      emailSlots: [
        {
          _type: 'emailSection' as const,
          headline: 'Hi {{ first_name }}, check this out',
        },
      ],
    }
    const html = await renderPromotionLocal(promotion, {first_name: 'Sarah'})
    expect(html).toContain('Hi Sarah, check this out')
    expect(html).not.toContain('{{ first_name }}')
  })

  it('stubs remaining Klaviyo tags with fallback values', async () => {
    const html = await renderPromotionLocal(BASE_PROMOTION)
    // unsubscribe_url is in the footer — should be replaced with fallback
    expect(html).not.toContain('{{ unsubscribe_url }}')
  })

  it('handles promotion with no emailSlots', async () => {
    const html = await renderPromotionLocal({emailSlots: []})
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
  })

  it('handles promotion with null emailSlots', async () => {
    const html = await renderPromotionLocal({emailSlots: null})
    expect(typeof html).toBe('string')
  })

  it('escapes HTML entities in block content', async () => {
    const promotion = {
      emailSlots: [
        {
          _type: 'emailSection' as const,
          headline: '<script>alert("xss")</script>',
        },
      ],
    }
    const html = await renderPromotionLocal(promotion)
    expect(html).not.toContain('<script>')
  })
})

describe('renderPromotionKlaviyo', () => {
  it('returns an HTML string', async () => {
    const html = await renderPromotionKlaviyo(BASE_PROMOTION)
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
  })

  it('includes section headlines', async () => {
    const html = await renderPromotionKlaviyo(BASE_PROMOTION)
    expect(html).toContain('Big Sale Headline')
  })

  it('preserves Klaviyo unsubscribe token in footer', async () => {
    const html = await renderPromotionKlaviyo(BASE_PROMOTION)
    expect(html).toContain('{{ unsubscribe_url }}')
  })

  it('does not substitute preview context tokens', async () => {
    const promotion = {
      emailSlots: [
        {
          _type: 'emailSection' as const,
          headline: 'Hi {{ profile.first_name }}',
        },
      ],
    }
    const html = await renderPromotionKlaviyo(promotion)
    expect(html).toContain('{{ profile.first_name }}')
  })
})
