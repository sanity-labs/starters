/**
 * Core types for email rendering pipeline
 */

export interface RenderContext {
  promotionId: string
  segmentId?: string
  previewData?: Record<string, string | number>
}

export interface RenderAdapter {
  fetch: (url: string) => Promise<Response>
  cache?: Map<string, string>
  env: Record<string, string>
}

export interface PreviewStatus {
  resolved: Record<string, 'dynamic' | 'sample'>
  stubbed: Record<string, 'send-time-only'>
  accuracy: 'high' | 'medium' | 'low'
  timestamp: string
}

export interface EmailSlot {
  position: 'top-banner' | 'module-1' | 'module-2'
  headline: string
  subheadline?: string
  assetUrl?: string
  cta?: {
    text: string
    url: string
  }
}

export interface Promotion {
  _id: string
  campaign: {
    _ref: string
  }
  segment?: {
    _ref: string
  }
  subjectLine: string
  preheader: string
  disruptor?: string
  emailSlots: EmailSlot[]
}

export interface StreamOptions {
  streaming?: boolean
  timeout?: number
  sanitize?: boolean
}
