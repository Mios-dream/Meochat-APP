import { MessageTips } from '../services/MessageTips'
import { Live2DManager } from './Live2dManager'
import { useConfigStore } from '../stores/useConfigStore'
import { computed } from 'vue'
import { AssistantManager } from './assistantManager'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
// 文本和音频的组合数据
interface TextAndAudioData {
  message: string
  file: string
  done?: boolean
}
// 文本chunk
interface TextChunk {
  type: 'text'
  sentence_id: number
  message: string
  done?: boolean
}
// 动作帧chunk
interface MotionFrameChunk {
  type: 'motion_frame'
  sentence_id: number
  source_text?: string
  action_label?: string
  parameters: Record<string, number>
  done?: boolean
}
// 音频chunk
interface AudioChunk {
  type: 'audio'
  sentence_id: number
  message: string
  file: string
  done?: boolean
}
// 完成标志chunk
interface DoneChunk {
  type: 'done'
  full_text?: string
  done: true
}

type StreamChunk = TextAndAudioData | TextChunk | MotionFrameChunk | AudioChunk | DoneChunk

interface TextAudioPair {
  message: string
  audioBlob: Blob
  appendToDisplayText?: boolean
}

/**
 * 在指定长度后的下一个标点处切分文本，用于获取显示在消息提示中的文本尾部，确保不会切断重要信息，同时保持显示的文本具有完整的语义。
 * @param text 要切分的文本
 * @param maxLength 最大长度阈值
 * @returns 切分后的文本
 */
function truncateAtPunctuationForward(text: string, maxLength: number): string {
  // 定义中文和英文标点符号
  const punctuation = /[，。！？；：,.!?;:]/

  // 如果文本长度不超过阈值，直接返回
  if (text.length <= maxLength) {
    return text
  }

  // 从阈值位置开始向前查找标点符号
  let truncateIndex = text.length // 默认截断到文本末尾

  // 向前查找标点符号
  for (let i = maxLength; i >= 0; i--) {
    if (punctuation.test(text[i])) {
      truncateIndex = i + 1 // 包含标点符号本身
      break
    }
  }

  // 获取截断后的文本
  const truncatedText = text.substring(truncateIndex)

  // 递归检查截断后的文本是否仍然超过指定长度，如果超过则继续截断
  if (truncatedText.length > maxLength) {
    return truncateAtPunctuationForward(truncatedText, maxLength)
  }

  return truncatedText
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

class ChatService {
  private static instance: ChatService
  // 消息提示对象
  private messageTips: MessageTips
  // 聊天记录, 键为助手名称
  private chatHistory: Map<string, ChatMessage[]> = new Map()
  // 文本和音频的组合队列
  private textAudioQueue: TextAudioPair[] = []
  // 传输缓冲区，防止音频过长导致的chunk分割，json解析失败的问题
  private chunkBuffer: string = ''
  // 隐藏消息定时器
  private hideMessageTimer: NodeJS.Timeout | null = null
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

  // 文本显示定时器
  private textDisplayTimer: NodeJS.Timeout | null = null
  // 助手管理器
  private assistantManager: AssistantManager

  private constructor() {
    // 初始化助手管理器
    this.assistantManager = AssistantManager.getInstance()
    // 初始化消息提示对象
    this.messageTips = new MessageTips()
    // 获取 Live2DManager 实例
    this.live2DManager = Live2DManager.getInstance()
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
   * 发送消息
   * @param message 消息内容
   * @returns Promise<boolean> 是否成功发送
   */
  public async chat(message: string): Promise<boolean> {
    if (!message || !message.trim()) {
      return false
    }
    // 停止正在播放的对话和消息
    this.interruptCurrentPlayback()

    // 重置
    this.currentDisplayText = ''
    this.textAudioQueue = []
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

    this.handleTextAndAudio({ message: result.message, file: result.file })
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

    // 4. 清除隐藏消息定时器
    this.clearHideMessageTimer()

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
    this.clearHideMessageTimer()
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
    this.handleTextAndAudio(data)
  }

  /**
   * 处理文本数据块
   * @param _data 文本数据块
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleText(_data: TextChunk): void {
    // this.currentDisplayText = data.message || ''
    // const tipText = this.getTailDisplayText(this.currentDisplayText)
    // if (tipText) {
    //   this.showTempMessage(tipText, -1, 999, 0)
    //   this.clearHideMessageTimer()
    // }
  }

  /**
   * 处理动作帧数据块
   * @param data 动作帧数据块
   */
  private handleMotionFrame(data: MotionFrameChunk): void {
    if (!data.parameters || !this.live2DManager) return
    this.live2DManager.applyMotionFrame(data.parameters)
  }

  /**
   * 处理音频数据块
   * @param data 音频数据块
   */
  private handleAudio(data: AudioChunk): void {
    if (!data.file) return
    const audioBlob = base64ToBlob(data.file, 'audio/wav')
    this.textAudioQueue.push({
      message: data.message,
      audioBlob,
      appendToDisplayText: true
    })
    this.playAudioQueueWithLive2D()
    this.clearHideMessageTimer()
  }

  private handleTextAndAudio(data: TextAndAudioData): void {
    // 处理音频数据
    if (data.file) {
      const audioBlob = base64ToBlob(data.file, 'audio/wav')
      // 将文本和音频作为一个对存储到音频队列中
      this.textAudioQueue.push({
        message: data.message,
        audioBlob: audioBlob,
        appendToDisplayText: true
      })
      // 立即尝试播放（使用 Live2D 同步口型）
      this.playAudioQueueWithLive2D()
    } else {
      this.showTempMessage(data.message)
    }
    this.clearHideMessageTimer()
  }

  /**
   * 处理完成事件
   */
  private handleComplete(finalText?: string): void {
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

  /**
   * 清除隐藏消息的定时器
   */
  private clearHideMessageTimer(): void {
    if (this.hideMessageTimer) {
      clearTimeout(this.hideMessageTimer)
      this.hideMessageTimer = null
    }
  }

  /**
   * 使用 Live2D 模型播放音频队列（带口型同步）
   */
  private async playAudioQueueWithLive2D(): Promise<void> {
    // 如果正在播放或队列为空，则返回
    if (this.isPlaying || this.textAudioQueue.length === 0) return

    this.isPlaying = true

    try {
      while (this.textAudioQueue.length > 0) {
        const pair = this.textAudioQueue.shift()!
        const audioUrl = URL.createObjectURL(pair.audioBlob)

        if (pair.appendToDisplayText !== false) {
          this.currentDisplayText += pair.message

          this.displayTextGradually(pair.message, pair.audioBlob)
        }

        try {
          // 使用 Live2DManager 的 speak 方法播放音频并同步口型
          if (this.live2DManager) {
            // 将Blob转换为AudioBuffer
            const audioArrayBuffer = await pair.audioBlob.arrayBuffer()
            await this.live2DManager.speak(audioArrayBuffer, this.volume)
          } else {
            // 如果 Live2DManager 不可用，降级到普通播放
            await this.playAudioSimple(audioUrl)
          }
        } finally {
          // 清理 URL 对象
          URL.revokeObjectURL(audioUrl)
        }
      }

      // 音频播放完毕后，设置3秒延迟隐藏消息,恢复模型到默认状态
      this.clearHideMessageTimer()
      this.hideMessageTimer = setTimeout(() => {
        this.messageTips.hideMessage()
        this.hideMessageTimer = null
        this.live2DManager?.clearMotionFrame()
      }, 5000)
    } catch (error) {
      // 音频播放完毕后，设置3秒延迟隐藏消息,恢复模型到默认状态
      this.clearHideMessageTimer()
      this.hideMessageTimer = setTimeout(() => {
        this.messageTips.hideMessage()
        this.hideMessageTimer = null
        this.live2DManager?.clearMotionFrame()
      }, 5000)
      console.error('播放音频失败:', error)
    } finally {
      this.isPlaying = false
    }
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
   * 逐渐显示文本
   * @param text 要显示的文本
   * @param audioBlob 音频Blob用于计算显示速度
   */
  private displayTextGradually(text: string, audioBlob: Blob): void {
    // 清除之前的定时器
    if (this.textDisplayTimer) {
      clearTimeout(this.textDisplayTimer)
      this.textDisplayTimer = null
    }

    // 估算音频时长（假设是WAV格式，我们可以通过Blob大小估算时长）
    // WAV文件头是44字节，剩下的就是音频数据
    // 假设是16位立体声44.1kHz音频：每秒约176400字节
    const estimatedDuration = ((audioBlob.size - 44) / 176400) * 1000 // 转换为毫秒

    // 确保最小持续时间为100ms，最大为文本长度*100ms
    const duration = Math.max(100, estimatedDuration, text.length * 70)
    const textLength = text.length
    const interval = duration / textLength // 每个字符的显示间隔

    let displayText: string
    // 使用改进的字符切分算法，超过长度后向后寻找标点
    const maxLength = 150
    if (this.currentDisplayText.length > maxLength) {
      displayText = truncateAtPunctuationForward(this.currentDisplayText, maxLength)
    } else {
      displayText = this.currentDisplayText
    }

    // 显示当前文本段的字符
    let currentIndex = 0
    const displayNextChar = (): void => {
      if (currentIndex < textLength) {
        this.showTempMessage(
          displayText.substring(0, displayText.length - textLength + currentIndex + 1).trim(),
          -1,
          999,
          0
        )
        currentIndex++
        this.textDisplayTimer = setTimeout(displayNextChar, interval)
      }
    }

    displayNextChar()
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
}

export { ChatService }
export type { ChatMessage, TextAndAudioData }
