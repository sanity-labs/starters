import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  type FieldMember,
  type ObjectInputProps,
  type ObjectMember,
  useClient,
  useFormValue,
  set,
} from 'sanity'
import {IntentLink} from 'sanity/router'
import {Button, Card, Flex, Stack, Switch, Text} from '@sanity/ui'
import {SparklesIcon, LaunchIcon} from '@sanity/icons'
import {
  type BrandVoiceSettings,
  assembleBrandVoiceSection,
  formatRelativeTime,
  hasBrandVoice as checkHasBrandVoice,
} from './generateEmailUtils'

interface AudienceItem {
  name?: string
  description?: string
  audienceNotes?: string
  behaviorNotes?: string
}

interface RefValue {
  _ref?: string
  _key?: string
  _type?: string
}

function assembleCampaignInstruction(
  brief: {
    goal?: string
    keyMessage?: string
    additionalContext?: string
  },
  audienceContext?: {lists: AudienceItem[]; segments: AudienceItem[]},
  brandVoice?: BrandVoiceSettings,
): string {
  const parts = [
    'You are an email marketing copywriter. Generate an email based on this brief:',
    '',
  ]

  if (brandVoice && checkHasBrandVoice(brandVoice)) {
    parts.push(...assembleBrandVoiceSection(brandVoice))
  }

  parts.push('## Campaign Brief')
  if (brief.goal) parts.push(`Goal: ${brief.goal}`)
  if (brief.keyMessage) parts.push(`Key Message: ${brief.keyMessage}`)
  if (brief.additionalContext) parts.push(`Additional Context: ${brief.additionalContext}`)
  parts.push('')

  if (audienceContext) {
    const hasLists = audienceContext.lists.length > 0
    const hasSegments = audienceContext.segments.length > 0

    if (hasLists || hasSegments) {
      parts.push('## Target Audience')
      parts.push(
        'This campaign targets the following subscriber lists and segments.',
        'Intelligently combine the audience context to understand who you are writing for.',
        '',
      )

      if (hasLists) {
        parts.push('Lists:')
        for (const list of audienceContext.lists) {
          const detail = [list.description, list.audienceNotes].filter(Boolean).join(' — Tone: ')
          parts.push(`- ${list.name}${detail ? `: ${detail}` : ''}`)
        }
        parts.push('')
      }

      if (hasSegments) {
        parts.push('Segments:')
        for (const seg of audienceContext.segments) {
          const detail = [seg.description, seg.behaviorNotes].filter(Boolean).join(' — Tone: ')
          parts.push(`- ${seg.name}${detail ? `: ${detail}` : ''}`)
        }
        parts.push('')
      }
    }
  }

  parts.push(
    'Generate a complete email with:',
    '- A compelling subject line (under 60 characters)',
    '- A preheader text (under 90 characters)',
    '- Email body with: header section, 1-2 content sections with headlines and body text, a call-to-action button, and a footer',
  )

  return parts.join('\n')
}

const HIDDEN_FIELDS = new Set(['useAudienceContext', 'generationCount', 'lastGeneratedAt'])
const BEFORE_TOGGLE = new Set(['goal', 'keyMessage'])

function patchFieldTitle(member: ObjectMember, title: string, description: string): ObjectMember {
  if (member.kind !== 'field') return member
  const field = member as FieldMember
  return {
    ...field,
    field: {
      ...field.field,
      schemaType: {
        ...field.field.schemaType,
        title,
        description,
      },
    },
  }
}

export function GenerateCampaignEmailButton(props: ObjectInputProps) {
  const client = useClient({apiVersion: 'vX'})
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useBrandVoice, setUseBrandVoice] = useState(true)
  const [brandVoiceSettings, setBrandVoiceSettings] = useState<BrandVoiceSettings | null>(null)
  const [brandVoiceLoaded, setBrandVoiceLoaded] = useState(false)

  const documentId = useFormValue(['_id']) as string | undefined
  const campaignTitle = useFormValue(['title']) as string | undefined
  const goal = useFormValue(['creativeBrief', 'goal']) as string | undefined
  const keyMessage = useFormValue(['creativeBrief', 'keyMessage']) as string | undefined
  const useAudienceContext = useFormValue(['creativeBrief', 'useAudienceContext']) as
    | boolean
    | undefined
  const additionalContext = useFormValue(['creativeBrief', 'additionalContext']) as
    | string
    | undefined
  const generationCount =
    (useFormValue(['creativeBrief', 'generationCount']) as number | undefined) ?? 0
  const lastGeneratedAt = useFormValue(['creativeBrief', 'lastGeneratedAt']) as string | undefined
  const emailRef = useFormValue(['email']) as RefValue | undefined
  const lists = useFormValue(['lists']) as RefValue[] | undefined
  const includedSegments = useFormValue(['includedSegments']) as RefValue[] | undefined

  const hasPrompt = Boolean(goal || keyMessage)
  const hasGenerated = generationCount > 0
  const hasEmail = Boolean(emailRef?._ref)

  // Fetch brand voice settings
  useEffect(() => {
    client
      .fetch<BrandVoiceSettings | null>(
        `*[_id == "emailSettings"][0]{brandVoice, brandToneKeywords, brandGuidelines}`,
      )
      .then((settings) => {
        setBrandVoiceSettings(settings)
        setBrandVoiceLoaded(true)
      })
  }, [client])

  const hasBrandVoice = checkHasBrandVoice(brandVoiceSettings)

  const handleGenerate = useCallback(async () => {
    if (!documentId) return

    setGenerating(true)
    setError(null)

    try {
      // Fetch audience context
      let audienceContext: {lists: AudienceItem[]; segments: AudienceItem[]} | undefined

      if (useAudienceContext !== false) {
        const listIds = (lists ?? []).map((r) => r._ref).filter(Boolean) as string[]
        const segmentIds = (includedSegments ?? []).map((r) => r._ref).filter(Boolean) as string[]

        const [fetchedLists, fetchedSegments] = await Promise.all([
          listIds.length > 0
            ? client.fetch<AudienceItem[]>(
                `*[_type == "list" && _id in $ids]{name, description, audienceNotes}`,
                {ids: listIds},
              )
            : Promise.resolve([]),
          segmentIds.length > 0
            ? client.fetch<AudienceItem[]>(
                `*[_type == "segment" && _id in $ids]{name, description, behaviorNotes}`,
                {ids: segmentIds},
              )
            : Promise.resolve([]),
        ])

        audienceContext = {lists: fetchedLists, segments: fetchedSegments}
      }

      const instruction = assembleCampaignInstruction(
        {goal, keyMessage, additionalContext},
        audienceContext,
        useBrandVoice && hasBrandVoice ? (brandVoiceSettings ?? undefined) : undefined,
      )

      const campaignId = documentId.replace(/^drafts\./, '')
      let emailId: string

      if (emailRef?._ref) {
        // Use existing linked email
        emailId = emailRef._ref
        // Clear existing content before regenerating
        await client
          .patch(`drafts.${emailId}`)
          .unset(['subject', 'preheader', 'body'])
          .commit({autoGenerateArrayKeys: true})
      } else {
        // Create a new email document
        const emailDoc = await client.create({
          _type: 'emailMessage',
          title: `${campaignTitle ?? 'Untitled Campaign'} — Email`,
          status: 'draft',
          sendState: 'idle',
        })
        emailId = emailDoc._id

        // Link email to campaign
        await client
          .patch(`drafts.${campaignId}`)
          .set({
            email: {_type: 'reference', _ref: emailId},
          })
          .commit()
      }

      // Generate email content
      await client.agent.action.generate({
        schemaId: process.env.SANITY_STUDIO_SCHEMA_ID ?? '_.schemas.default',
        targetDocument: {
          operation: 'edit',
          _id: `drafts.${emailId}`,
        },
        instruction,
        instructionParams: {},
        target: {
          include: ['subject', 'preheader', 'body'],
        },
        async: false,
      })

      // Update generation metadata
      await client
        .patch(`drafts.${campaignId}`)
        .set({
          'creativeBrief.generationCount': generationCount + 1,
          'creativeBrief.lastGeneratedAt': new Date().toISOString(),
        })
        .commit()
    } catch (err) {
      console.error('Campaign email generation failed:', err)
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [
    client,
    documentId,
    campaignTitle,
    goal,
    keyMessage,
    additionalContext,
    useAudienceContext,
    lists,
    includedSegments,
    generationCount,
    emailRef,
    useBrandVoice,
    hasBrandVoice,
    brandVoiceSettings,
  ])

  const brandVoiceActive = useBrandVoice && hasBrandVoice

  // Split members for layout
  const visibleMembers = props.members.filter(
    (m) => m.kind !== 'field' || !HIDDEN_FIELDS.has(m.name),
  )

  const beforeToggleMembers = visibleMembers.filter(
    (m) => m.kind === 'field' && BEFORE_TOGGLE.has(m.name),
  )

  const afterToggleMembers = useMemo(() => {
    const members = visibleMembers.filter((m) => m.kind !== 'field' || !BEFORE_TOGGLE.has(m.name))
    if (!brandVoiceActive) return members
    return members.map((m) => {
      if (m.kind !== 'field') return m
      if (m.name === 'additionalContext')
        return patchFieldTitle(
          m,
          'Additional Context',
          'Extra notes for this email — audience-specific tweaks, overrides, etc.',
        )
      return m
    })
  }, [visibleMembers, brandVoiceActive])

  return (
    <Card padding={4} radius={2} border tone="primary">
      <Stack space={4}>
        <Text size={1} muted>
          Describe your campaign goals and context below. AI will use this along with your audience
          data and brand voice to generate a complete email.
        </Text>

        {props.renderDefault({...props, members: beforeToggleMembers})}

        {/* Audience context toggle */}
        <Card
          padding={3}
          radius={2}
          border
          tone={useAudienceContext !== false ? 'primary' : 'default'}
        >
          <Flex align="center" gap={3}>
            <Switch
              checked={useAudienceContext !== false}
              onChange={() => {
                props.onChange(set(useAudienceContext === false, ['useAudienceContext']))
              }}
            />
            <Stack space={2}>
              <Text size={1} weight="medium">
                Use context from lists and segments
              </Text>
              <Text size={1} muted>
                Include audience descriptions and tone guidance in the AI prompt
              </Text>
            </Stack>
          </Flex>
        </Card>

        {/* Brand voice toggle */}
        {brandVoiceLoaded && (
          <Card padding={3} radius={2} border tone={brandVoiceActive ? 'primary' : 'default'}>
            <Flex align="center" gap={3}>
              <Switch
                checked={useBrandVoice}
                onChange={() => setUseBrandVoice((v) => !v)}
                disabled={!hasBrandVoice}
              />
              <Stack space={2}>
                <Text size={1} weight="medium" muted={!hasBrandVoice}>
                  Use global tone of voice
                </Text>
                {hasBrandVoice ? (
                  <Text size={1} muted>
                    <IntentLink
                      intent="edit"
                      params={{id: 'emailSettings', type: 'emailSettings'}}
                      style={{color: 'inherit'}}
                    >
                      See global tone of voice settings
                    </IntentLink>
                  </Text>
                ) : (
                  <Text size={1} muted>
                    Not configured —{' '}
                    <IntentLink
                      intent="edit"
                      params={{id: 'emailSettings', type: 'emailSettings'}}
                      style={{color: 'inherit'}}
                    >
                      set up in Email Settings
                    </IntentLink>
                  </Text>
                )}
              </Stack>
            </Flex>
          </Card>
        )}

        {props.renderDefault({...props, members: afterToggleMembers})}

        {error && (
          <Card padding={3} radius={2} tone="critical" border>
            <Text size={1}>{error}</Text>
          </Card>
        )}

        {/* Generate button */}
        <Stack space={3}>
          <Flex gap={2}>
            <Button
              icon={generating ? undefined : SparklesIcon}
              text={
                generating
                  ? 'Generating email… Please wait'
                  : hasEmail
                    ? 'Regenerate Email'
                    : 'Generate Email'
              }
              tone="primary"
              disabled={!hasPrompt || generating || !documentId}
              onClick={handleGenerate}
            />
            {hasEmail && emailRef?._ref && (
              <IntentLink
                intent="edit"
                params={{
                  id: emailRef._ref,
                  type: 'emailMessage',
                  mode: 'presentation',
                  presentation: 'presentation',
                  preview: `/emails/preview/${emailRef._ref}`,
                }}
                style={{textDecoration: 'none'}}
              >
                <Button icon={LaunchIcon} text="View Email" mode="ghost" as="span" />
              </IntentLink>
            )}
          </Flex>
          {!hasPrompt && (
            <Text size={1} muted>
              Fill in a Goal or Key Message to enable AI generation.
            </Text>
          )}
          {hasGenerated && lastGeneratedAt && (
            <Text size={0} muted>
              Generated {generationCount} {generationCount === 1 ? 'time' : 'times'} — last{' '}
              {formatRelativeTime(lastGeneratedAt)}
            </Text>
          )}
        </Stack>
      </Stack>
    </Card>
  )
}
