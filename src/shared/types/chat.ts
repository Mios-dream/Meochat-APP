/** 文本内容片段 */
export interface ContentPartText {
  type: 'text'
  text: string
}

/** OpenAI 多模态图片片段 */
export interface ContentPartImageUrl {
  type: 'image_url'
  image_url: {
    url: string
    detail?: 'low' | 'high' | 'auto'
  }
}

/** 图片 OCR 识别结果片段（格式：[图片: 文件名] 内容） */
export interface ContentPartImageOcr {
  type: 'image_ocr'
  fileName: string
  text: string
}

/** 文档内容片段（格式：[文件: 文件名]\n内容） */
export interface ContentPartDoc {
  type: 'doc'
  fileName: string
  text: string
}

/** 不支持的文件类型片段（格式：[附件: 文件名] 不支持的文件类型） */
export interface ContentPartUnsupported {
  type: 'attachment'
  fileName: string
  text: string
}

/** 前端友好的内容片段联合类型 */
export type ContentPart =
  | ContentPartText
  | ContentPartImageUrl
  | ContentPartImageOcr
  | ContentPartDoc
  | ContentPartUnsupported

/** OpenAI 工具调用 */
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

/** 兼容 OpenAI ChatCompletionMessageParam 的聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string | ContentPart[] | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

/** 存储操作结果类型 */
export type StoreResult<T = ChatMessage[]> =
  | { success: true; data: T }
  | { success: false; error: string }

/** 后端聊天历史接口返回格式 */
export interface ChatHistoryApiResponse {
  msg?: string
  assistant?: string
  count?: number
  data?: ChatMessage[]
}
