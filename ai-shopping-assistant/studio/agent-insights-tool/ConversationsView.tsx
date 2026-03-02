import {EyeOpenIcon, LinkIcon} from '@sanity/icons'
import {
  Badge,
  Box,
  type BoxProps,
  Button,
  Card,
  Container,
  Dialog,
  Flex,
  Spinner,
  Stack,
  Text,
} from '@sanity/ui'
import {type ComponentProps, useEffect, useId, useMemo, useState} from 'react'
import ReactMarkdown from 'react-markdown'
import {useClient, useRelativeTime} from 'sanity'
import {useRouter} from 'sanity/router'

import {ViewLayout} from './ViewLayout'

type BadgeTone = ComponentProps<typeof Badge>['tone']

interface Conversation {
  _id: string
  _createdAt: string
  summary: string
  firstMessage?: string
  messages: {
    role: string
    content: string
    _key: string
  }[]
  classification?: {
    successRate?: number
    agentConfusion?: number
    userConfusion?: number
  }
  contentGap?: string
}

const QUERY = `*[_type == "agent.conversation"] | order(_createdAt desc) {
  _id,
  _createdAt,
  summary,
  "firstMessage": messages[0].content,
  classification,
  messages,
  contentGap
}`

const COLUMN_WIDTHS = {
  date: 140,
  success: 80,
  confusion: 110,
  action: 72,
} as const

const RESPONSIVE_DISPLAY: BoxProps['display'] = ['none', 'none', 'none', 'none', 'block']

function RelativeDate(props: {date: string}) {
  const relativeTime = useRelativeTime(props.date, {
    minimal: true,
  })
  // Only add "ago" for numeric durations, not for "yesterday", "today", etc.
  const needsAgo = /^\d/.test(relativeTime)
  return <>{needsAgo ? `${relativeTime} ago` : relativeTime}</>
}

function RateBadge(props: {value: number | undefined; inverted?: boolean}) {
  const {value, inverted} = props

  let tone: BadgeTone = 'default'

  if (!value) {
    tone = 'default'
  } else if (inverted) {
    // For metrics where low is good (e.g., confusion)
    if (value <= 20) {
      tone = 'positive'
    } else if (value <= 50) {
      tone = 'caution'
    } else {
      tone = 'critical'
    }
  } else {
    // For metrics where high is good (e.g., success)
    if (value >= 80) {
      tone = 'positive'
    } else if (value >= 50) {
      tone = 'caution'
    } else {
      tone = 'critical'
    }
  }

  return (
    <Flex align="center" justify="center">
      <Badge tone={tone} fontSize={1} padding={2} radius={2}>
        {value ?? 0}%
      </Badge>
    </Flex>
  )
}

export function ConversationsView() {
  const client = useClient({apiVersion: '2026-01-01'})
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [inspectedConversationId, setInspectedConversationId] = useState<string | null>(null)

  const dialogId = useId()

  const inspectedConversation = useMemo(() => {
    return conversations.find((conversation) => conversation._id === inspectedConversationId)
  }, [conversations, inspectedConversationId])

  useEffect(() => {
    const getConversations = async () => {
      try {
        const data = await client.fetch<Conversation[]>(QUERY)
        setConversations(data)
        setLoading(false)
      } catch (error) {
        setError(error instanceof Error ? error : new Error('Failed to fetch conversations'))
      }
    }

    getConversations()
  }, [client])

  if (error) {
    return (
      <Flex align="center" justify="center" padding={5} height="fill">
        <Container width={1}>
          <Card padding={5} tone="critical" border radius={3}>
            <Text size={1} muted>
              {error.message}
            </Text>
          </Card>
        </Container>
      </Flex>
    )
  }

  if (loading) {
    return (
      <Flex align="center" justify="center" padding={5} height="fill">
        <Spinner muted />
      </Flex>
    )
  }

  return (
    <ViewLayout title="Conversations" description="View all conversations with the agent" border>
      <Stack space={1} height="fill">
        {/* Header */}
        <Card padding={3} borderBottom>
          <Flex gap={4} align="center">
            <Box style={{width: COLUMN_WIDTHS.date}}>
              <Text textOverflow="ellipsis" size={1} weight="semibold" muted>
                Date
              </Text>
            </Box>

            <Box flex={2} display={RESPONSIVE_DISPLAY}>
              <Text textOverflow="ellipsis" size={1} weight="semibold" muted>
                Initial question
              </Text>
            </Box>

            <Box flex={2}>
              <Text textOverflow="ellipsis" size={1} weight="semibold" muted>
                Summary
              </Text>
            </Box>

            <Box flex={2}>
              <Text textOverflow="ellipsis" size={1} weight="semibold" muted>
                Content gap
              </Text>
            </Box>

            <Box style={{width: COLUMN_WIDTHS.success}} display={RESPONSIVE_DISPLAY}>
              <Text textOverflow="ellipsis" align="center" size={1} weight="semibold" muted>
                Success
              </Text>
            </Box>

            <Box style={{width: COLUMN_WIDTHS.confusion}} display={RESPONSIVE_DISPLAY}>
              <Text textOverflow="ellipsis" align="center" size={1} weight="semibold" muted>
                Agent confusion
              </Text>
            </Box>

            <Box style={{width: COLUMN_WIDTHS.confusion}} display={RESPONSIVE_DISPLAY}>
              <Text textOverflow="ellipsis" align="center" size={1} weight="semibold" muted>
                User confusion
              </Text>
            </Box>

            {/* Spacer for link button column */}
            <Box style={{width: COLUMN_WIDTHS.action}} />
          </Flex>
        </Card>

        {conversations.length === 0 && (
          <Flex align="center" justify="center" height="fill">
            <Card padding={5}>
              <Text size={1} muted align="center">
                No conversations yet
              </Text>
            </Card>
          </Flex>
        )}

        {/* Rows */}
        {conversations.map((conversation, index, arr) => {
          const isLast = index === arr.length - 1

          return (
            <Card key={conversation._id} padding={3} borderBottom={!isLast} tone="default">
              <Flex gap={4} align="center">
                <Box style={{width: COLUMN_WIDTHS.date}}>
                  <Text size={1} muted title={conversation._createdAt}>
                    <RelativeDate date={conversation._createdAt} />
                  </Text>
                </Box>

                <Box flex={2} display={RESPONSIVE_DISPLAY}>
                  <Text size={1} muted>
                    {conversation.firstMessage || '—'}
                  </Text>
                </Box>

                <Box flex={2}>
                  <Text size={1} muted>
                    {conversation.summary || 'No summary'}
                  </Text>
                </Box>

                <Box flex={2}>
                  <Text size={1} muted>
                    {conversation.contentGap || '-'}
                  </Text>
                </Box>

                <Box style={{width: COLUMN_WIDTHS.success}} display={RESPONSIVE_DISPLAY}>
                  <RateBadge value={conversation.classification?.successRate} />
                </Box>

                <Box style={{width: COLUMN_WIDTHS.confusion}} display={RESPONSIVE_DISPLAY}>
                  <RateBadge value={conversation.classification?.agentConfusion} inverted />
                </Box>

                <Box style={{width: COLUMN_WIDTHS.confusion}} display={RESPONSIVE_DISPLAY}>
                  <RateBadge value={conversation.classification?.userConfusion} inverted />
                </Box>

                <Flex align="center" gap={2} style={{width: COLUMN_WIDTHS.action}}>
                  <Button
                    icon={EyeOpenIcon}
                    mode="bleed"
                    padding={2}
                    fontSize={1}
                    onClick={() => setInspectedConversationId(conversation._id)}
                  />

                  <Button
                    as="a"
                    href={router.resolveIntentLink('edit', {
                      id: conversation._id,
                      type: 'agent.conversation',
                    })}
                    icon={LinkIcon}
                    mode="bleed"
                    padding={2}
                    fontSize={1}
                  />
                </Flex>
              </Flex>
            </Card>
          )
        })}
      </Stack>

      {inspectedConversation && (
        <Dialog
          animate
          header="Conversation"
          id={dialogId}
          onClickOutside={() => setInspectedConversationId(null)}
          onClose={() => setInspectedConversationId(null)}
          width={1}
        >
          <Flex direction="column" gap={4} padding={4}>
            {inspectedConversation.messages.map((message) => {
              const tone = message.role === 'user' ? 'transparent' : 'default'
              const justify = message.role === 'user' ? 'flex-start' : 'flex-end'
              const textAlign = message.role === 'user' ? 'left' : 'right'

              return (
                <Flex key={message._key} justify={justify}>
                  <Stack key={message._key} space={3} flex={0.75}>
                    <Text
                      align={textAlign}
                      muted
                      size={1}
                      style={{textTransform: 'capitalize'}}
                      weight="medium"
                    >
                      {message.role}
                    </Text>

                    <Card
                      padding={3}
                      tone={tone}
                      radius={3}
                      scheme={message.role === 'assistant' ? 'dark' : 'light'}
                      overflow="auto"
                    >
                      <ReactMarkdown
                        components={{
                          p: ({children}) => (
                            <Box padding={2}>
                              <Text size={1}>{children}</Text>
                            </Box>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </Card>
                  </Stack>
                </Flex>
              )
            })}
          </Flex>
        </Dialog>
      )}
    </ViewLayout>
  )
}
