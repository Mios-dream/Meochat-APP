import { MessageTips } from '../services/MessageTips'
import { Live2DManager } from './Live2dManager'
import { useConfigStore } from '../stores/useConfigStore'
import { computed, watch } from 'vue'
import { AssistantManager } from './assistantManager'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatHistoryApiResponse {
  msg?: string
  assistant?: string
  onlyAssistant?: boolean
  count?: number
  data?: Array<{
    role: 'user' | 'assistant' | string
    content: string
  }>
}
// 文本chunk
interface TextChunk {
  type: 'text'
  sentence_id: number
  // 源文本，未删除括号前的文本
  source_text: string
  done?: boolean
}
// 动作帧chunk
interface MotionFrameChunk {
  type: 'motion_frame'
  sentence_id: number
  source_text?: string
  motions?: Array<{
    duration?: number
    action?: string
    parameters?: Record<string, number>
  }>
  duration?: number
  done?: boolean
}
// 音频chunk
interface AudioChunk {
  type: 'audio'
  sentence_id: number
  // 删除括号后的文本
  message: string
  // 源文本，未删除括号前的文本
  source_text: string
  file: string
  done?: boolean
}
// 完成标志chunk
interface DoneChunk {
  type: 'done'
  full_text?: string
  done: true
}

type StreamChunk = TextChunk | MotionFrameChunk | AudioChunk | DoneChunk

// 文本和音频的组合对象，用于统一处理包含文本和/或音频的消息
interface TextAudioPair {
  sentenceId?: number
  message: string
  audioBlob?: Blob
  motionSequence?: MotionStep[]
  audioDurationMs?: number
  motionDurationMs?: number
  appendToDisplayText?: boolean
}

// 动作步骤对象，包含持续时间和参数，用于描述 Live2D 模型的动作变化
interface MotionStep {
  durationMs: number
  parameters: Record<string, number>
}
// 句子同步状态对象，用于跟踪每个 sentence_id 对应的文本、音频、动作以及是否已入队，确保文本、音频和动作能够正确同步并按顺序播放
interface SentenceSyncState {
  // 句子ID
  sentenceId: number
  // 优先用于台词板显示的原文（尽量来自 text/source_text）
  displayMessage: string
  // 该句子的文本内容
  message: string
  // audioBlob 可能为 undefined，表示该句子没有音频文件（即 file 为空），此时仅播放动作（如果有）而不进行语音播放。
  audioBlob?: Blob
  // audioMissing 标志用于指示该句子是否缺少音频文件（即 file 为空）
  audioMissing: boolean
  // 动作序列
  motionSequence?: MotionStep[]
  // isQueued 标志用于指示该句子是否已经被加入播放队列，防止同一数据被重复处理和入队，确保每个句子只会被处理一次。
  isQueued: boolean
}

class ChatService {
  private static instance: ChatService
  // 消息提示对象
  private messageTips: MessageTips
  // 聊天记录, 键为助手名称
  private chatHistory: Map<string, ChatMessage[]> = new Map()
  // 文本和音频的组合队列
  private textAudioQueue: TextAudioPair[] = []
  // 按句子缓存语音与动作
  private pendingSentenceSync: Map<number, SentenceSyncState> = new Map()
  // 当前应当出队的 sentence_id，确保播放顺序稳定
  private nextSentenceId: number | null = null
  // 传输缓冲区，防止音频过长导致的chunk分割，json解析失败的问题
  private chunkBuffer: string = ''

  // 语音播放状态
  private isPlaying: boolean = false
  // api 地址
  private apiUrl = computed(() => {
    // 延迟获取 configStore
    const configStore = useConfigStore()
    return `http://${configStore.config.baseUrl}`
  })
  // Live2D管理器
  private live2DManager: Live2DManager | null = null
  // AbortController 用于取消请求
  private abortController: AbortController | null = null
  // 音量属性
  private volume: number = 1.0
  // 当前显示的文本
  private currentDisplayText: string = ''
  // 助手管理器
  private assistantManager: AssistantManager
  // 当前流是否要求动作与语音严格配对
  private expectMotionForStream = false
  // 动作序列令牌，用于中断旧序列
  private motionSequenceToken = 0

  private constructor() {
    // 初始化助手管理器
    this.assistantManager = AssistantManager.getInstance()
    // 初始化消息提示对象
    this.messageTips = new MessageTips()
    // 获取 Live2DManager 实例
    this.live2DManager = Live2DManager.getInstance()

    // 从全局配置同步音量，兼容旧配置可能使用 0-100 存储。
    const configStore = useConfigStore()
    this.setVolume(this.normalizeConfigVolume(configStore.config.volume))
    watch(
      () => configStore.config.volume,
      (newVolume) => {
        this.setVolume(this.normalizeConfigVolume(newVolume))
      }
    )
  }

  private normalizeConfigVolume(value: number): number {
    if (!Number.isFinite(value)) {
      return 0.8
    }

    if (value > 1 && value <= 100) {
      return Math.max(0, Math.min(1, value / 100))
    }

    return Math.max(0, Math.min(1, value))
  }

  /**
   * 获取单例实例
   * @returns ChatService 单例实例
   */
  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService()
    }
    return ChatService.instance
  }

  /**
   * 初始化消息提示元素
   * @param element 消息提示元素
   */
  public initializeMessageTips(element: HTMLElement): void {
    this.messageTips.setTipsElement(element)
  }

  /**
   * 获取聊天记录
   * @returns ChatMessage[] 聊天记录
   */
  public getChatHistory(): ChatMessage[] {
    const assistantName = this.assistantManager.getCurrentAssistant()?.name || ''
    return this.chatHistory.get(assistantName) || []
  }

  /**
   * 从后端拉取聊天历史并同步到当前助手缓存
   * @returns ChatMessage[] 聊天记录
   */
  public async fetchChatHistory(): Promise<ChatMessage[]> {
    const response = await fetch(this.apiUrl.value + '/api/chat/history?only_assistant=false', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = (await response.json()) as ChatHistoryApiResponse
    const normalizedHistory = this.normalizeChatHistory(result.data)
    const assistantNameFromResponse =
      typeof result.assistant === 'string' ? result.assistant.trim() : ''
    const currentAssistantName = this.assistantManager.getCurrentAssistant()?.name || ''
    const assistantName = assistantNameFromResponse || currentAssistantName

    if (assistantName) {
      this.chatHistory.set(assistantName, this.trimChatHistory(normalizedHistory, 20))
    }

    return normalizedHistory
  }

  /**
   * 清空聊天记录
   */
  public clearChatHistory(): void {
    this.chatHistory = new Map()
  }

  /**
   * 获取当前消息回复状态
   */
  public getReplyStatus(): boolean {
    // 如果正在播放语音，视为正在回复
    return this.isPlaying
  }

  /**
   * 等待当前回复流程中的语音/动作播放完成。
   * 若当前回复没有语音和动作，会快速返回。
   */
  public async waitForReplyPlaybackComplete(timeoutMs: number = 120000): Promise<void> {
    const start = Date.now()

    while (this.hasPendingReplyPlaybackWork()) {
      if (Date.now() - start >= timeoutMs) {
        console.warn('等待回复播放完成超时，继续后续流程')
        break
      }

      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }
    // 确保回复完成后至少有短暂的停顿，避免紧接着的用户输入导致消息提示过快消失，提升用户体验。
    await new Promise((resolve) => window.setTimeout(resolve, 3000))
    this.hideMessage()
  }

  /**
   * 判断当前是否仍有待播放的语音/动作工作。
   */
  private hasPendingReplyPlaybackWork(): boolean {
    return this.isPlaying || this.textAudioQueue.length > 0 || this.pendingSentenceSync.size > 0
  }

  /**
   * 发送消息
   * @param message 消息内容
   * @returns Promise<boolean> 是否成功发送
   */
  public async chat(message: string): Promise<boolean> {
    if (!message || !message.trim()) {
      return false
    }

    if (this.live2DManager?.disabled) return false
    // 停止正在播放的对话和消息
    this.interruptCurrentPlayback()

    // 重置
    this.currentDisplayText = ''
    this.textAudioQueue = []
    this.pendingSentenceSync.clear()
    this.nextSentenceId = null
    this.chunkBuffer = ''

    try {
      const assistantName = this.assistantManager.getCurrentAssistant()?.name || ''
      // 确保当前助手有聊天记录数组
      if (!this.chatHistory.has(assistantName)) {
        this.chatHistory.set(assistantName, [])
      }

      const currentHistory = this.chatHistory.get(assistantName)!
      currentHistory.push({ role: 'user', content: message })

      // 限制聊天历史记录长度为20条
      const trimmedHistory = this.trimChatHistory(currentHistory, 20)
      this.chatHistory.set(assistantName, trimmedHistory)

      // 创建 AbortController 用于可能的中断
      this.abortController = new AbortController()

      const configStore = useConfigStore()
      const useMotionGenerate = configStore.config.generateMotion
      this.expectMotionForStream = useMotionGenerate

      const response = await fetch(this.apiUrl.value + '/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          msg: this.chatHistory.get(assistantName) || [],
          generation_motion: useMotionGenerate
        }),
        signal: this.abortController.signal // 添加信号用于中断
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          const flushChunk = decoder.decode()
          if (flushChunk) {
            this.parseStreamChunk(flushChunk)
          }
          this.flushStreamBuffer()
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        this.parseStreamChunk(chunk)
      }
      return true
    } catch (error) {
      // 检查是否是因为中断导致的错误
      if ((error as Error).name === 'AbortError') {
        console.log('请求被中断')
        return false
      }

      console.error('请求失败:', error)
      // 出错时移除刚刚添加的用户消息
      const assistantName = this.assistantManager.getCurrentAssistant()?.name || ''
      const currentHistory = this.chatHistory.get(assistantName)
      if (currentHistory && currentHistory.length > 0) {
        currentHistory.pop()
      }
      return false
    }
  }

  /**
   * 发送消息，合成语音但不调用模型回复（通常是助手消息）
   * @param message 消息内容
   */
  public async sendMessage(message: string): Promise<void> {
    if (this.live2DManager?.disabled) return
    // 打断当前的播放对话和消息
    this.interruptCurrentPlayback()
    // 重置文本缓冲区和累积文本

    this.currentDisplayText = ''

    // 创建 AbortController 用于可能的中断
    this.abortController = new AbortController()

    const response = await fetch(this.apiUrl.value + '/api/gptsovits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        msg: message
      }),
      signal: this.abortController.signal // 添加信号用于中断
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    const ttsMessage = typeof result.message === 'string' ? result.message : ''
    const ttsFile = typeof result.file === 'string' ? result.file : ''

    if (ttsFile) {
      const audioBlob = base64ToBlob(ttsFile, 'audio/wav')
      this.textAudioQueue.push({
        message: ttsMessage,
        audioBlob,
        audioDurationMs: await this.estimateAudioDurationMs(audioBlob),
        appendToDisplayText: true
      })
      this.playAudioQueueWithLive2D()
    } else {
      this.showTempMessage(ttsMessage)
    }
  }

  /**
   * 打断当前的播放对话和消息
   */
  public interruptCurrentPlayback(): void {
    // 1. 停止当前音频播放
    this.stopAudio()

    // 2. 清除消息显示
    this.hideMessage()

    // 3. 重置文本缓冲区和累积文本
    this.currentDisplayText = ''

    this.chunkBuffer = ''

    // 5. 重置播放状态
    this.isPlaying = false

    // 6. 如果有正在进行的请求，取消它
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /**
   * 显示临时消息
   * @param text 消息内容
   * @param timeout 消息显示时间
   * @param priority 消息优先级
   */
  public showTempMessage(
    text: string,
    timeout: number = 5000,
    priority: number = 1,
    transitionDuration: number = 0
  ): void {
    this.messageTips.showMessage(text, timeout, priority, transitionDuration)
  }

  /**
   * 隐藏消息
   */
  public hideMessage(): void {
    this.messageTips.hideMessage()
  }

  /**
   * 停止播放音频
   */
  public stopAudio(): void {
    this.textAudioQueue = []
    this.pendingSentenceSync.clear()
    this.nextSentenceId = null
    this.motionSequenceToken++
    this.live2DManager?.clearMotionFrame()
    this.live2DManager?.stopSpeaking()
  }

  /**
   * 设置音量
   * @param volume 音量值 (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    // 如果有 Live2DManager 实例，也同步设置其音量
    if (this.live2DManager) {
      this.live2DManager.setVolume(volume)
    }
  }

  /**
   * 获取当前音量
   * @returns 当前音量值
   */
  public getVolume(): number {
    return this.volume
  }

  /**
   * 解析流数据
   * @param chunk 流数据
   */
  private parseStreamChunk(chunk: string): void {
    if (!chunk) {
      return
    }

    this.chunkBuffer += chunk

    const lines = this.chunkBuffer.split(/\r?\n/)
    this.chunkBuffer = lines.pop() || ''

    for (const line of lines) {
      this.parseStreamLine(line)
    }
  }

  /**
   * 刷新流缓冲区，处理剩余的未解析数据
   * @returns void
   */
  private flushStreamBuffer(): void {
    const pending = this.chunkBuffer.trim()
    this.chunkBuffer = ''
    if (!pending) {
      return
    }

    this.parseStreamLine(pending)
  }

  /**
   * 解析流数据行
   * @param line 流数据行
   */
  private parseStreamLine(line: string): void {
    const trimmedLine = line.trim()

    // SSE 心跳和空行直接跳过
    if (!trimmedLine || trimmedLine === '[DONE]') {
      return
    }

    if (!trimmedLine.startsWith('data:') && !trimmedLine.startsWith('{')) {
      return
    }

    const jsonStr = trimmedLine.startsWith('data:')
      ? trimmedLine.replace(/^data:\s*/, '')
      : trimmedLine

    try {
      const data = JSON.parse(jsonStr) as StreamChunk
      this.handleStreamChunk(data)
    } catch (error) {
      // 对于异常格式仅记录日志，避免中断后续可解析数据
      console.error('解析数据失败:', error, jsonStr)
    }
  }

  /**
   * 处理流数据块
   * @param data 流数据块
   */
  private handleStreamChunk(data: StreamChunk): void {
    if ('type' in data && typeof data.type === 'string') {
      switch (data.type) {
        case 'text':
          this.handleText(data)
          return
        case 'motion_frame':
          this.handleMotionFrame(data)
          return
        case 'audio':
          this.handleAudio(data)
          return
        case 'done':
          this.handleComplete(data.full_text)
          return
        default:
          return
      }
    }
  }

  /**
   * 处理文本数据块
   * 文本用于兜底展示：当音频为空时，仍可显示当前句子的内容。
   */
  private handleText(data: TextChunk): void {
    const state = this.getSentenceState(data.sentence_id)
    if (data.source_text) {
      state.displayMessage = data.source_text
      if (!state.message) {
        state.message = data.source_text
      }
      this.pendingSentenceSync.set(data.sentence_id, state)
    }
  }

  /**
   * 处理动作帧数据块
   * @param data 动作帧数据块
   */
  private handleMotionFrame(data: MotionFrameChunk): void {
    // 规范化动作帧数据，过滤无效数据，确保参数格式正确，并将持续时间限制在合理范围内
    const motionSequence = this.normalizeMotionFrame(data)

    if (motionSequence.length === 0) return
    // 将动作序列追加到对应 sentence_id 的状态中，等待与音频一起按顺序入队播放
    const state = this.getSentenceState(data.sentence_id)
    if (data.source_text && !state.displayMessage) {
      state.displayMessage = data.source_text
      if (!state.message) {
        state.message = data.source_text
      }
    }
    // 如果同一 sentence_id 收到多条动作帧数据，则将它们的动作序列合并，确保动作能够连续播放
    state.motionSequence = [...(state.motionSequence || []), ...motionSequence]
    // 缓存更新后的状态
    this.pendingSentenceSync.set(data.sentence_id, state)

    this.tryQueueOrderedSentences()
  }

  /**
   * 处理音频数据块
   * @param data 音频数据块
   */
  private async handleAudio(data: AudioChunk): Promise<void> {
    const state = this.getSentenceState(data.sentence_id)
    const hasAudioFile = Boolean(data.file)
    const hasSpokenMessage = Boolean(data.message?.trim())
    const hasSourceText = Boolean(data.source_text?.trim())

    // 台词板显示优先使用 source_text，确保括号内容与原句顺序一致。
    if (hasSourceText) {
      state.displayMessage = data.source_text
    }
    if (hasSpokenMessage) {
      state.message = data.message
      if (!hasSourceText && !state.displayMessage) {
        state.displayMessage = data.message
      }
    }

    if (hasAudioFile) {
      state.audioBlob = base64ToBlob(data.file, 'audio/wav')
      state.audioMissing = false
    } else {
      // file 为空表示该句仅播放动作，不进行语音播放
      state.audioMissing = true
      state.audioBlob = undefined
    }

    this.pendingSentenceSync.set(data.sentence_id, state)
    await this.tryQueueOrderedSentences()
  }

  // 将可播放句子按 sentence_id 严格顺序入队。
  // 有音频且有动作时并行播放并做时长对齐；仅动作时按动作时长播放。
  // 仅音频时正常播放语音；仅文本（audio file 为空且无动作）时按顺序做浮现动画。
  private async tryQueueOrderedSentences(): Promise<void> {
    let hasQueued = false

    while (true) {
      // 解析下一个应出队的 sentence_id，首次以当前缓存中的最小 sentence_id 为起点，之后严格按 +1 前进，确保播放顺序稳定且不受乱序数据影响。
      const sentenceId = this.resolveNextSentenceId()
      if (sentenceId === null) {
        break
      }
      // 检查是否已经进入播放队列
      const state = this.pendingSentenceSync.get(sentenceId)
      if (!state || state.isQueued) {
        break
      }
      // 根据规则检查该句子是否具备入队条件
      const hasMotion = Boolean(state.motionSequence?.length)
      const hasAudio = Boolean(state.audioBlob)
      const displayMessage = state.displayMessage || state.message
      const hasDisplayText = Boolean(displayMessage.trim())

      const canQueue =
        (hasAudio && hasMotion) ||
        (hasMotion && state.audioMissing) ||
        (hasAudio && !this.expectMotionForStream) ||
        // 当服务端明确返回 file 为空时，允许该句以“仅文本”形式入队，避免顺序错位。
        (!hasAudio && !hasMotion && state.audioMissing && hasDisplayText)

      if (!canQueue) {
        break
      }

      state.isQueued = true

      const pair: TextAudioPair = {
        sentenceId,
        message: displayMessage,
        motionSequence: state.motionSequence,
        motionDurationMs: hasMotion ? this.sumMotionDurationMs(state.motionSequence!) : undefined,
        appendToDisplayText: hasDisplayText
      }

      if (state.audioBlob) {
        pair.audioBlob = state.audioBlob
        pair.audioDurationMs = await this.estimateAudioDurationMs(state.audioBlob)
      }
      // 将文本和音频作为一个对存储到音频队列中，确保它们能够同步播放
      this.textAudioQueue.push(pair)
      // 从待同步缓存中移除该句子，避免重复处理
      this.pendingSentenceSync.delete(sentenceId)
      // 更新下一个应出队的 sentence_id，确保下一轮循环能够正确解析下一个句子
      this.nextSentenceId = sentenceId + 1
      // 标记已成功入队
      hasQueued = true
    }
    // 如果有新句子入队，立即尝试播放（使用 Live2D 同步口型），确保响应流畅且动作与语音能够及时同步。
    if (hasQueued) {
      this.playAudioQueueWithLive2D()
    }
  }

  /**
   * 获取或创建句子同步状态。
   */
  private getSentenceState(sentenceId: number): SentenceSyncState {
    const existing = this.pendingSentenceSync.get(sentenceId)
    if (existing) {
      return existing
    }

    return {
      sentenceId,
      displayMessage: '',
      message: '',
      audioMissing: false,
      isQueued: false
    }
  }

  /**
   * 解析下一个应出队的 sentence_id。
   * 首次以当前缓存中的最小 sentence_id 为起点，之后严格按 +1 前进。
   */
  private resolveNextSentenceId(): number | null {
    if (this.pendingSentenceSync.size === 0) {
      return null
    }

    if (this.nextSentenceId === null) {
      const allIds = Array.from(this.pendingSentenceSync.keys())
      this.nextSentenceId = Math.min(...allIds)
    }

    if (this.nextSentenceId === null || !this.pendingSentenceSync.has(this.nextSentenceId)) {
      return null
    }

    return this.nextSentenceId
  }

  /**
   * 计算动作序列总时长（毫秒）。
   */
  private sumMotionDurationMs(sequence: MotionStep[]): number {
    return sequence.reduce((sum, step) => sum + step.durationMs, 0)
  }

  /**
   * 处理完成事件
   */
  private handleComplete(finalText?: string): void {
    void this.flushPendingSentenceStatesOnComplete()

    const textToSave = (finalText || this.currentDisplayText).trim()
    if (textToSave) {
      const assistantName = this.assistantManager.getCurrentAssistant()?.name || ''
      // 确保当前助手有聊天记录数组
      if (!this.chatHistory.has(assistantName)) {
        this.chatHistory.set(assistantName, [])
      }

      const currentHistory = this.chatHistory.get(assistantName)!
      currentHistory.push({
        role: 'assistant',
        content: textToSave
      })

      // 限制聊天历史记录长度为20条
      const trimmedHistory = this.trimChatHistory(currentHistory, 20)
      this.chatHistory.set(assistantName, trimmedHistory)
    }
  }

  private async flushPendingSentenceStatesOnComplete(): Promise<void> {
    if (this.pendingSentenceSync.size === 0) {
      return
    }

    const sentenceIds = Array.from(this.pendingSentenceSync.keys()).sort((a, b) => a - b)
    let hasQueued = false

    for (const sentenceId of sentenceIds) {
      const state = this.pendingSentenceSync.get(sentenceId)
      if (!state || state.isQueued) {
        continue
      }

      const hasMotion = Boolean(state.motionSequence?.length)
      const hasAudio = Boolean(state.audioBlob)
      const displayMessage = state.displayMessage || state.message
      const hasDisplayText = Boolean(displayMessage.trim())

      if (!hasMotion && !hasAudio && !hasDisplayText) {
        this.pendingSentenceSync.delete(sentenceId)
        continue
      }

      const pair: TextAudioPair = {
        sentenceId,
        message: displayMessage,
        motionSequence: state.motionSequence,
        motionDurationMs: hasMotion ? this.sumMotionDurationMs(state.motionSequence!) : undefined,
        appendToDisplayText: hasDisplayText
      }

      if (state.audioBlob) {
        pair.audioBlob = state.audioBlob
        pair.audioDurationMs = await this.estimateAudioDurationMs(state.audioBlob)
      }

      state.isQueued = true
      this.textAudioQueue.push(pair)
      this.pendingSentenceSync.delete(sentenceId)
      hasQueued = true
    }

    if (hasQueued) {
      this.playAudioQueueWithLive2D()
    }
  }

  /**
   * 使用 Live2D 模型播放音频，动作队列（带口型同步）
   */
  private async playAudioQueueWithLive2D(): Promise<void> {
    // 如果正在播放或队列为空，则返回
    if (this.isPlaying || this.textAudioQueue.length === 0) return

    this.isPlaying = true

    try {
      while (this.textAudioQueue.length > 0) {
        const pair = this.textAudioQueue.shift()!
        const hasAudio = Boolean(pair.audioBlob)
        const hasMotion = Boolean(pair.motionSequence?.length)

        if (pair.appendToDisplayText !== false) {
          this.currentDisplayText += pair.message
          const baseDuration = pair.audioDurationMs || pair.motionDurationMs || 900
          const fadeDuration = hasAudio
            ? Math.max(180, Math.min(520, Math.floor(baseDuration * 0.18)))
            : hasMotion
              ? 260
              : 220
          this.showTempMessage(this.currentDisplayText, -1, 999, fadeDuration)
        }

        const token = ++this.motionSequenceToken

        if (hasAudio && pair.audioBlob) {
          const audioArrayBuffer = await pair.audioBlob.arrayBuffer()

          // 使用 Live2DManager 的 speak 方法播放音频并同步口型
          if (this.live2DManager) {
            const audioDurationMs =
              pair.audioDurationMs || (await this.estimateAudioDurationMs(pair.audioBlob))

            if (hasMotion && pair.motionSequence) {
              const speakPromise = this.live2DManager.speak(audioArrayBuffer, this.volume)
              const motionPromise = this.playMotionSequence(
                pair.motionSequence,
                audioDurationMs,
                token
              )
              await Promise.all([speakPromise, motionPromise])
            } else {
              await this.live2DManager.speak(audioArrayBuffer, this.volume)
            }
          } else {
            // 如果 Live2DManager 不可用，降级到普通播放
            const audioUrl = URL.createObjectURL(pair.audioBlob)
            await this.playAudioSimple(audioUrl)
            URL.revokeObjectURL(audioUrl)
          }
        } else if (hasMotion && pair.motionSequence) {
          // 仅动作：严格按动作自身时长播放，且等待动作结束再处理下一句
          const targetDuration =
            pair.motionDurationMs || this.sumMotionDurationMs(pair.motionSequence)
          await this.playMotionSequence(pair.motionSequence, targetDuration, token)
        }
      }
    } catch (error) {
      console.error('播放音频失败:', error)
    } finally {
      this.isPlaying = false
    }
  }

  /**
   * 精确获取音频时长（毫秒）
   * 使用 Web Audio API 解码音频数据获取准确时长
   */
  private async estimateAudioDurationMs(audioBlob: Blob): Promise<number> {
    try {
      const audioContext = new AudioContext()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const duration = audioBuffer.duration * 1000 // 转换为毫秒

      // 清理资源
      await audioContext.close()

      return Math.max(120, duration)
    } catch (error) {
      console.warn('无法精确获取音频时长，使用回退估算方法:', error)
      const audioDataSize = Math.max(0, audioBlob.size - 44)
      // 16bit * 2ch * 44100Hz ~= 176400 bytes/s
      const estimatedDuration = (audioDataSize / 176400) * 1000
      return Math.max(120, estimatedDuration)
    }
  }

  /**
   * 规范化动作帧数据，过滤无效数据，确保参数格式正确，并将持续时间限制在合理范围内
   */
  private normalizeMotionFrame(data: MotionFrameChunk): MotionStep[] {
    const normalized: MotionStep[] = []

    if (Array.isArray(data.motions) && data.motions.length > 0) {
      for (const motion of data.motions) {
        if (!motion || !motion.parameters) continue

        const params: Record<string, number> = {}

        for (const [paramId, rawValue] of Object.entries(motion.parameters)) {
          if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) continue
          params[paramId] = rawValue
        }

        if (Object.keys(params).length === 0) continue

        normalized.push({
          durationMs: this.clampMotionDuration(motion.duration),
          parameters: params
        })
      }

      return normalized
    }

    return normalized
  }

  /**
   * 按顺序应用动作片段，duration 作为每段持续时间
   * @param sequence 动作片段数组
   * @param audioDurationMs 音频总时长（毫秒），用于调整动作节奏
   * @param token 当前动作序列令牌，用于中断过时的序列
   */
  private async playMotionSequence(
    sequence: MotionStep[],
    targetDurationMs: number,
    token: number
  ): Promise<void> {
    // 如果 Live2DManager 不可用或序列为空，直接返回
    if (!this.live2DManager || sequence.length === 0) return
    // 计算动作序列的总时长
    const motionTotalDuration = sequence.reduce((sum, step) => sum + step.durationMs, 0)
    // 根据目标时长与动作总时长计算缩放因子，确保动作可与语音对齐；纯动作时目标时长即动作总时长。
    const scaleFactor = Math.max(0.5, Math.min(2, targetDurationMs / motionTotalDuration))
    // 累积参数，确保每帧都携带完整的参数集，未在当前帧更新的参数将沿用上一帧的值
    let carriedParams: Record<string, number> = {}

    for (let i = 0; i < sequence.length; i++) {
      // 在每帧开始时检查令牌是否仍然有效，如果不匹配则中断序列播放
      const step = sequence[i]
      if (token !== this.motionSequenceToken) return

      const mergedParams = { ...carriedParams, ...step.parameters }
      carriedParams = mergedParams
      // 根据缩放因子调整当前步骤的持续时间,得到缩放后的持续时间
      const scaledDuration = Math.floor(step.durationMs * scaleFactor)
      // 计算过渡时间，确保动作平滑变化
      // 限制在 220-980ms 之间，优先使用持续时间的 88%
      const transitionMs = Math.min(980, Math.max(220, Math.floor(scaledDuration * 0.88)))
      // 计算保持时间，确保动作有足够的时间展示
      const holdMs = scaledDuration + Math.min(220, Math.floor(scaledDuration * 0.24))
      // 应用当前帧的参数，使用 transitionMs 作为过渡时间，holdMs 作为保持时间，确保动作平滑过渡并且在当前帧持续足够长的时间
      this.live2DManager.applyMotionFrame(mergedParams, { transitionMs, holdMs })
      // 计算等待时间，控制动作序列的节奏
      // 统一按当前帧时长等待，确保动作总时长可预测
      const waitMs = Math.max(100, scaledDuration)

      await new Promise((resolve) => window.setTimeout(resolve, waitMs))
    }
    // 序列播放完毕后，如果令牌仍然有效，则恢复模型到默认状态
    if (token === this.motionSequenceToken) {
      this.live2DManager.clearMotionFrame()
    }
  }

  private clampMotionDuration(durationMs?: number): number {
    const defaultDuration = 700
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
      return defaultDuration
    }
    return Math.max(120, Math.min(8000, durationMs))
  }

  /**
   * 简单的音频播放（降级方案）
   */
  private async playAudioSimple(audioUrl: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(audioUrl)

      audio.addEventListener('ended', () => resolve())
      audio.addEventListener('error', (e) => reject(e))

      audio.play().catch(reject)
    })
  }

  /**
   * 裁剪聊天历史，确保聊天历史记录不超过指定数量
   * @param messages 消息数组
   * @param maxLength 最大长度
   * @returns 修剪后的消息数组
   */
  private trimChatHistory(messages: ChatMessage[], maxLength: number): ChatMessage[] {
    if (messages.length > maxLength) {
      return messages.slice(-maxLength)
    }
    return messages
  }

  /**
   * 标准化后端返回的聊天历史数据，过滤非法项并统一角色类型
   */
  private normalizeChatHistory(rawMessages?: ChatHistoryApiResponse['data']): ChatMessage[] {
    if (!Array.isArray(rawMessages)) {
      return []
    }

    return rawMessages
      .filter((item): item is { role: string; content: string } => {
        return Boolean(item && typeof item.content === 'string' && typeof item.role === 'string')
      })
      .map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content
      }))
  }
}

/**
 * 将 Base64 字符串转换为 Blob 对象
 * @param base64 Base64 字符串
 * @param mimeType Blob 对象的 MIME 类型
 * @returns Blob 对象
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  try {
    if (!base64) {
      return new Blob([], { type: mimeType })
    }
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  } catch (error) {
    console.error('Base64解码失败:', error)
    return new Blob([], { type: mimeType })
  }
}

export { ChatService }
export type { ChatMessage }
