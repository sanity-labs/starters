import {describe, it, expect} from 'vitest'
import {sanitizeEmailHtml} from './index.js'
import {renderPromotionKlaviyo} from '../index.js'

const wrap = (body: string) =>
  `<!doctype html><html><head><style>body{margin:0}</style></head><body>${body}</body></html>`

describe('sanitizeEmailHtml', () => {
  it('removes script tags but keeps surrounding content', () => {
    const out = sanitizeEmailHtml(wrap('<p>Safe</p><script>alert(1)</script>'))
    expect(out).not.toContain('<script')
    expect(out).toContain('<p>Safe</p>')
  })

  it('strips inline event handlers and javascript: URLs', () => {
    const out = sanitizeEmailHtml(
      wrap(
        '<img src="https://cdn.sanity.io/x.jpg" onerror="alert(1)"><a href="javascript:alert(1)">x</a>',
      ),
    )
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('https://cdn.sanity.io/x.jpg')
  })

  it('does not let a > inside a quoted attribute split the tag (chunking regression)', () => {
    // With chunk-at-last-'>' sanitizing this became `<img src="x` + `y" onerror=...>`
    const out = sanitizeEmailHtml(wrap('<img src="x>y" onerror="alert(1)">'))
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('alert(1)')
  })

  it('forbids embeds and forms even though DOMPurify allows some by default', () => {
    const out = sanitizeEmailHtml(
      wrap(
        '<form action="https://evil.example"><input name="pw"><button>Go</button></form><iframe src="https://evil.example"></iframe>',
      ),
    )
    for (const tag of ['<form', '<input', '<button', '<iframe']) expect(out).not.toContain(tag)
  })

  it('keeps the document scaffolding a full-page preview needs', () => {
    const out = sanitizeEmailHtml(wrap('<table bgcolor="#ffffff"><tr><td>Cell</td></tr></table>'))
    expect(out.startsWith('<!doctype html>')).toBe(true)
    expect(out).toContain('<html')
    expect(out).toContain('<head>')
    expect(out).toContain('<style>body{margin:0}</style>')
    expect(out).toContain('<table bgcolor="#ffffff">')
  })

  it('leaves Klaviyo Handlebars tokens intact in text and href', () => {
    const out = sanitizeEmailHtml(
      wrap('<p>Hi {{ profile.first_name }}</p><a href="{{ unsubscribe_url }}">Unsubscribe</a>'),
    )
    expect(out).toContain('Hi {{ profile.first_name }}')
    expect(out).toContain('href="{{ unsubscribe_url }}"')
  })

  it('preserves the content of a real MJML render', async () => {
    const rendered = await renderPromotionKlaviyo({
      disruptor: 'New',
      emailSlots: [
        {_type: 'emailSection', headline: 'Big Sale Headline', body: 'Up to 50% off'},
        {_type: 'emailCTA', text: 'Shop Now', url: 'https://example.com/sale'},
        {_type: 'emailFooter', legalText: 'Legal text here'},
      ],
    })
    const out = sanitizeEmailHtml(rendered)
    for (const text of ['Big Sale Headline', 'Up to 50% off', 'Shop Now', 'Legal text here']) {
      expect(out).toContain(text)
    }
    expect(out).toContain('href="https://example.com/sale"')
    expect(out).toContain('{{ unsubscribe_url }}')
    expect(out).toContain('<style')
  })
})
