import {describe, it, expect} from 'vitest'
import {stubResendTags, buildPreviewStatus, resolvePreviewContext} from './index.js'

describe('stubResendTags', () => {
  it('replaces {{{RESEND_UNSUBSCRIBE_URL}}} with fallback', () => {
    const html = 'Click here: {{{RESEND_UNSUBSCRIBE_URL}}}'
    const {html: result, resolved} = stubResendTags(html)
    expect(result).toContain('https://resend.com/unsubscribe')
    expect(resolved['RESEND_UNSUBSCRIBE_URL']).toBe(false)
  })

  it('marks RESEND_UNSUBSCRIBE_URL as true when not in HTML', () => {
    const {resolved} = stubResendTags('Hello world')
    expect(resolved['RESEND_UNSUBSCRIBE_URL']).toBe(true)
  })

  it('handles extra whitespace in tags', () => {
    const html = 'Click: {{{  RESEND_UNSUBSCRIBE_URL  }}}'
    const {html: result, resolved} = stubResendTags(html)
    expect(result).toContain('https://resend.com/unsubscribe')
    expect(resolved['RESEND_UNSUBSCRIBE_URL']).toBe(false)
  })

  it('marks tag as true when none present', () => {
    const {resolved} = stubResendTags('Empty HTML')
    expect(resolved['RESEND_UNSUBSCRIBE_URL']).toBe(true)
  })

  it('replaces all instances of a tag', () => {
    const html = '{{{RESEND_UNSUBSCRIBE_URL}}} and again {{{RESEND_UNSUBSCRIBE_URL}}}'
    const {html: result} = stubResendTags(html)
    const count = (result.match(/https:\/\/resend\.com\/unsubscribe/g) || []).length
    expect(count).toBe(2)
  })

  it('does not match double-brace Klaviyo-style tags', () => {
    // Resend uses triple-brace; double-brace should not be substituted
    const html = '{{ RESEND_UNSUBSCRIBE_URL }}'
    const {html: result, resolved} = stubResendTags(html)
    expect(result).toBe(html)
    expect(resolved['RESEND_UNSUBSCRIBE_URL']).toBe(true)
  })

  it('empty HTML returns all resolved as true', () => {
    const {resolved} = stubResendTags('')
    expect(resolved['RESEND_UNSUBSCRIBE_URL']).toBe(true)
  })
})

describe('resolvePreviewContext', () => {
  it('replaces token with sample from context', () => {
    const context = {
      custom_field: {sample: 'sample_value', description: 'A custom field'},
    }
    const html = 'Value: {{ custom_field }}'
    const {html: result, resolved} = resolvePreviewContext(context, html)
    expect(result).toContain('sample_value')
    expect(resolved['custom_field']).toBe(true)
  })

  it('marks token as undefined (not in resolved) when not in HTML', () => {
    const context = {
      custom_field: {sample: 'value', description: 'desc'},
    }
    const {resolved} = resolvePreviewContext(context, 'Some HTML without the token')
    expect(resolved['custom_field']).toBeUndefined()
  })

  it('handles multiple tokens in context', () => {
    const context = {
      field1: {sample: 'value1', description: 'first'},
      field2: {sample: 'value2', description: 'second'},
    }
    const html = '{{ field1 }} and {{ field2 }}'
    const {html: result, resolved} = resolvePreviewContext(context, html)
    expect(result).toContain('value1')
    expect(result).toContain('value2')
    expect(resolved['field1']).toBe(true)
    expect(resolved['field2']).toBe(true)
  })

  it('replaces all instances of a token', () => {
    const context = {token: {sample: 'X', description: 'test'}}
    const html = '{{ token }} and {{ token }}'
    const {html: result} = resolvePreviewContext(context, html)
    const count = (result.match(/X/g) || []).length
    expect(count).toBe(2)
  })

  it('empty context returns empty resolved', () => {
    const {resolved} = resolvePreviewContext({}, '{{ anything }}')
    expect(Object.keys(resolved)).toHaveLength(0)
  })
})

describe('buildPreviewStatus', () => {
  it('returns high accuracy when all resolved', () => {
    const status = buildPreviewStatus('html', {a: true, b: true, c: true})
    expect(status.accuracy).toBe('high')
  })

  it('returns low accuracy when none resolved', () => {
    const status = buildPreviewStatus('html', {a: false, b: false, c: false})
    expect(status.accuracy).toBe('low')
  })

  it('returns medium accuracy for half resolved', () => {
    const status = buildPreviewStatus('html', {a: true, b: false})
    expect(status.accuracy).toBe('medium')
  })

  it('returns high accuracy for empty input (nothing to resolve)', () => {
    const status = buildPreviewStatus('html', {})
    expect(status.accuracy).toBe('high')
  })

  it('maps true entries to sample in resolved', () => {
    const status = buildPreviewStatus('html', {a: true, b: false})
    expect(status.resolved).toEqual({a: 'sample'})
  })

  it('maps false entries to send-time-only in stubbed', () => {
    const status = buildPreviewStatus('html', {a: false, b: true, c: false})
    expect(status.stubbed).toEqual({a: 'send-time-only', c: 'send-time-only'})
  })

  it('includes ISO timestamp', () => {
    const status = buildPreviewStatus('html', {})
    expect(status.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('returns low accuracy when 1 of 3 resolved', () => {
    const status = buildPreviewStatus('html', {a: true, b: false, c: false})
    expect(status.accuracy).toBe('low')
  })
})
