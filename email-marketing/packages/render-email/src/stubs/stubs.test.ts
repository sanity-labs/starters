import {describe, it, expect} from 'vitest'
import {stubKlaviyoTags, buildPreviewStatus, resolvePreviewContext} from './index.js'

describe('stubKlaviyoTags', () => {
  it('replaces {{ unsubscribe_url }} with fallback', () => {
    const html = 'Click here: {{ unsubscribe_url }}'
    const {html: result, resolved} = stubKlaviyoTags(html)
    expect(result).toContain('https://manage.klaviyo.com/unsubscribe')
    expect(resolved['unsubscribe_url']).toBe(false)
  })

  it('marks unsubscribe_url as true when not in HTML', () => {
    const {resolved} = stubKlaviyoTags('Hello world')
    expect(resolved['unsubscribe_url']).toBe(true)
  })

  it('replaces profile.email with fallback', () => {
    const html = 'Email: {{ profile.email }}'
    const {html: result, resolved} = stubKlaviyoTags(html)
    expect(result).toContain('subscriber@example.com')
    expect(resolved['profile.email']).toBe(false)
  })

  it('replaces profile.first_name with fallback', () => {
    const html = 'Hi {{ profile.first_name }}!'
    const {html: result, resolved} = stubKlaviyoTags(html)
    expect(result).toContain('John')
    expect(resolved['profile.first_name']).toBe(false)
  })

  it('replaces profile.last_name with fallback', () => {
    const html = 'Name: {{ profile.last_name }}'
    const {html: result, resolved} = stubKlaviyoTags(html)
    expect(result).toContain('Doe')
    expect(resolved['profile.last_name']).toBe(false)
  })

  it('handles extra whitespace in tags', () => {
    const html = 'Click: {{  unsubscribe_url  }}'
    const {html: result, resolved} = stubKlaviyoTags(html)
    expect(result).toContain('https://manage.klaviyo.com/unsubscribe')
    expect(resolved['unsubscribe_url']).toBe(false)
  })

  it('marks all four tags as true when none present', () => {
    const {resolved} = stubKlaviyoTags('Empty HTML')
    expect(resolved['unsubscribe_url']).toBe(true)
    expect(resolved['profile.email']).toBe(true)
    expect(resolved['profile.first_name']).toBe(true)
    expect(resolved['profile.last_name']).toBe(true)
  })

  it('marks tag as false when present, true when absent', () => {
    const html = '{{ unsubscribe_url }} and {{ profile.first_name }} present'
    const {resolved} = stubKlaviyoTags(html)
    expect(resolved['unsubscribe_url']).toBe(false)
    expect(resolved['profile.first_name']).toBe(false)
    expect(resolved['profile.email']).toBe(true)
    expect(resolved['profile.last_name']).toBe(true)
  })

  it('replaces all instances of a tag', () => {
    const html = '{{ unsubscribe_url }} and again {{ unsubscribe_url }}'
    const {html: result} = stubKlaviyoTags(html)
    const count = (result.match(/https:\/\/manage\.klaviyo\.com\/unsubscribe/g) || []).length
    expect(count).toBe(2)
  })

  it('matches profileXemail pattern (BUG: dot not escaped in regex)', () => {
    // BUG: the regex `{{ profile.email }}` treats . as wildcard, matching profileXemail
    const html = '{{ profileXemail }}'
    const {resolved} = stubKlaviyoTags(html)
    // This is the buggy behavior: unescaped dot matches 'X'
    expect(resolved['profile.email']).toBe(false)
  })

  it('empty HTML returns all resolved as true', () => {
    const {resolved} = stubKlaviyoTags('')
    expect(resolved['unsubscribe_url']).toBe(true)
    expect(resolved['profile.email']).toBe(true)
    expect(resolved['profile.first_name']).toBe(true)
    expect(resolved['profile.last_name']).toBe(true)
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
