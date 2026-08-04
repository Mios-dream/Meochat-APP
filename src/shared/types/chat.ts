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

/** 展示消息类别：由后端 kind 投影派生，前端据此分组渲染 */
export type ChatMessageKind =
  | 'user'
  | 'chat'
  | 'interaction'
  | 'tool_call'
  | 'tool_result'

/**
 * 后端展示历史返回的私有消息结构（kind 驱动）
 *
 * 不再使用 OpenAI 的 role/content 扁平格式：类别语义由 kind 承载，
 * 前端按 kind 分组（user 开用户回合 / interaction 开自动回复回合）、
 * 聚合工具调用（tool_call + tool_result）、识别自动回复（interaction）。
 */
export interface ChatMessage {
  /** 消息类别：user 用户 / chat 对话回复 / interaction 自动回复 / tool_call 工具调用 / tool_result 工具结果 */
  kind: ChatMessageKind
  /** 文本内容（user/chat/interaction/tool_result）；tool_call 无此字段 */
  content?: string | ContentPart[] | null
  /** 工具调用列表（tool_call 专属） */
  tool_calls?: ToolCall[]
  /** 工具调用 ID（tool_result 专属，用于与 tool_call 聚合） */
  tool_call_id?: string
  /** 消息创建时间（ISO 字符串），由后端展示历史提供 */
  timestamp?: string
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
