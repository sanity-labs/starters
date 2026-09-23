import {handleChat} from '@/lib/chat-handler'

export async function POST(req: Request) {
  return handleChat(req, 'support')
}
