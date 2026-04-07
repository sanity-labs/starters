import {useCallback, useEffect, useState} from 'react'
import {type ObjectFieldProps, type ObjectInputProps, useClient, useFormValue, set} from 'sanity'
import {IntentLink} from 'sanity/router'
import {Button, Card, Flex, Stack, Switch, Text} from '@sanity/ui'
import {SparklesIcon} from '@sanity/icons'
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

function assembleInstruction(
  brief: string | undefined,
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

  if (brief) parts.push(brief)
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
const BEFORE_TOGGLE = new Set(['brief'])

export function GenerateEmailField(props: ObjectFieldProps) {
  return (
    <Card padding={4} radius={2} border tone="primary">
      {props.renderDefault(props)}
    </Card>
  )
}

export function GenerateEmailButton(props: ObjectInputProps) {
  const client = useClient({apiVersion: 'vX'})
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useBrandVoice, setUseBrandVoice] = useState(true)
  const [brandVoiceSettings, setBrandVoiceSettings] = useState<BrandVoiceSettings | null>(null)
  const [brandVoiceLoaded, setBrandVoiceLoaded] = useState(false)

  const documentId = useFormValue(['_id']) as string | undefined
  const brief = useFormValue(['prompt', 'brief']) as string | undefined
  const useAudienceContext = useFormValue(['prompt', 'useAudienceContext']) as boolean | undefined
  const generationCount = (useFormValue(['prompt', 'generationCount']) as number | undefined) ?? 0
  const lastGeneratedAt = useFormValue(['prompt', 'lastGeneratedAt']) as string | undefined

  const hasPrompt = Boolean(brief)
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

  const hasBrandVoice = checkHasBrandVoice(brandVoiceSettings)

  const handleGenerate = useCallback(async () => {
    if (!documentId) return

    setGenerating(true)
    setError(null)

    try {
      let audienceContext: {lists: AudienceItem[]; segments: AudienceItem[]} | undefined

      if (useAudienceContext !== false) {
        const docId = documentId.replace(/^drafts\./, '')
        const campaign = await client.fetch<{
          lists: AudienceItem[] | null
          segments: AudienceItem[] | null
        } | null>(
          `*[_type == "campaign" && email._ref == $id][0]{
            "lists": lists[]->{name, description, audienceNotes},
            "segments": includedSegments[]->{name, description, behaviorNotes}
          }`,
          {id: docId},
        )

        if (campaign) {
          audienceContext = {
            lists: campaign.lists ?? [],
            segments: campaign.segments ?? [],
          }
        }
      }

      const instruction = assembleInstruction(
        brief,
        audienceContext,
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
    brief,
    useAudienceContext,
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

  const visibleMembers = props.members.filter(
    (m) => m.kind !== 'field' || !HIDDEN_FIELDS.has(m.name),
  )

  const beforeToggleMembers = visibleMembers.filter(
    (m) => m.kind === 'field' && BEFORE_TOGGLE.has(m.name),
  )

  const afterToggleMembers = visibleMembers.filter(
    (m) => m.kind !== 'field' || !BEFORE_TOGGLE.has(m.name),
  )

  return (
    <Stack space={4}>
      <Text size={1} muted>
        Describe your email goals and context below. AI will use this along with your audience data
        and brand voice to generate a complete email.
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
              Include audience descriptions and tone guidance from the linked campaign
            </Text>
          </Stack>
        </Flex>
      </Card>

      {brandVoiceLoaded && (
        <Card
          padding={3}
          radius={2}
          border
          tone={useBrandVoice && hasBrandVoice ? 'primary' : 'default'}
        >
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
            Write a brief to enable AI generation.
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
