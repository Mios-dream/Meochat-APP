import { MessageTips } from '../server/MessageTips'
import { Live2DManager } from './Live2dManager'
import { useConfigStore } from '../stores/useConfigStore'
import { computed } from 'vue'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface TextAndAudioData {
  text: string
  audio: string
  done?: boolean
}

interface TextAudioPair {
  text: string
  audioBlob: Blob
}

class ChatService {
  private static instance: ChatService
  // 消息提示对象
  private messageTips: MessageTips
  // 聊天记录
  private chatHistory: ChatMessage[] = []
  // 文本和音频的组合队列
  private textAudioQueue: TextAudioPair[] = []
  // 文本缓冲区
  private textBuffer: string = ''
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

  private constructor() {
    // 初始化消息提示对象
    this.messageTips = new MessageTips()
    // 获取 Live2DManager 实例
    this.live2DManager = Live2DManager.getInstance()
    // 初始化聊天记录
    this.initializeChatHistory()
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
   * 初始化聊天记录
   */
  private initializeChatHistory(): void {
    this.chatHistory = []
  }

  /**
   * 获取聊天记录
   * @returns ChatMessage[] 聊天记录
   */
  public getChatHistory(): ChatMessage[] {
    return this.chatHistory
  }

  /**
   * 清空聊天记录
   */
  public clearChatHistory(): void {
    this.chatHistory = []
    this.initializeChatHistory()
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
    this.textBuffer = ''

    try {
      this.chatHistory.push({ role: 'user', content: message })

      // 创建 AbortController 用于可能的中断
      this.abortController = new AbortController()

      const response = await fetch(this.apiUrl.value + '/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          msg: this.chatHistory
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
          if (this.textBuffer.trim()) {
            this.parseStreamChunk(this.textBuffer)
          }
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        this.processStreamData(chunk)
      }
      return true
    } catch (error) {
      // 检查是否是因为中断导致的错误
      if ((error as Error).name === 'AbortError') {
        console.log('请求被中断')
        return false
      }

      console.error('请求失败:', error)
      this.messageTips.showMessage('发送消息失败，请稍后重试', 3000, 1)
      this.chatHistory.pop()
      return false
    }
  }

  /**
   * 发送消息，合成语音但不调用模型回复（通常是助手消息）
   * @param message 消息内容
   */
  public async sendMessage(message: string): Promise<void> {
    // 重置文本缓冲区和累积文本
    this.textBuffer = ''
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

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    // 添加文本缓冲区来处理不完整的数据行
    let textBuffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        // 处理缓冲区中剩余的数据
        if (textBuffer.trim()) {
          this.processStreamData(textBuffer)
        }
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      textBuffer += chunk

      // 按行分割处理数据
      const lines = textBuffer.split('\n')
      textBuffer = lines.pop() || '' // 保留最后一个不完整的行

      for (const line of lines) {
        if (line.trim()) {
          this.processStreamData(line.trim())
        }
      }
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
    this.textBuffer = ''
    this.currentDisplayText = ''

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
   * 处理流数据
   * @param chunk 流数据
   */
  private processStreamData(chunk: string): void {
    this.textBuffer += chunk
    const lines = this.textBuffer.split('\n')
    this.textBuffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        this.parseStreamChunk(line.trim())
      }
    }
  }

  /**
   * 解析流数据
   * @param chunk 流数据
   */
  private parseStreamChunk(chunk: string): void {
    if (!chunk.startsWith('data: ')) return

    try {
      const jsonStr = chunk.substring(6)
      const data: TextAndAudioData = JSON.parse(jsonStr)
      if (data.done === true) {
        this.handleComplete()
      } else {
        this.handleTextAndAudio(data)
      }
    } catch (error) {
      console.error('解析数据失败:', error, chunk)
    }
  }

  public handleTextAndAudio(data: TextAndAudioData): void {
    // 处理音频数据
    const audioBlob = this.base64ToBlob(data.audio, 'audio/wav')
    if (audioBlob.size > 0) {
      // 将文本和音频作为一个对存储到音频队列中
      this.textAudioQueue.push({
        text: data.text,
        audioBlob: audioBlob
      })
      // 立即尝试播放（使用 Live2D 同步口型）
      this.playAudioQueueWithLive2D()
    }
    this.clearHideMessageTimer()
  }

  /**
   * 处理完成事件
   */
  private handleComplete(): void {
    if (this.currentDisplayText.trim()) {
      this.chatHistory.push({
        role: 'assistant',
        content: this.currentDisplayText.trim()
      })
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
   * 将 Base64 字符串转换为 Blob 对象
   * @param base64 Base64 字符串
   * @param mimeType Blob 对象的 MIME 类型
   * @returns Blob 对象
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    try {
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
    const duration = Math.max(100, estimatedDuration, text.length * 100)
    const textLength = text.length
    const interval = duration / textLength // 每个字符的显示间隔

    // 显示当前文本段的字符
    let currentIndex = 0
    const displayNextChar = (): void => {
      if (currentIndex < textLength) {
        this.showTempMessage(
          this.currentDisplayText
            .substring(0, this.currentDisplayText.length - textLength + currentIndex + 1)
            .trim(),
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
        // 显示对应文本
        this.currentDisplayText += pair.text

        this.displayTextGradually(pair.text, pair.audioBlob)

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

      // 音频播放完毕后，设置3秒延迟隐藏消息
      this.clearHideMessageTimer()
      this.hideMessageTimer = setTimeout(() => {
        this.messageTips.hideMessage()
        this.hideMessageTimer = null
      }, 5000)
    } catch (error) {
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
}

export { ChatService }
export type { ChatMessage, TextAndAudioData }
