import { watch } from 'vue'
import { MessageTips } from '../services/MessageTips'
import { Live2DManager } from '../services/Live2dManager'
import { useConfigStore } from '../stores/useConfigStore'
import { normalizeNumber } from '@renderer/utils/MathUtils'
import type { ChatMessage, ChatHistoryApiResponse } from '@shared/types/chat'
import { normalizeContent } from './contentNormalizer'
import {
  audioBase64ToBlob,
  ChatPlaybackController,
  estimateAudioDurationMs
} from './ChatPlaybackController'
import { ChatStreamProcessor } from './ChatStreamProcessor'
import { request } from '@shared/api/request'
import { ChatWebSocketManager } from '@renderer/composables/useChatWebSocket'
import { ToolSystem } from '@renderer/composables/useToolSystem'
import {
  registerAllWidgetTools,
  ALL_WIDGET_COMPONENT_DEFINITIONS
} from '@renderer/composables/widgetTools'
import type {
  ChatResultMessage,
  ChatDoneMessage,
  ErrorMessage,
  FileAttachment,
  ToolCallEvent,
  ToolResultEvent
} from '@shared/types/ws'
/** 自动交互事件请求载荷，用于 /api/interaction/message（保留 HTTP 方式）。 */
export interface InteractionEventPayload {
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
  /** 是否保持睡眠闭眼状态，梦呓等场景下为 true，不触发眼皮微张。 */
  keepSleepEyes?: boolean
  /** 事件图标配置，用于在台词板末尾显示对应图标。 */
  icon?: {
    /** 本地图片路径，如 'icon_bell.png'。 */
    path: string
  }
}

/**
 * 聊天服务门面层
 *
 * 作为 chat 功能域入口，对外提供聊天、交互消息、TTS 播放和提示控制能力。
 */
class ChatManager {
  private static instance: ChatManager
  /** 台词/提示气泡控制器。 */
  private readonly messageTips: MessageTips
  /** 负责台词、音频、Live2D 口型和动作播放。 */
  private readonly playbackController: ChatPlaybackController
  /** 负责 WS 消息处理和 text/audio/motion 句子同步。 */
  private readonly streamProcessor: ChatStreamProcessor
  /** Live2D 管理器实例，disabled 时阻止聊天和播放。 */
  private readonly live2DManager: Live2DManager | null
  /** WebSocket 连接管理器，负责与后端的双向通信。 */
  private readonly ws: ChatWebSocketManager
  /** 客户端工具执行系统，管理工具注册表和调度执行。 */
  private readonly toolSystem: ToolSystem
  /** 对话中标志，防止自动交互事件在对话进行中重复触发。 */
  public isChatting: boolean = false
  /** 当前交互事件的图标配置，用于在台词板末尾显示对应图标。 */
  private currentInteractionIcon?: { path: string }
  /** 当前聊天请求的 resolve 函数，chat:done 时调用。 */
  private chatDoneResolve: ((value: boolean) => void) | null = null
  /** 当前聊天请求的 reject 函数，chat:error 或中断时调用。 */
  private chatDoneReject: ((reason: unknown) => void) | null = null
  /** 当前交互请求的 resolve 函数，chat:done 时调用。 */
  private interactionDoneResolve: ((value: string | null) => void) | null = null
  /** 当前交互请求的 reject 函数，chat:error 或中断时调用。 */
  private interactionDoneReject: ((reason: unknown) => void) | null = null
  /** 初始化各内部模块，建立 WS 连接并注册消息监听。 */
  private constructor() {
    this.messageTips = new MessageTips()
    this.live2DManager = Live2DManager.getInstance()
    // 初始化聊天历史存储、播放控制器和流处理器
    this.playbackController = new ChatPlaybackController(this.live2DManager, (...args) => {
      this.messageTips.showMessage(...args)
    })
    // 流处理器的 enqueue 回调会将播放段推送给播放控制器，并附加当前交互图标（如果有）
    this.streamProcessor = new ChatStreamProcessor(
      (segment) => {
        if (this.currentInteractionIcon) {
          segment.icon = this.currentInteractionIcon
        }
        this.playbackController.enqueue(segment)
      },
      (finalText) => this.handleStreamComplete(finalText),
      (errorData) => {
        console.error('[Chat] WS 服务端错误:', errorData.error_code, errorData.data)
      }
    )

    this.ws = new ChatWebSocketManager()
    this.toolSystem = new ToolSystem(this.ws)

    this.setupWsListeners()

    // 建立 WebSocket 连接并注册 IPC 监听器，使渲染进程能接收后端推送的消息
    this.ws.connect()

    // 整段回复播放完毕后自动隐藏台词板。
    // 若播放结束时有活跃的工具调用（耗时工具等待中），同步重置累积显示文本，
    // 避免工具返回后台词板重新显示时从头重复播放已展示过的旧文本。
    this.playbackController.onSpeechEnd(() => {
      this.messageTips.hideMessage()
    })

    this.registerClientTools()

    const configStore = useConfigStore()
    this.setVolume(normalizeNumber(configStore.config.volume))
    watch(
      () => configStore.config.volume,
      (newVolume) => {
        this.setVolume(normalizeNumber(newVolume))
      }
    )
  }

  /** 获取 ChatManager 单例实例。 */
  public static getInstance(): ChatManager {
    if (!ChatManager.instance) {
      ChatManager.instance = new ChatManager()
    }

    return ChatManager.instance
  }

  /** 初始化消息提示渲染回调。 */
  public initializeMessageTips(
    _element: HTMLElement,
    renderCallback: Parameters<MessageTips['setRenderCallback']>[0]
  ): void {
    this.messageTips.setRenderCallback(renderCallback)
  }

  /** 获取当前助手的聊天历史（从主进程）。 */
  public async getChatHistory(): Promise<ChatMessage[]> {
    return window.api.chat.getHistory()
  }

  /** 从后端拉取当前助手聊天历史，并同步到主进程存储。 */
  public async fetchChatHistory(): Promise<ChatMessage[]> {
    const response = await request.get('/api/chat/history')
    const data = response.data as ChatHistoryApiResponse
    const messages = normalizeChatHistory(data.data)
    await window.api.chat.replaceHistory(messages)
    return messages
  }

  /** 清空聊天历史（本地 + 云端）。 */
  public async clearChatHistory(): Promise<void> {
    await window.api.chat.clearHistory()
  }

  /** 获取当前是否处于语音/动作回复播放中。 */
  public getReplyStatus(): boolean {
    return this.playbackController.isReplying()
  }

  /** 注册语音播放开始回调。 */
  public onSpeechStart(callback: (message: string) => void): void {
    this.playbackController.onSpeechStart(callback)
  }

  /** 注册语音播放结束回调。 */
  public onSpeechEnd(callback: () => void): void {
    this.playbackController.onSpeechEnd(callback)
  }

  /** 获取当前台词板累积展示文本。 */
  public getCurrentDisplayText(): string {
    return this.playbackController.getCurrentDisplayText()
  }

  /**
   * 发送用户聊天消息（WS 协议）。
   *
   * 发送流程:
   *   1. 参数验证和 Live2D 状态检查
   *   2. 中断当前播放并重置流处理器
   *   3. 推送用户消息到本地历史
   *   4. 将附件文件编码为 Base64（通过主进程读取）
   *   5. 通过 WS 发送 chat:send 消息（含附件）
   *   6. 返回 Promise，在 chat:done 时 resolve，chat:error 时 reject
   *
   * @param message - 用户输入的消息文本
   * @param isSleepMode - 是否为睡眠模式（受限回复）
   * @param attachments - 附件列表（文件名 + 本地路径）
   * @returns 发送成功返回 true，参数为空或 Live2D 不可用时返回 false
   */
  public async chat(
    message: string,
    isSleepMode: boolean = false,
    attachments?: { name: string; path: string }[]
  ): Promise<boolean> {
    if ((!message || !message.trim()) && (!attachments || attachments.length === 0)) {
      return false
    }

    if (this.live2DManager?.disabled) return false

    this.interruptCurrentPlayback()
    this.isChatting = true

    // 清理上一轮未 resolve/reject 的 Promise
    if (this.chatDoneResolve) {
      this.chatDoneResolve(false)
      this.chatDoneResolve = null
      this.chatDoneReject = null
    }

    // 图片扩展名列表，用于分类附件
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico']
    const getExt = (name: string): string => name.split('.').pop()?.toLowerCase() ?? ''

    // 读取附件文件，编码为 Base64，统一放入 files 数组用 type 区分
    const files: FileAttachment[] = []
    if (attachments && attachments.length > 0) {
      const results = await Promise.allSettled(
        attachments.map((att) =>
          window.api.ipcRenderer.invoke<{
            success: boolean
            name?: string
            content?: string
            mimeType?: string
            error?: string
          }>('tool:read-file-base64', att.path)
        )
      )
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status === 'rejected' || !result.value.success || !result.value.content) {
          console.warn(
            `[Chat] 读取附件失败: ${attachments[i].name}`,
            result.status === 'rejected' ? result.reason : result.value.error
          )
          continue
        }
        const ext = getExt(attachments[i].name)
        const isImage = imageExts.includes(ext)
        files.push({
          data: isImage
            ? `data:${result.value.mimeType || 'image/png'};base64,${result.value.content}`
            : result.value.content,
          name: attachments[i].name,
          type: isImage ? 'image' : 'text'
        })
      }
    }

    return new Promise<boolean>((resolve, reject) => {
      try {
        // 同步用户消息到主进程存储（fire-and-forget）
        const displayContent = message || `发送了 ${attachments?.length ?? 0} 个文件`
        window.api.chat
          .appendMessage({ role: 'user', content: displayContent })
          .catch((err) => console.error('[Chat] 保存用户消息失败:', err))
        // 是否启用动作生成
        const useMotionGenerate = useConfigStore().config.generateMotion

        // 在 chat:done 时 resolve 当前 Promise，并清理回调引用
        this.chatDoneResolve = (value: boolean) => {
          this.isChatting = false
          this.chatDoneResolve = null
          this.chatDoneReject = null
          resolve(value)
        }
        // 在 chat:error 或中断时 reject 当前 Promise，并清理回调引用
        this.chatDoneReject = (reason: unknown) => {
          this.isChatting = false
          this.chatDoneResolve = null
          this.chatDoneReject = null
          // 回滚用户消息
          window.api.chat.popHistory().catch((err) => console.error('[Chat] 回滚历史失败:', err))
          reject(reason)
        }

        this.ws.send({
          type: 'chat:send',
          text: displayContent,
          files,
          generation_motion: useMotionGenerate,
          is_sleep_mode: isSleepMode
        })
      } catch (error) {
        this.isChatting = false
        // 回滚用户消息
        window.api.chat.popHistory().catch((err) => console.error('[Chat] 回滚历史失败:', err))
        this.chatDoneResolve = null
        this.chatDoneReject = null
        reject(error)
      }
    })
  }

  /**
   * 发送自动交互事件消息（WS 协议）。
   *
   * 发送流程:
   *   1. 状态检查（Live2D、isChatting、isReplying）
   *   2. 中断当前播放并重置流处理器
   *   3. 通过 WS 发送 interaction:send 消息
   *   4. 返回 Promise，在 chat:done 时 resolve 完整回复文本，chat:error 时 reject
   *
   * @param payload - 交互事件载荷
   * @returns 完整回复文本或 null
   */
  public async interactionChat(payload: InteractionEventPayload): Promise<string | null> {
    if (this.live2DManager?.disabled) return null
    if (this.isChatting) return null
    if (this.playbackController.isReplying()) return null

    // 清除上一轮交互残留的台词板显示内容，防止文本堆积
    this.interruptCurrentPlayback()
    this.isChatting = true

    this.currentInteractionIcon = payload.icon

    // 清理上一轮未 resolve/reject 的 Promise
    if (this.interactionDoneResolve) {
      this.interactionDoneResolve(null)
      this.interactionDoneResolve = null
      this.interactionDoneReject = null
    }

    return new Promise<string | null>((resolve, reject) => {
      try {
        const useMotionGenerate = useConfigStore().config.generateMotion
        this.playbackController.setKeepSleepEyesClosed(payload.keepSleepEyes === true)

        this.interactionDoneResolve = (value: string | null) => {
          this.interactionDoneResolve = null
          this.interactionDoneReject = null
          this.isChatting = false
          this.currentInteractionIcon = undefined

          resolve(value)
        }
        this.interactionDoneReject = (reason: unknown) => {
          this.interactionDoneResolve = null
          this.interactionDoneReject = null
          this.isChatting = false
          this.currentInteractionIcon = undefined
          reject(reason)
        }

        this.ws.send({
          type: 'interaction:send',
          event_type: payload.event_type,
          scene: payload.scene,
          context: payload.context,
          generation_motion: useMotionGenerate,
          include_history: payload.include_history,
          history_limit: payload.history_limit,
          is_sleep_mode: payload.keepSleepEyes === true
        })
      } catch (error) {
        this.isChatting = false
        this.currentInteractionIcon = undefined
        this.interactionDoneResolve = null
        this.interactionDoneReject = null
        reject(error)
      }
    })
  }

  /** 发送一条仅 TTS 的助手消息，不请求模型生成回复（保留 HTTP 方式）。 */
  public async sendMessage(message: string): Promise<void> {
    if (this.live2DManager?.disabled) return
    this.interruptCurrentPlayback()
    try {
      const response = await request.post('/api/gptsovits', { msg: message })

      const result = response.data
      const ttsMessage = typeof result.message === 'string' ? result.message : ''
      const ttsFile = typeof result.file === 'string' ? result.file : ''

      if (ttsFile) {
        const audioBlob = audioBase64ToBlob(ttsFile, 'audio/wav')
        this.playbackController.enqueue({
          message: ttsMessage,
          audioBlob,
          audioDurationMs: await estimateAudioDurationMs(audioBlob),
          appendToDisplayText: true
        })
      } else {
        this.messageTips.showMessage(ttsMessage)
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('发送消息失败:', error)
      }
    }
  }

  /**
   * 中断当前播放和请求。
   *
   * - 仅在存在活跃聊天/交互请求时才发送 WS chat:cancel 消息通知服务端
   * - 中断 HTTP 请求（如果有）
   * - 清理本地播放队列和台词板
   * - 拒绝当前 chat() / interactionChat() Promise
   */
  public interruptCurrentPlayback(): void {
    this.messageTips.hideMessage()
    this.playbackController.stopAudio()
    this.playbackController.resetDisplayText()
    this.currentInteractionIcon = undefined

    this.ws.send({ type: 'chat:cancel' })

    // 拒绝当前聊天 Promise
    if (this.chatDoneReject) {
      this.chatDoneReject(new Error('用户中断'))
    }
    // 拒绝当前交互 Promise
    if (this.interactionDoneReject) {
      this.interactionDoneReject(new Error('用户中断'))
    }
  }

  /** 设置播放音量，范围会被限制在 0-1。 */
  public setVolume(volume: number): void {
    this.playbackController.setVolume(volume)
  }

  /** 获取当前播放音量。 */
  public getVolume(): number {
    return this.playbackController.getVolume()
  }

  /**
   * 注册 WebSocket 消息监听器。
   */
  private setupWsListeners(): void {
    // ---- 聊天结果消息（统一格式，替代 chat:text / chat:audio / chat:motion） ----
    // 守卫：仅当前实例发起过聊天（isChatting === true）时才处理，
    // 防止主进程单条 WS 连接广播到多个窗口时，非活跃 ChatManager 重复处理并保存回复。
    this.ws.on('chat:result', (msg: ChatResultMessage) => {
      if (!this.isChatting) return

      // 工具执行结果：保存 role: tool 消息到聊天历史
      if (msg.role === 'tool' && msg.tool_call_id) {
        window.api.chat
          .appendMessage({
            role: 'tool',
            content: msg.content ?? '',
            tool_call_id: msg.tool_call_id
          })
          .catch((err) => console.error('[Chat] 保存工具结果消息失败:', err))
        return
      }

      // 工具调用：保存助手消息（含 tool_calls）到聊天历史
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        window.api.chat
          .appendMessage({
            role: 'assistant',
            content: null,
            tool_calls: msg.tool_calls
          })
          .catch((err) => console.error('[Chat] 保存工具调用消息失败:', err))
      }

      // 文本 + 可选 extras（音频/动作）：交给流处理器解析播放段
      if (msg.content !== null || msg.extras) {
        this.streamProcessor.feed(msg)
      }
    })

    this.ws.on('chat:done', (msg: ChatDoneMessage) => {
      if (!this.isChatting) return
      this.streamProcessor.feed(msg)
      this.resolveChatDonePromise(msg.full_text)
    })

    this.ws.on('error', (msg: ErrorMessage) => {
      if (!this.isChatting && !this.chatDoneReject && !this.interactionDoneReject) return
      this.streamProcessor.feed(msg)

      if (this.chatDoneReject) {
        this.chatDoneReject(new Error(msg.data))
      }
      if (this.interactionDoneReject) {
        this.interactionDoneReject(new Error(msg.data))
      }
    })

    // ---- LLM 工具调用事件（聊天框上显示当前正在调用的工具） ----
    this.ws.on('tool_call', (msg: ToolCallEvent) => {
      if (!this.isChatting) return
      console.log('[ToolCall]', msg.tool_name, msg.arguments)
      window.api.chat
        .appendMessage({
          role: 'tool',
          content: `正在调用工具: ${msg.tool_name}`,
          tool_call_id: msg.call_id
        })
        .catch((err) => console.error('[Chat] 保存工具调用消息失败:', err))
    })

    this.ws.on('tool_result', (msg: ToolResultEvent) => {
      if (!this.isChatting) return
      console.log('[ToolResult]', msg.tool_name, msg.success, `${msg.duration_ms}ms`)

      window.api.chat
        .appendMessage({
          role: 'tool',
          content: msg.result,
          tool_call_id: msg.tool_call_id
        })
        .catch((err) => console.error('[Chat] 保存工具结果失败:', err))
    })

    // ---- WS 工具协议 ----
    this.ws.on('tool:call', (msg) => {
      if (!this.isChatting) return
      window.api.chat
        .appendMessage({
          role: 'tool',
          content: `正在调用工具: ${msg.tool_name}`,
          tool_call_id: msg.call_id
        })
        .catch((err) => console.error('[Chat] 保存工具调用消息失败:', err))
      void this.toolSystem.handleToolCall(msg)
    })

    this.ws.on('tool:cancel', (msg) => {
      console.log('[ToolCancel]', msg.call_id, msg.reason)
    })

    this.ws.on('tool:async_result', (msg) => {
      console.log('[ToolAsyncResult]', msg.call_id, msg.result)
      window.api.chat
        .appendMessage({
          role: 'tool',
          content: msg.result,
          tool_call_id: msg.call_id
        })
        .catch((err) => console.error('[Chat] 保存工具结果失败:', err))
    })

    // ---- 客户端工具协商 ----
    this.ws.on('tool:query', () => {
      console.log(
        '[ToolQuery] 服务端请求客户端工具列表，上报组件:',
        ALL_WIDGET_COMPONENT_DEFINITIONS.length,
        '个'
      )
      this.ws.send({
        type: 'tool:definitions',
        components: ALL_WIDGET_COMPONENT_DEFINITIONS
      })
    })

    // ---- 断连处理 ----
    this.ws.onDisconnect(() => {
      this.interruptCurrentPlayback()
    })
  }

  /**
   * 注册所有客户端工具。
   *
   * 根据后端实际注册的工具列表，在此注册对应的客户端执行函数。
   * 工具通过 Electron IPC 或浏览器 API 完成本地操作后回传结果。
   */
  private registerClientTools(): void {
    // 注册所有小组件相关的客户端工具（天气 / 待办 / 便签 / 时钟 / 每日一句）
    registerAllWidgetTools(this.toolSystem)

    // 可按需在此继续注册非小组件类的客户端工具（如文件选择器、截屏等）
    // 示例: 打开文件选择器
    // this.toolSystem.register('file_selector', async (args) => { ... })
  }

  /**
   * resolve 当前聊天或交互请求的 Promise。
   *
   * chat:done 处理完毕后调用，通知 chat() 或 interactionChat() 等待者回复已完成。
   *
   * @param fullText - 本轮回复完整文本，interactionChat 需要它作为返回值
   */
  private resolveChatDonePromise(fullText: string): void {
    if (this.chatDoneResolve) {
      this.chatDoneResolve(true)
    }
    if (this.interactionDoneResolve) {
      this.interactionDoneResolve(fullText || null)
    }
  }

  /** 流式回复完成后保存助手回复到主进程存储。 */
  private handleStreamComplete(finalText?: string): void {
    const textToSave = (finalText || this.getCurrentDisplayText()).trim()
    if (textToSave) {
      window.api.chat
        .appendMessage({
          role: 'assistant',
          content: textToSave
        })
        .catch((err) => console.error('[Chat] 保存助手回复失败:', err))
    }
  }
}

/** 标准化后端聊天历史返回值，保留所有 OpenAI 兼容字段。 */
function normalizeChatHistory(rawMessages?: ChatHistoryApiResponse['data']): ChatMessage[] {
  if (!Array.isArray(rawMessages)) return []
  return rawMessages.map((item) => ({
    role: item.role === 'assistant' ? 'assistant' : item.role === 'tool' ? 'tool' : 'user',
    content: normalizeContent(item.content),
    ...(item.tool_calls ? { tool_calls: item.tool_calls } : {}),
    ...(item.tool_call_id ? { tool_call_id: item.tool_call_id } : {})
  }))
}

export { ChatManager }
export type { ChatMessage }
