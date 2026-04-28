import type {PreviewStatus, RenderContext} from '../types'

export const RESEND_STUBS = {
  RESEND_UNSUBSCRIBE_URL: '{{{RESEND_UNSUBSCRIBE_URL}}}',
}

export const FALLBACK_STUBS = {
  RESEND_UNSUBSCRIBE_URL: 'https://resend.com/unsubscribe',
}

export function stubResendTags(html: string): {html: string; resolved: Record<string, boolean>} {
  const resolved: Record<string, boolean> = {}
  let output = html

  for (const [key, fallback] of Object.entries(FALLBACK_STUBS)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\{\\{\\{\\s*${escapedKey}\\s*\\}\\}\\}`, 'g')
    if (pattern.test(html)) {
      output = output.replace(pattern, fallback)
      resolved[key] = false
    } else {
      resolved[key] = true
    }
  }

  return {html: output, resolved}
}

export interface PreviewContextData {
  [key: string]: {sample: string; description: string}
}

export function resolvePreviewContext(
  context: PreviewContextData,
  html: string,
): {html: string; resolved: Record<string, boolean>} {
  const resolved: Record<string, boolean> = {}
  let output = html

  for (const [token, {sample}] of Object.entries(context)) {
    const pattern = new RegExp(`{{\\s*${token}\\s*}}`, 'g')
    if (pattern.test(html)) {
      output = output.replace(pattern, sample)
      resolved[token] = true
    }
  }

  return {html: output, resolved}
}

export function buildPreviewStatus(
  _rendered: string,
  resolvedFlags: Record<string, boolean>,
): PreviewStatus {
  const entries = Object.entries(resolvedFlags)
  const resolvedCount = entries.filter(([, v]) => v).length
  const ratio = entries.length === 0 ? 1 : resolvedCount / entries.length

  const accuracy: PreviewStatus['accuracy'] =
    ratio >= 0.8 ? 'high' : ratio >= 0.5 ? 'medium' : 'low'

  const resolved: Record<string, 'sample' | 'dynamic'> = Object.fromEntries(
    entries.filter(([, v]) => v).map(([k]) => [k, 'sample' as const]),
  )
  const stubbed: Record<string, 'send-time-only'> = Object.fromEntries(
    entries.filter(([, v]) => !v).map(([k]) => [k, 'send-time-only' as const]),
  )

  return {resolved, stubbed, accuracy, timestamp: new Date().toISOString()}
}
