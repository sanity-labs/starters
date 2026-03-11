import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  type FieldMember,
  type ObjectInputProps,
  type ObjectMember,
  useClient,
  useFormValue,
} from 'sanity'
import {IntentLink} from 'sanity/router'
import {Button, Card, Flex, Stack, Switch, Text} from '@sanity/ui'
import {SparklesIcon} from '@sanity/icons'

interface BrandVoiceSettings {
  brandVoice?: string
  brandToneKeywords?: string[]
  brandGuidelines?: string
}

function assembleInstruction(
  prompt: {
    goal?: string
    keyMessage?: string
    tone?: string[]
    additionalContext?: string
  },
  audienceContext?: {name?: string; behaviorNotes?: string},
  brandVoice?: BrandVoiceSettings,
): string {
  const parts = [
    'You are an email marketing copywriter. Generate an email based on this brief:',
    '',
  ]

  if (
    brandVoice?.brandVoice ||
    brandVoice?.brandToneKeywords?.length ||
    brandVoice?.brandGuidelines
  ) {
    parts.push('## Brand Tone of Voice')
    if (brandVoice.brandVoice) parts.push(`Voice: ${brandVoice.brandVoice}`)
    if (brandVoice.brandToneKeywords?.length)
      parts.push(`Tone: ${brandVoice.brandToneKeywords.join(', ')}`)
    if (brandVoice.brandGuidelines) parts.push(`Guidelines: ${brandVoice.brandGuidelines}`)
    parts.push('')
  }

  if (prompt.goal) parts.push(`Goal: ${prompt.goal}`)
  if (prompt.keyMessage) parts.push(`Key Message: ${prompt.keyMessage}`)
  if (prompt.tone?.length) parts.push(`Additional Tone: ${prompt.tone.join(', ')}`)
  if (prompt.additionalContext) parts.push(`Additional Context: ${prompt.additionalContext}`)

  if (audienceContext?.name) {
    const audience = [audienceContext.name, audienceContext.behaviorNotes]
      .filter(Boolean)
      .join(' - ')
    parts.push(`\nTarget Audience: ${audience}`)
  }

  parts.push(
    '',
    'Generate a complete email with:',
    '- A compelling subject line (under 60 characters)',
    '- A preheader text (under 90 characters)',
    '- Email body with: header section, 1-2 content sections with headlines and body text, a call-to-action button, and a footer',
  )

  return parts.join('\n')
}

function formatRelativeTime(dateString: string): string {
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

const HIDDEN_FIELDS = new Set(['generationCount', 'lastGeneratedAt'])
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

export function GenerateEmailButton(props: ObjectInputProps) {
  const client = useClient({apiVersion: 'vX'})
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useBrandVoice, setUseBrandVoice] = useState(true)
  const [brandVoiceSettings, setBrandVoiceSettings] = useState<BrandVoiceSettings | null>(null)
  const [brandVoiceLoaded, setBrandVoiceLoaded] = useState(false)

  const documentId = useFormValue(['_id']) as string | undefined
  const goal = useFormValue(['prompt', 'goal']) as string | undefined
  const keyMessage = useFormValue(['prompt', 'keyMessage']) as string | undefined
  const tone = useFormValue(['prompt', 'tone']) as string[] | undefined
  const additionalContext = useFormValue(['prompt', 'additionalContext']) as string | undefined
  const generationCount = (useFormValue(['prompt', 'generationCount']) as number | undefined) ?? 0
  const lastGeneratedAt = useFormValue(['prompt', 'lastGeneratedAt']) as string | undefined

  const hasPrompt = Boolean(goal || keyMessage)
  const hasGenerated = generationCount > 0

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

  const hasBrandVoice = Boolean(
    brandVoiceSettings?.brandVoice ||
    brandVoiceSettings?.brandToneKeywords?.length ||
    brandVoiceSettings?.brandGuidelines,
  )

  const handleGenerate = useCallback(async () => {
    if (!documentId) return

    setGenerating(true)
    setError(null)

    try {
      let audienceContext: {name?: string; behaviorNotes?: string} | undefined
      if (documentId) {
        const docId = documentId.replace(/^drafts\./, '')
        audienceContext = await client.fetch(
          `*[_type == "campaign" && email._ref == $id][0].includedSegments[0]->{name, behaviorNotes}`,
          {id: docId},
        )
      }

      const instruction = assembleInstruction(
        {goal, keyMessage, tone, additionalContext},
        audienceContext ?? undefined,
        useBrandVoice && hasBrandVoice ? (brandVoiceSettings ?? undefined) : undefined,
      )

      const patchId = documentId.replace(/^drafts\./, '')
      await client.patch(`drafts.${patchId}`).unset(['subject', 'preheader', 'body']).commit()

      await client.agent.action.generate({
        schemaId: process.env.SANITY_STUDIO_SCHEMA_ID ?? '_.schemas.default',
        targetDocument: {
          operation: 'edit',
          _id: documentId,
        },
        instruction,
        instructionParams: {},
        target: {
          include: ['subject', 'preheader', 'body'],
        },
        async: false,
      })

      await client
        .patch(`drafts.${patchId}`)
        .set({
          'prompt.generationCount': generationCount + 1,
          'prompt.lastGeneratedAt': new Date().toISOString(),
        })
        .commit()
    } catch (err) {
      console.error('Email generation failed:', err)
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [
    client,
    documentId,
    goal,
    keyMessage,
    tone,
    additionalContext,
    generationCount,
    useBrandVoice,
    hasBrandVoice,
    brandVoiceSettings,
  ])

  const buttonText = generating
    ? 'Generating email... Please wait'
    : hasGenerated
      ? 'Regenerate Email'
      : 'Generate Email from Prompt'

  const brandVoiceActive = useBrandVoice && hasBrandVoice

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
      if (m.name === 'tone')
        return patchFieldTitle(
          m,
          'Additional Tone',
          'Extra tone descriptors for this email, on top of the global brand voice',
        )
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
    <Stack space={4}>
      {props.renderDefault({...props, members: beforeToggleMembers})}

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

      <Stack space={3}>
        <Flex>
          <Button
            icon={generating ? undefined : SparklesIcon}
            text={buttonText}
            tone="primary"
            disabled={!hasPrompt || generating || !documentId}
            onClick={handleGenerate}
          />
        </Flex>
        {!hasPrompt && (
          <Text size={1} muted>
            Fill in a Goal or Key Message to enable AI generation.
          </Text>
        )}
        {hasPrompt && (
          <Text size={1} muted weight="medium">
            Generates: Subject, Preheader, and Body
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
  )
}
