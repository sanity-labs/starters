import {useEffect, useState} from 'react'
import {useClient} from 'sanity'
import {defineQuery} from 'groq'

// Prefer the draft so unpublished edits to the brief are honored;
// fall back to the published version when no draft exists.
const CAMPAIGN_CONTEXT_QUERY = defineQuery(`
  coalesce(
    *[_id == $draftId][0],
    *[_id == $id][0]
  ){
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

export interface BuiltInstruction {
  instruction: string
  instructionParams: Record<string, {type: 'constant'; value: string}>
}

export function buildInstruction(
  campaign: CampaignBrief | null,
  brandVoice: BrandVoiceContext | null,
  segment: SegmentContext | null,
): BuiltInstruction {
  const lines: string[] = []
  const instructionParams: Record<string, {type: 'constant'; value: string}> = {}
  let paramCounter = 0

  // Pass user-supplied text through instructionParams so a literal "$" in the
  // copy (e.g. "Save $50") isn't parsed as a template variable by the agent.
  const param = (value: string): string => {
    const key = `v${paramCounter++}`
    instructionParams[key] = {type: 'constant', value}
    return `$${key}`
  }

  lines.push(`You are writing a promotional email.`)

  lines.push(`\n## Email Structure`)
  lines.push(`Compose the emailSlots field using these block types in a logical order:`)
  lines.push(`- **emailHeader**: brandName (string)`)
  lines.push(
    `- **emailSection**: headline (string), body (text) — the main content blocks. Use 1–3 sections.`,
  )
  lines.push(`- **emailCTA**: text (string), url (url), style ("primary" or "secondary")`)
  lines.push(`- **emailDivider**: spacing ("small", "medium", or "large")`)
  lines.push(`- **emailFooter**: legalText (text), unsubscribeText (string)`)
  lines.push(`A typical email: header → 1–3 sections with dividers between them → CTA → footer.`)

  if (campaign?.primaryMessage) {
    lines.push(`\n## Campaign Brief\n${param(campaign.primaryMessage)}`)
  }
  if (campaign?.supportingMessage) {
    lines.push(param(campaign.supportingMessage))
  }
  if (campaign?.valueProposition) {
    lines.push(`**Offer:** ${param(campaign.valueProposition)}`)
  }
  if (campaign?.emotionalGoal) {
    lines.push(`**Emotional goal:** ${param(campaign.emotionalGoal)}`)
  }
  if (campaign?.toneTraits?.length) {
    lines.push(`**Tone:** ${param(campaign.toneTraits.join(', '))}`)
  }
  if (campaign?.urgencyTitle) {
    const tone = campaign.urgencyCopyTone ? ` — ${param(campaign.urgencyCopyTone)}` : ''
    lines.push(`**Urgency stage:** ${param(campaign.urgencyTitle)}${tone}`)
  }

  if (brandVoice) {
    lines.push(`\n## Brand Voice`)
    if (brandVoice.toneTraits?.length) {
      lines.push(`Traits: ${param(brandVoice.toneTraits.join(', '))}`)
    }
    if (brandVoice.writingStyleRules?.length) {
      lines.push(
        `Style rules:\n${brandVoice.writingStyleRules.map((r) => `- ${param(r)}`).join('\n')}`,
      )
    }
    if (brandVoice.prohibitedWords?.length) {
      lines.push(`Avoid these words: ${param(brandVoice.prohibitedWords.join(', '))}`)
    }
    if (brandVoice.emailGuidelines) {
      lines.push(param(brandVoice.emailGuidelines))
    }
    if (brandVoice.legalConstraints) {
      lines.push(`Legal requirements: ${param(brandVoice.legalConstraints)}`)
    }
  }

  if (segment) {
    lines.push(`\n## Target Audience: ${param(segment.name ?? 'Unknown segment')}`)
    if (segment.affinityDescription) lines.push(param(segment.affinityDescription))
    if (segment.typicalCopyTone?.length) {
      lines.push(`Copy tone: ${param(segment.typicalCopyTone.join(', '))}`)
    }
    if (segment.engagementTier) {
      lines.push(`Engagement tier: ${param(segment.engagementTier)}`)
    }
  }

  if (campaign?.previewContext?.tokens?.length) {
    lines.push(`\n## Available Personalization Tokens`)
    for (const token of campaign.previewContext.tokens) {
      if (token.key) {
        const description = token.description ? ` — ${param(token.description)}` : ''
        lines.push(`- {{${token.key}}}${description} (sample: "${param(token.sample ?? '')}")`)
      }
    }
    lines.push(`Use these tokens naturally in the copy where appropriate.`)
  }

  return {instruction: lines.join('\n'), instructionParams}
}

export function fetchCampaignContext(
  client: ReturnType<typeof useClient>,
  campaignId: string,
): Promise<CampaignBrief | null> {
  // perspective: 'raw' so the draft is visible to the coalesce in the query.
  return client.fetch<CampaignBrief | null>(
    CAMPAIGN_CONTEXT_QUERY,
    {
      id: campaignId,
      draftId: `drafts.${campaignId}`,
    },
    {perspective: 'raw', tag: 'campaign.ctx.campaign'},
  )
}

export function fetchBrandVoice(
  client: ReturnType<typeof useClient>,
): Promise<BrandVoiceContext | null> {
  return client.fetch<BrandVoiceContext | null>(
    BRAND_VOICE_QUERY,
    {},
    {tag: 'campaign.ctx.brand-voice'},
  )
}

export function fetchSegmentContext(
  client: ReturnType<typeof useClient>,
  segmentId: string,
): Promise<SegmentContext | null> {
  return client.fetch<SegmentContext | null>(
    SEGMENT_CONTEXT_QUERY,
    {id: segmentId},
    {tag: 'campaign.ctx.segment'},
  )
}

export function useSanityContext(campaignId: string, segmentId?: string): string | null {
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
        setInstruction(buildInstruction(campaign, brandVoice, segment).instruction)
      }
    })

    return () => {
      cancelled = true
    }
  }, [client, campaignId, segmentId])

  return instruction
}
