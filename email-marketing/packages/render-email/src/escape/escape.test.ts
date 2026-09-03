import {describe, it, expect} from 'vitest'
import {escapeHtml, safeHttpUrl} from './index.js'

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })

  it('renders nullish input as an empty string', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('leaves Handlebars tokens intact so Klaviyo can resolve them at send time', () => {
    expect(escapeHtml('Hi {{ profile.first_name }}')).toBe('Hi {{ profile.first_name }}')
  })

  it('neutralizes a script payload', () => {
    const out = escapeHtml('<script>alert(1)</script>')
    expect(out).not.toContain('<script')
    expect(out).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})

describe('safeHttpUrl', () => {
  it('accepts absolute http and https URLs', () => {
    expect(safeHttpUrl('https://example.com/sale?a=1&b=2')).toBe('https://example.com/sale?a=1&b=2')
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com')
  })

  it('trims surrounding whitespace', () => {
    expect(safeHttpUrl('  https://example.com  ')).toBe('https://example.com')
  })

  it('rejects javascript:, data:, and vbscript: schemes', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeHttpUrl('JavaScript:alert(1)')).toBeUndefined()
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(safeHttpUrl('vbscript:msgbox(1)')).toBeUndefined()
  })

  it('rejects relative, empty, and nullish values', () => {
    expect(safeHttpUrl('/relative/path')).toBeUndefined()
    expect(safeHttpUrl('example.com')).toBeUndefined()
    expect(safeHttpUrl('')).toBeUndefined()
    expect(safeHttpUrl(null)).toBeUndefined()
    expect(safeHttpUrl(undefined)).toBeUndefined()
  })
})
