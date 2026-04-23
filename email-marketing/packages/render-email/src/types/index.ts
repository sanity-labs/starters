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

export interface EmailHeaderBlock {
  _type: 'emailHeader'
  _key: string
  brandName?: string
  logoImageUrl?: string
}

export interface EmailSectionBlock {
  _type: 'emailSection'
  _key: string
  headline?: string
  body?: string
  imageUrl?: string
  products?: Array<{
    _id: string
    title?: string
    price?: number
    url?: string
    imageUrl?: string
  }>
}

export interface EmailCTABlock {
  _type: 'emailCTA'
  _key: string
  text?: string
  url?: string
  style?: 'primary' | 'secondary'
}

export interface EmailDividerBlock {
  _type: 'emailDivider'
  _key: string
  spacing?: 'small' | 'medium' | 'large'
}

export interface EmailFooterBlock {
  _type: 'emailFooter'
  _key: string
  legalText?: string
  unsubscribeText?: string
}

export type EmailBlock =
  | EmailHeaderBlock
  | EmailSectionBlock
  | EmailCTABlock
  | EmailDividerBlock
  | EmailFooterBlock

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
  emailSlots: EmailBlock[]
}

export interface StreamOptions {
  streaming?: boolean
  timeout?: number
  sanitize?: boolean
}
