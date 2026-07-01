import { watch } from 'vue'
import { MessageTips } from '../services/MessageTips'
import { Live2DManager } from '../services/Live2dManager'
import { AssistantManager } from '../services/assistantManager'
import { useConfigStore } from '../stores/useConfigStore'
import { normalizeNumber } from '@renderer/utils/MathUtils'
import { ChatHistoryStore, type ChatMessage } from './ChatHistoryStore'
import {
  audioBase64ToBlob,
  ChatPlaybackController,
  estimateAudioDurationMs
} from './ChatPlaybackController'
import { ChatStreamProcessor, type ChatStreamChunk } from './ChatStreamProcessor'
import { request } from '@shared/api/request'

/** 自动交互事件请求载荷，用于 /api/interaction/message。 */
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
 * 聊天服务门面层。
 *
 * 作为 chat 功能域入口，对外提供聊天、交互消息、TTS 播放和提示控制能力；内部只负责协调请求、历史、流处理、播放和消息提示。
 */
class ChatManager {
  private static instance: ChatManager
  /** 台词/提示气泡控制器。 */
  private readonly messageTips: MessageTips
  /** 当前助手信息管理器，用于读取名称和刷新好感度等数据。 */
  private readonly assistantManager: AssistantManager
  /** 按助手名称管理本地聊天历史。 */
  private readonly chatHistoryStore: ChatHistoryStore
  /** 负责台词、音频、Live2D 口型和动作播放。 */
  private readonly playbackController: ChatPlaybackController
  /** 负责 SSE 解析和 text/audio/motion_frame 句子同步。 */
  private readonly streamProcessor: ChatStreamProcessor
  /** Live2D 管理器实例，disabled 时阻止聊天和播放。 */
  private readonly live2DManager: Live2DManager | null
  /** 当前请求控制器，用于中断正在进行的聊天或 TTS 请求。 */
  private abortController: AbortController | null = null
  /** 对话中标志，防止自动交互事件在对话进行中重复触发。 */
  public isChatting: boolean = false
  /** 当前交互事件的图标配置，用于在台词板末尾显示对应图标。 */
  private currentInteractionIcon?: { path: string }

  /** 初始化各内部模块，并监听全局音量配置变化。 */
  private constructor() {
    this.assistantManager = AssistantManager.getInstance()
    this.messageTips = new MessageTips()
    this.live2DManager = Live2DManager.getInstance()
    this.chatHistoryStore = new ChatHistoryStore()
    this.playbackController = new ChatPlaybackController(this.live2DManager, (...args) => {
      this.showTempMessage(...args)
    })
    this.streamProcessor = new ChatStreamProcessor(
      (segment) => {
        // 将当前交互事件的图标配置附加到播放片段
        if (this.currentInteractionIcon) {
          segment.icon = this.currentInteractionIcon
        }
        this.playbackController.enqueue(segment)
      },
      (finalText) => this.handleStreamComplete(finalText)
    )

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

  /** 获取当前助手的本地聊天历史。 */
  public getChatHistory(): ChatMessage[] {
    return this.chatHistoryStore.get()
  }

  /** 从后端拉取当前助手聊天历史，并同步到本地历史缓存。 */
  public async fetchChatHistory(): Promise<ChatMessage[]> {
    const response = await request.get('/api/chat/history?only_assistant=false')

    return this.chatHistoryStore.syncFromApi(response.data as never)
  }

  /** 清空全部助手的本地聊天历史缓存。 */
  public clearChatHistory(): void {
    this.chatHistoryStore.clear()
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

  /** 等待当前回复的流同步和播放队列完成。 */
  public async waitForReplyPlaybackComplete(timeoutMs: number = 120000): Promise<void> {
    const start = Date.now()

    while (this.hasPendingReplyPlaybackWork()) {
      if (Date.now() - start >= timeoutMs) {
        console.warn('等待回复播放完成超时，继续后续流程')
        break
      }

      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }

    await new Promise((resolve) => window.setTimeout(resolve, 3000))
    this.hideMessage()
  }

  /** 发送用户聊天消息。 */
  public async chat(message: string, isSleepMode: boolean = false): Promise<boolean> {
    if (!message || !message.trim()) {
      return false
    }

    if (this.live2DManager?.disabled) return false

    this.interruptCurrentPlayback()

    try {
      this.chatHistoryStore.push({ role: 'user', content: message })
      this.abortController = new AbortController()

      const configStore = useConfigStore()
      const useMotionGenerate = configStore.config.generateMotion
      this.streamProcessor.reset(useMotionGenerate)

      await request.stream<ChatStreamChunk>(
        '/api/chat',
        {
          msg: this.chatHistoryStore.get(),
          generation_motion: useMotionGenerate,
          is_sleep_mode: isSleepMode
        },
        (chunk) => this.streamProcessor.feed(chunk),
        { signal: this.abortController.signal }
      )
      this.refreshCurrentAssistantSafely()

      return true
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('请求被中断')
        return false
      }

      console.error('请求失败:', error)
      this.chatHistoryStore.popLast()
      return false
    }
  }

  /** 发送自动交互事件消息，复用普通聊天的流处理和播放管线。 */
  public async interactionChat(payload: InteractionEventPayload): Promise<string | null> {
    if (this.live2DManager?.disabled) return null
    if (this.isChatting) return null
    if (this.playbackController.isReplying()) return null

    this.isChatting = true
    this.interruptCurrentPlayback()

    // 保存当前交互事件的图标配置
    this.currentInteractionIcon = payload.icon

    try {
      const configStore = useConfigStore()
      const useMotionGenerate = configStore.config.generateMotion
      this.streamProcessor.reset(useMotionGenerate)
      this.playbackController.setKeepSleepEyesClosed(payload.keepSleepEyes === true)
      this.abortController = new AbortController()

      await request.stream<ChatStreamChunk>(
        '/api/interaction/message',
        {
          ...payload,
          generation_motion: useMotionGenerate
        },
        (chunk) => this.streamProcessor.feed(chunk),
        { signal: this.abortController.signal }
      )
      this.refreshCurrentAssistantSafely()

      return this.getCurrentDisplayText().trim() || null
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('交互请求被中断')
        return null
      }

      console.error('交互请求失败:', error)
      return null
    } finally {
      this.isChatting = false
      this.currentInteractionIcon = undefined
    }
  }

  /** 发送一条仅 TTS 的助手消息，不请求模型生成回复。 */
  public async sendMessage(message: string): Promise<void> {
    if (this.live2DManager?.disabled) return
    this.interruptCurrentPlayback()
    this.abortController = new AbortController()

    try {
      const response = await request.post(
        '/api/gptsovits',
        { msg: message },
        {
          signal: this.abortController.signal
        }
      )

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
        this.showTempMessage(ttsMessage)
      }

      this.refreshCurrentAssistantSafely()
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('发送消息失败:', error)
      }
    }
  }

  /** 中断当前请求、播放队列、动作序列和台词展示。 */
  public interruptCurrentPlayback(): void {
    this.stopAudio()
    this.hideMessage()
    this.playbackController.resetDisplayText()
    this.currentInteractionIcon = undefined

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /** 显示临时台词/提示消息。 */
  public showTempMessage(
    text: string,
    timeout: number = 5000,
    priority: number = 1,
    transitionDuration: number = 0,
    icon?: { path: string }
  ): void {
    this.messageTips.showMessage(text, timeout, priority, transitionDuration, icon)
  }

  /** 隐藏当前台词/提示消息。 */
  public hideMessage(): void {
    this.messageTips.hideMessage()
  }

  /** 停止语音和动作播放，并清理待同步句子。 */
  public stopAudio(): void {
    this.playbackController.stopAudio()
    this.streamProcessor.clearPending()
  }

  /** 设置播放音量，范围会被限制在 0-1。 */
  public setVolume(volume: number): void {
    this.playbackController.setVolume(volume)
  }

  /** 获取当前播放音量。 */
  public getVolume(): number {
    return this.playbackController.getVolume()
  }

  /** 判断当前回复是否还有待同步或待播放工作。 */
  private hasPendingReplyPlaybackWork(): boolean {
    return this.playbackController.hasPendingWork() || this.streamProcessor.hasPendingWork()
  }

  /** 流式回复完成后保存助手回复到本地历史。 */
  private handleStreamComplete(finalText?: string): void {
    const textToSave = (finalText || this.getCurrentDisplayText()).trim()
    if (textToSave) {
      this.chatHistoryStore.push({
        role: 'assistant',
        content: textToSave
      })
    }
  }

  /** 刷新当前助手数据，失败只记录日志，不影响聊天主流程。 */
  private refreshCurrentAssistantSafely(): void {
    this.assistantManager
      .refreshCurrentAssistant()
      .catch((e) => console.warn('刷新助手好感度失败:', e))
  }
}

export { ChatManager }
export type { ChatMessage }
