import { MessageTips } from './MessageTips'
import { Live2DManager } from './Live2dManager'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface StreamData {
  type: 'text' | 'audio' | 'complete'
  data: string
}

class ChatService {
  private static instance: ChatService
  private messageTips: MessageTips
  private chatHistory: ChatMessage[] = []
  private audioQueue: Blob[] = []
  private accumulatedText: string = ''
  private textBuffer: string = ''
  private hideMessageTimer: number | null = null
  private isPlaying: boolean = false
  private apiUrl: string = 'http://127.0.0.1:8001/api/chat_v2'
  private live2DManager: Live2DManager | null = null

  private constructor() {
    this.messageTips = new MessageTips()
    this.initializeChatHistory()
    // 获取 Live2DManager 实例
    this.live2DManager = Live2DManager.getInstance()
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService()
    }
    return ChatService.instance
  }

  public initializeMessageTips(element: HTMLElement): void {
    this.messageTips.setTipsElement(element)
  }

  private initializeChatHistory(): void {
    this.chatHistory = []
  }

  public setApiUrl(url: string): void {
    this.apiUrl = url
  }

  public getChatHistory(): ChatMessage[] {
    return this.chatHistory
  }

  public clearChatHistory(): void {
    this.chatHistory = []
    this.initializeChatHistory()
  }

  public async sendMessage(message: string): Promise<boolean> {
    if (!message.trim()) return

    this.accumulatedText = ''
    this.audioQueue = []
    this.textBuffer = ''

    try {
      this.chatHistory.push({ role: 'user', content: message })

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msg: this.chatHistory,
        }),
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
      console.error('请求失败:', error)
      this.messageTips.showMessage('发送消息失败，请稍后重试', 3000, 1)
      this.chatHistory.pop()
      return false
    }
  }

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

  private parseStreamChunk(chunk: string): void {
    if (!chunk.startsWith('data: ')) return

    try {
      const jsonStr = chunk.substring(6)
      const data: StreamData = JSON.parse(jsonStr)

      if (data.type === 'text') {
        this.handleTextData(data.data)
      } else if (data.type === 'audio') {
        this.handleAudioData(data.data)
      } else if (data.type === 'complete') {
        this.handleComplete()
      }
    } catch (error) {
      console.error('解析数据失败:', error, chunk)
    }
  }

  private handleTextData(text: string): void {
    this.accumulatedText += text
    this.showTempMessage(this.accumulatedText.trim(), -1, 999)
    this.clearHideMessageTimer()
  }

  private handleAudioData(audioData: string): void {
    const audioBlob = this.base64ToBlob(audioData, 'audio/wav')
    if (audioBlob.size > 0) {
      this.audioQueue.push(audioBlob)
      // 立即尝试播放（使用 Live2D 同步口型）
      this.playAudioQueueWithLive2D()
    }
    this.clearHideMessageTimer()
  }

  private handleComplete(): void {
    if (this.accumulatedText.trim()) {
      this.chatHistory.push({
        role: 'assistant',
        content: this.accumulatedText.trim(),
      })
    }
  }

  private clearHideMessageTimer(): void {
    if (this.hideMessageTimer) {
      clearTimeout(this.hideMessageTimer)
      this.hideMessageTimer = null
    }
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    try {
      const cleanBase64 = base64.replace(/\s/g, '')
      const standardBase64 = cleanBase64
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(cleanBase64.length + ((4 - (cleanBase64.length % 4)) % 4), '=')

      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(standardBase64)) {
        throw new Error('Invalid base64 format')
      }

      const byteCharacters = atob(standardBase64)
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
   * 使用 Live2D 模型播放音频队列（带口型同步）
   */
  private async playAudioQueueWithLive2D(): Promise<void> {
    // 如果正在播放或队列为空，则返回
    if (this.isPlaying || this.audioQueue.length === 0) return

    this.isPlaying = true

    try {
      while (this.audioQueue.length > 0) {
        const audioBlob = this.audioQueue.shift()
        const audioUrl = URL.createObjectURL(audioBlob)

        try {
          // 使用 Live2DManager 的 speak 方法播放音频并同步口型
          if (this.live2DManager) {
            await this.live2DManager.speak(audioUrl)
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

  public showTempMessage(text: string, timeout: number = 5000, priority: number = 1): void {
    this.messageTips.showMessage(text, timeout, priority)
  }

  public hideMessage(): void {
    this.messageTips.hideMessage()
  }

  public stopAudio(): void {
    this.audioQueue = []
    this.clearHideMessageTimer()
  }
}

export { ChatService, ChatMessage }
