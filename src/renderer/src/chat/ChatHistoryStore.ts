/** 单条聊天消息，和后端 /api/chat 接口的历史消息格式保持一致。 */
export interface ChatMessage {
  /** 消息角色：用户输入或助手回复。 */
  role: 'user' | 'assistant'
  /** 消息正文。 */
  content: string
}

/** 后端聊天历史接口返回格式。 */
export interface ChatHistoryApiResponse {
  /** 兼容后端可能返回的提示消息字段。 */
  msg?: string
  /** 历史所属助手名称，优先用于本地缓存归档。 */
  assistant?: string
  /** 是否只返回助手消息。 */
  onlyAssistant?: boolean
  /** 返回消息数量。 */
  count?: number
  /** 历史消息列表。 */
  data?: ChatMessage[]
}

const MAX_HISTORY_LENGTH = 20

/**
 * 聊天历史存储。
 *
 * 负责按助手名称维护本地聊天历史缓存，并封装历史裁剪、接口数据同步、失败回滚等操作。
 * ChatManager 只通过该类读写历史，避免请求逻辑里散落 Map 操作。
 */
export class ChatHistoryStore {
  /** key 为助手名称，value 为该助手最近的聊天上下文。 */
  private history: Map<string, ChatMessage[]> = new Map()

  /** 获取指定助手的聊天历史；没有缓存时返回空数组。 */
  public get(assistantName: string): ChatMessage[] {
    return this.history.get(assistantName) || []
  }

  /** 新增一条历史消息，并按最大历史长度裁剪。 */
  public push(assistantName: string, message: ChatMessage): void {
    const messages = this.history.get(assistantName) || []
    messages.push(message)
    this.history.set(assistantName, trimChatHistory(messages, MAX_HISTORY_LENGTH))
  }

  /** 删除指定助手最后一条消息，通常用于用户消息发送失败后的回滚。 */
  public popLast(assistantName: string): void {
    const messages = this.history.get(assistantName)
    if (messages && messages.length > 0) {
      messages.pop()
    }
  }

  /** 使用后端历史接口返回值同步本地缓存。 */
  public syncFromApi(result: ChatHistoryApiResponse, currentAssistantName: string): ChatMessage[] {
    const normalizedHistory = normalizeChatHistory(result.data)
    const assistantNameFromResponse =
      typeof result.assistant === 'string' ? result.assistant.trim() : ''
    const assistantName = assistantNameFromResponse || currentAssistantName

    if (assistantName) {
      this.history.set(assistantName, trimChatHistory(normalizedHistory, MAX_HISTORY_LENGTH))
    }

    return normalizedHistory
  }

  /** 清空全部助手的本地历史缓存。 */
  public clear(): void {
    this.history = new Map()
  }
}

/** 裁剪聊天历史，保持本地缓存和请求上下文在固定长度内。 */
function trimChatHistory(messages: ChatMessage[], maxLength: number): ChatMessage[] {
  if (messages.length > maxLength) {
    return messages.slice(-maxLength)
  }

  return messages
}

/** 标准化后端聊天历史返回值，保证角色字段稳定。 */
function normalizeChatHistory(rawMessages?: ChatHistoryApiResponse['data']): ChatMessage[] {
  if (!Array.isArray(rawMessages)) {
    return []
  }

  return rawMessages.map((item) => ({
    role: item.role === 'assistant' ? 'assistant' : 'user',
    content: item.content
  }))
}
