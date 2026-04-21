import {useMemo, useState} from 'react'
import {Box, Button, Card, Flex, Label, Spinner, Stack, Text, TextArea} from '@sanity/ui'
import {
  useClient,
  useWorkspace,
  usePerspective,
  isReleaseDocument,
  type ReleaseDocument,
  DEFAULT_STUDIO_CLIENT_OPTIONS,
} from 'sanity'
import {useChat} from '@ai-sdk/react'
import {DirectChatTransport, ToolLoopAgent} from 'ai'
import {createStudioAgent} from 'content-agent'

function extractText(parts: unknown): string {
  if (!Array.isArray(parts)) return ''
  return parts
    .filter(
      (p): p is {type: 'text'; text: string} =>
        typeof p === 'object' && p !== null && 'type' in p && p.type === 'text' && 'text' in p,
    )
    .map((p) => p.text)
    .join('')
}

function buildPerspectives(selectedPerspective: ReleaseDocument | string | null | undefined) {
  if (isReleaseDocument(selectedPerspective)) {
    const releaseId = selectedPerspective._id
    return {read: [releaseId, 'published'], write: releaseId}
  }
  return {read: ['drafts', 'published'], write: 'drafts'}
}

export function VariantRefinementPanel({promotionId}: {promotionId: string}) {
  const client = useClient(DEFAULT_STUDIO_CLIENT_OPTIONS)
  const {name: workspace} = useWorkspace()
  const {selectedPerspective} = usePerspective()
  const [input, setInput] = useState('')

  const threadId = `promotion-refinement-${promotionId}`

  const perspectives = useMemo(() => buildPerspectives(selectedPerspective), [selectedPerspective])

  const transport = useMemo(() => {
    const contentAgent = createStudioAgent(client, workspace)
    return new DirectChatTransport({
      agent: new ToolLoopAgent({
        model: contentAgent.agent(threadId, {
          config: {
            capabilities: {read: true, write: true},
            perspectives,
          },
        }),
      }),
    })
  }, [client, workspace, threadId, perspectives])

  const {messages, sendMessage, status} = useChat({transport})

  const isStreaming = status === 'streaming' || status === 'submitted'

  const handleSend = async () => {
    const prompt = input.trim()
    if (!prompt || isStreaming) return
    setInput('')
    await sendMessage({parts: [{type: 'text', text: prompt}]})
  }

  const perspectiveLabel = isReleaseDocument(selectedPerspective)
    ? `Writing to release: ${selectedPerspective.metadata?.title ?? selectedPerspective._id}`
    : 'Writing to draft'

  return (
    <Box padding={4}>
      <Stack space={4}>
        <Text size={1} muted>
          {perspectiveLabel}
        </Text>

        {messages.length === 0 && (
          <Card padding={3} radius={2} tone="transparent" border>
            <Text size={1} muted>
              Describe what to change. The agent reads and edits directly into the current
              perspective. Thread history is preserved across sessions.
            </Text>
          </Card>
        )}

        <Stack space={3}>
          {messages.map((msg) => (
            <Card
              key={msg.id}
              padding={3}
              radius={2}
              tone={msg.role === 'user' ? 'transparent' : 'primary'}
              border
            >
              <Stack space={2}>
                <Label size={0} muted>
                  {msg.role === 'user' ? 'You' : 'Agent'}
                </Label>
                <Text size={1} style={{whiteSpace: 'pre-wrap'}}>
                  {extractText(msg.parts)}
                </Text>
              </Stack>
            </Card>
          ))}
          {isStreaming && (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1} muted>
                Thinking...
              </Text>
            </Flex>
          )}
        </Stack>

        <Stack space={2}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
            }}
            placeholder="e.g. Make the subject line more urgent for the VIP segment"
            rows={3}
            disabled={isStreaming}
          />
          <Button
            text={isStreaming ? 'Thinking...' : 'Send  ⌘↵'}
            tone="primary"
            disabled={isStreaming || !input.trim()}
            onClick={handleSend}
          />
        </Stack>
      </Stack>
    </Box>
  )
}
