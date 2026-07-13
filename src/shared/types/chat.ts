/** 单条聊天消息 */
export interface ChatMessage {
  /** 消息角色：用户输入或助手回复 */
  role: 'user' | 'assistant'
  /** 消息正文 */
  content: string
}

/** 存储操作结果类型 */
export type StoreResult<T = ChatMessage[]> =
  | { success: true; data: T }
  | { success: false; error: string }

/** 后端聊天历史接口返回格式 */
export interface ChatHistoryApiResponse {
  msg?: string
  assistant?: string
  onlyAssistant?: boolean
  count?: number
  data?: ChatMessage[]
}
