export interface BrandVoiceSettings {
  brandVoice?: string
  brandToneKeywords?: string[]
  brandGuidelines?: string
}

export function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export function hasBrandVoice(settings: BrandVoiceSettings | null): boolean {
  return Boolean(
    settings?.brandVoice || settings?.brandToneKeywords?.length || settings?.brandGuidelines,
  )
}

export function assembleBrandVoiceSection(settings: BrandVoiceSettings): string[] {
  const parts: string[] = []
  parts.push('## Brand Tone of Voice')
  if (settings.brandVoice) parts.push(`Voice: ${settings.brandVoice}`)
  if (settings.brandToneKeywords?.length)
    parts.push(`Tone: ${settings.brandToneKeywords.join(', ')}`)
  if (settings.brandGuidelines) parts.push(`Guidelines: ${settings.brandGuidelines}`)
  parts.push('')
  return parts
}
