import { useConfigStore } from '../stores/useConfigStore'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function LLMRequest(messages: Message[]): Promise<string | null> {
  try {
    const configStore = useConfigStore()
    const response = await fetch(`${configStore.config.baseUrl}/api/llm_chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ msg: messages })
    })
    const data = await response.json()
    return data.content
  } catch (error) {
    console.error('LLMRequest error:', error)
    return null
  }
}

export { LLMRequest, type Message }
