import { request } from '@shared/api/request'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function LLMRequest(messages: Message[]): Promise<string | null> {
  try {
    const response = await request.post('/api/llm_chat', { msg: messages })
    return response.data.content
  } catch (error) {
    console.error('LLMRequest error:', error)
    return null
  }
}

export { LLMRequest, type Message }
