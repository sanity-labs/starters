import {useEffect, useState} from 'react'
import {useClient} from 'sanity'
import {defineQuery} from 'groq'

const CAMPAIGN_CONTEXT_QUERY = defineQuery(`
  *[_type == "campaign" && (_id == $id || _id == $draftId)][0]{
    title,
    primaryMessage,
    supportingMessage,
    valueProposition,
    emotionalGoal,
    toneTraits,
    previewContext,
    "urgencyTitle": urgencyStage->.title,
    "urgencyCopyTone": urgencyStage->.copyTone
  }
`)

const BRAND_VOICE_QUERY = defineQuery(`
  *[_type == "brandVoice"][0]{
    toneTraits,
    writingStyleRules,
    prohibitedWords,
    emailGuidelines,
    legalConstraints
  }
`)

const SEGMENT_CONTEXT_QUERY = defineQuery(`
  *[_type == "segment" && _id == $id][0]{
    name,
    affinityDescription,
    typicalCopyTone,
    engagementTier
  }
`)

export interface CampaignBrief {
  title?: string
  primaryMessage?: string
  supportingMessage?: string
  valueProposition?: string
  emotionalGoal?: string
  toneTraits?: string[]
  urgencyTitle?: string
  urgencyCopyTone?: string
  previewContext?: {
    tokens?: Array<{key?: string; sample?: string; description?: string}>
  }
}

export interface BrandVoiceContext {
  toneTraits?: string[]
  writingStyleRules?: string[]
  prohibitedWords?: string[]
  emailGuidelines?: string
  legalConstraints?: string
}

export interface SegmentContext {
  name?: string
  affinityDescription?: string
  typicalCopyTone?: string[]
  engagementTier?: string
}

export function buildInstruction(
  campaign: CampaignBrief | null,
  brandVoice: BrandVoiceContext | null,
  segment: SegmentContext | null,
): string {
  const lines: string[] = []

  lines.push(`You are writing a promotional email.`)

  if (campaign?.primaryMessage) {
    lines.push(`\n## Campaign Brief\n${campaign.primaryMessage}`)
  }
  if (campaign?.supportingMessage) {
    lines.push(campaign.supportingMessage)
  }
  if (campaign?.valueProposition) {
    lines.push(`**Offer:** ${campaign.valueProposition}`)
  }
  if (campaign?.emotionalGoal) {
    lines.push(`**Emotional goal:** ${campaign.emotionalGoal}`)
  }
  if (campaign?.toneTraits?.length) {
    lines.push(`**Tone:** ${campaign.toneTraits.join(', ')}`)
  }
  if (campaign?.urgencyTitle) {
    const tone = campaign.urgencyCopyTone ? ` — ${campaign.urgencyCopyTone}` : ''
    lines.push(`**Urgency stage:** ${campaign.urgencyTitle}${tone}`)
  }

  if (brandVoice) {
    lines.push(`\n## Brand Voice`)
    if (brandVoice.toneTraits?.length) {
      lines.push(`Traits: ${brandVoice.toneTraits.join(', ')}`)
    }
    if (brandVoice.writingStyleRules?.length) {
      lines.push(`Style rules:\n${brandVoice.writingStyleRules.map((r) => `- ${r}`).join('\n')}`)
    }
    if (brandVoice.prohibitedWords?.length) {
      lines.push(`Avoid these words: ${brandVoice.prohibitedWords.join(', ')}`)
    }
    if (brandVoice.emailGuidelines) {
      lines.push(brandVoice.emailGuidelines)
    }
    if (brandVoice.legalConstraints) {
      lines.push(`Legal requirements: ${brandVoice.legalConstraints}`)
    }
  }

  if (segment) {
    lines.push(`\n## Target Audience: ${segment.name ?? 'Unknown segment'}`)
    if (segment.affinityDescription) lines.push(segment.affinityDescription)
    if (segment.typicalCopyTone?.length) {
      lines.push(`Copy tone: ${segment.typicalCopyTone.join(', ')}`)
    }
    if (segment.engagementTier) {
      lines.push(`Engagement tier: ${segment.engagementTier}`)
    }
  }

  if (campaign?.previewContext?.tokens?.length) {
    lines.push(`\n## Available Personalization Tokens`)
    for (const token of campaign.previewContext.tokens) {
      if (token.key) {
        lines.push(
          `- {{${token.key}}}${token.description ? ` — ${token.description}` : ''} (sample: "${token.sample ?? ''}")`,
        )
      }
    }
    lines.push(`Use these tokens naturally in the copy where appropriate.`)
  }

  return lines.join('\n')
}

export function fetchCampaignContext(
  client: ReturnType<typeof useClient>,
  campaignId: string,
): Promise<CampaignBrief | null> {
  return client.fetch<CampaignBrief | null>(CAMPAIGN_CONTEXT_QUERY, {
    id: campaignId,
    draftId: `drafts.${campaignId}`,
  })
}

export function fetchBrandVoice(
  client: ReturnType<typeof useClient>,
): Promise<BrandVoiceContext | null> {
  return client.fetch<BrandVoiceContext | null>(BRAND_VOICE_QUERY)
}

export function fetchSegmentContext(
  client: ReturnType<typeof useClient>,
  segmentId: string,
): Promise<SegmentContext | null> {
  return client.fetch<SegmentContext | null>(SEGMENT_CONTEXT_QUERY, {id: segmentId})
}

export function useAgentContext(campaignId: string, segmentId?: string): string | null {
  const client = useClient({apiVersion: '2026-04-08'})
  const [instruction, setInstruction] = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false

    Promise.all([
      fetchCampaignContext(client, campaignId),
      fetchBrandVoice(client),
      segmentId ? fetchSegmentContext(client, segmentId) : Promise.resolve(null),
    ]).then(([campaign, brandVoice, segment]) => {
      if (!cancelled) {
        setInstruction(buildInstruction(campaign, brandVoice, segment))
      }
    })

    return () => {
      cancelled = true
    }
  }, [client, campaignId, segmentId])

  return instruction
}
