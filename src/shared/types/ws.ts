// ═══════════════════════════════════════════════════════════════════════════
// WebSocket 聊天与工具调用协议 · 类型定义（主进程 / 渲染进程共享）
//
// 定义了 MoeChat 前端与服务端之间基于 WebSocket 双向通信的完整消息格式。
// 包括：聊天流式消息（text / audio / motion / done / error）、
// LLM 工具调用事件（仅 UI 展示）、客户端工具协议（注册 / 调用 / 结果 / 进度）。
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────
// 服务端 → 客户端 消息类型
// ─────────────────────────────────────────────────────────────────────────

/** 流式文本 token 消息，后端逐词推送到前端台词板。 */
export interface ChatTextMessage {
  type: 'chat:text'
  /** 句子序号，用于和同句的音频、动作帧配对。 */
  sentence_id: number
  /** 当前 token 的文本片段，前端累积后作为台词板展示内容。 */
  message: string
}

/** TTS 语音消息，后端完成单句合成后推送 base64 音频。 */
export interface ChatAudioMessage {
  type: 'chat:audio'
  /** 句子序号，用于和同句的文本配对。 */
  sentence_id: number
  /** 音频消息文本（朗读文本）。 */
  message: string
  /** 原始句子文本（含括号动作描述，台词板展示优先使用）。 */
  source_text: string
  /** base64 编码的音频内容。 */
  file: string
}

/** Live2D 动作帧消息，后端计算完动作参数后推送。 */
export interface ChatMotionMessage {
  type: 'chat:motion'
  /** 句子序号，用于和同句的文本/音频配对。 */
  sentence_id: number
  /**
   * 动作曲线数组，每一项代表一段参数过渡（新曲线方案）。
   * 旧关键帧方案兼容字段保留在 motions 内部判断。
   */
  motions: ChatMotionItem[]
  /** 动作总时长，单位毫秒。 */
  duration: number
}

/** 单段动作曲线 / 关键帧数据。 */
export interface ChatMotionItem {
  /** 当前动作段持续时间，单位毫秒。 */
  duration: number
  /** 动作名称（旧方案兼容字段）。 */
  action?: string
  /**
   * Live2D 参数 ID 到参数目标值的映射（旧关键帧方案）。
   * 新曲线方案中该字段为空，改用 curves。
   */
  parameters?: Record<string, number>
  /**
   * Live2D 参数 ID 到完整参数值时间序列的映射（新曲线方案）。
   * 每个参数对应一个等间隔采样的数值数组，配合 fps 使用。
   */
  curves?: Record<string, number[]>
  /** 曲线数据的帧率，单位 fps（新曲线方案专有）。 */
  fps?: number
  /** 表情名称列表，对应模型 .exp3.json 中定义的 expression。 */
  expression?: string[]
}

/** 本轮回复完成通知。 */
export interface ChatDoneMessage {
  type: 'chat:done'
  /** 后端聚合后的完整回复文本，用于聊天历史保存。 */
  full_text: string
  /** 本轮生成耗时，单位毫秒。 */
  elapsed_ms: number
  /** 本轮触发的工具调用次数。 */
  tool_calls_count: number
}

/** 服务端错误通知。 */
export interface ErrorMessage {
  type: 'error'
  /** 错误描述文本。 */
  data: string
  /** 错误码，可能为 null。 */
  error_code: string | null
}

/** LLM 通知前端某工具被调用了（流式通道中的事件，仅用于 UI 展示调用链路）。 */
export interface ToolCallEvent {
  type: 'tool_call'
  /** 工具调用唯一 ID。 */
  call_id: string
  /** 被调用的工具名称。 */
  tool_name: string
  /** 工具调用参数（JSON 字符串）。 */
  arguments: string
}

/** 工具执行结果事件（流式通道中的事件，仅用于 UI 展示）。 */
export interface ToolResultEvent {
  type: 'tool_result'
  /** 工具调用 ID，与 tool_call 事件匹配。 */
  tool_call_id: string
  /** 被调用的工具名称。 */
  tool_name: string
  /** 工具调用参数对象。 */
  arguments: Record<string, unknown>
  /** 执行是否成功。 */
  success: boolean
  /** 执行结果文本。 */
  result: string
  /** 执行耗时，单位毫秒。 */
  duration_ms: number
}

// ─────────────────────────────────────────────────────────────────────────
// 服务端 → 客户端 WS 工具协议消息
// ─────────────────────────────────────────────────────────────────────────

/** 工具敏感度级别。 */
export type ToolSensitivity = 'safe' | 'normal' | 'sensitive' | 'dangerous'

/** 工具执行模式：sync 等待结果回复，async 不阻塞 LLM 回复。 */
export type ToolExecMode = 'sync' | 'async'

/** 服务端下发客户端工具调用 ★ 核心消息。 */
export interface ToolCallWsMessage {
  type: 'tool:call'
  /** 工具调用唯一 ID，用于 result / progress / confirm 消息的匹配。 */
  call_id: string
  /** 需要客户端执行的工具名称。 */
  tool_name: string
  /** 工具调用参数对象。 */
  arguments: Record<string, unknown>
  /** 同步工具的超时时间，单位毫秒。 */
  timeout_ms: number
  /** 工具敏感度级别，影响是否需要用户确认。 */
  sensitivity: ToolSensitivity
  /** 执行模式。 */
  mode: ToolExecMode
  /** 敏感工具确认时的提示信息，可能为 null。 */
  confirm_message: string | null
}

/** 取消已下发的客户端工具调用。 */
export interface ToolCancelWsMessage {
  type: 'tool:cancel'
  /** 要取消的工具调用 ID。 */
  call_id: string
  /** 取消原因。 */
  reason: string
}

/** 异步工具 LLM 处理结果回推。 */
export interface ToolAsyncResultWsMessage {
  type: 'tool:async_result'
  /** 工具调用 ID。 */
  call_id: string
  /** 处理是否成功。 */
  success: boolean
  /** 处理结果文本。 */
  result: string
  /** 附加数据，可能为 null。 */
  data: Record<string, unknown> | null
}

/** 心跳响应。 */
export interface PongMessage {
  type: 'pong'
  /** 服务端当前时间戳。 */
  server_time: number
}

/** 服务端下发的所有消息联合类型。 */
export type ServerMessage =
  | ChatTextMessage
  | ChatAudioMessage
  | ChatMotionMessage
  | ChatDoneMessage
  | ErrorMessage
  | ToolCallEvent
  | ToolResultEvent
  | ToolCallWsMessage
  | ToolCancelWsMessage
  | ToolAsyncResultWsMessage
  | PongMessage

// ─────────────────────────────────────────────────────────────────────────
// 客户端 → 服务端 消息类型
// ─────────────────────────────────────────────────────────────────────────

/** 心跳请求。 */
export interface PingMessage {
  type: 'ping'
}

/** 用户发送聊天消息。 */
export interface ChatSendMessage {
  type: 'chat:send'
  /** 消息列表，通常包含单条用户消息。 */
  msg: { role: string; content: string }[]
  /** 是否要求后端生成 Live2D 动作帧。 */
  generation_motion: boolean
  /** 是否处于睡眠模式。 */
  is_sleep_mode: boolean
}

/** 用户发送交互事件消息。 */
export interface InteractionSendMessage {
  type: 'interaction:send'
  /** 事件类型，例如 idle、mouse、time、festival 等。 */
  event_type: string
  /** 事件发生场景，供后端构造提示词上下文。 */
  scene: string
  /** 事件附加上下文，字段由具体事件处理器决定。 */
  context: Record<string, unknown>
  /** 是否要求后端生成 Live2D 动作帧。 */
  generation_motion: boolean
  /** 是否携带历史上下文。 */
  include_history?: boolean
  /** 后端读取历史上下文时的数量限制。 */
  history_limit?: number
  /** 是否处于睡眠模式。 */
  is_sleep_mode: boolean
}

/** 用户取消当前聊天回复。 */
export interface ChatCancelMessage {
  type: 'chat:cancel'
  /** 可选的消息 ID。 */
  id?: string
}

/** 客户端工具执行结果回传。 */
export interface ToolResultMessage {
  type: 'tool:result'
  /** 工具调用 ID，与 tool:call 消息匹配。 */
  call_id: string
  /** 执行是否成功。 */
  success: boolean
  /** 执行结果文本（成功时为 JSON 字符串或描述文本）。 */
  result: string
  /** 错误信息，成功时为 null。 */
  error?: string | null
  /** 错误码，成功时为 null。 */
  error_code?: string | null
  /** 附加数据，可能为 null。 */
  data?: Record<string, unknown> | null
}

/** 工具执行进度推送。 */
export interface ToolProgressMessage {
  type: 'tool:progress'
  /** 工具调用 ID。 */
  call_id: string
  /** 工具名称。 */
  tool_name: string
  /** 执行阶段。 */
  status: 'started' | 'executing' | 'finalizing'
  /** 进度值：0~1 表示具体进度，-1 表示不确定的进行中状态。 */
  progress: number
  /** 进度描述文本。 */
  message: string
}

/** 敏感工具用户确认结果。 */
export interface ToolConfirmMessage {
  type: 'tool:confirm'
  /** 工具调用 ID。 */
  call_id: string
  /** 用户是否确认执行。 */
  confirmed: boolean
  /** 拒绝原因，确认时为空字符串。 */
  deny_reason: string
  /** 额外数据，可选。 */
  extra_data?: Record<string, unknown>
}

/** 客户端发送的所有消息联合类型。 */
export type ClientMessage =
  | PingMessage
  | ChatSendMessage
  | InteractionSendMessage
  | ChatCancelMessage
  | ToolResultMessage
  | ToolProgressMessage
  | ToolConfirmMessage
