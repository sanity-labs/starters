import {createClient} from '@sanity/client'
import {type UIMessage} from 'ai'

interface ConversationMessage {
  role: string
  content: string
}

interface SaveConversationInput {
  chatId: string
  messages: UIMessage[]
}

// Saves the conversation immediately; classification (scoring, summarization)
// happens asynchronously via the "agent-conversation" Sanity Function (see sanity.blueprint.ts).
export async function saveConversation(input: SaveConversationInput): Promise<void> {
  const {chatId, messages} = input

  // Format messages for storage, filtering out empty ones
  const conversationMessages: ConversationMessage[] = messages
    .map((message) => ({
      role: message.role,
      content:
        message.parts
          ?.filter((part): part is {type: 'text'; text: string} => part.type === 'text')
          .map((part) => part.text)
          .join('\n\n') ?? '',
    }))
    .filter((message) => message.content.trim() !== '')

  const writeToken = process.env.SANITY_API_WRITE_TOKEN
  if (!writeToken) {
    console.warn('SANITY_API_WRITE_TOKEN not set, skipping conversation save')
    return
  }

  const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2026-01-01',
    useCdn: false,
    token: writeToken,
  })

  await client.createOrReplace(
    {
      _type: 'agent.conversation',
      _id: chatId,
      messages: conversationMessages,
    },
    {autoGenerateArrayKeys: true},
  )
}
