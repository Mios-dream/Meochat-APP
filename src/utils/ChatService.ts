import { MessageTips } from './MessageTips'

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

  private constructor() {
    this.messageTips = new MessageTips()
    this.initializeChatHistory()
  }

  // 单例模式
  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService()
    }

    return ChatService.instance
  }

  public initializeMessageTips(element: HTMLElement): void {
    this.messageTips.setTipsElement(element)
  }
  // 初始化聊天历史
  private initializeChatHistory(): void {
    this.chatHistory = [
      { role: 'user', content: '你好啊！' },
      { role: 'assistant', content: '你好啊！有什么能帮到你的吗？' },
    ]
  }

  // 设置 API 地址
  public setApiUrl(url: string): void {
    this.apiUrl = url
  }

  // 获取聊天历史
  public getChatHistory(): ChatMessage[] {
    return [...this.chatHistory]
  }

  // 清空聊天历史
  public clearChatHistory(): void {
    this.chatHistory = []
    this.initializeChatHistory()
  }

  // 发送聊天消息
  public async sendMessage(message: string): Promise<void> {
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
          // 处理剩余的缓冲区数据
          if (this.textBuffer.trim()) {
            this.parseStreamChunk(this.textBuffer)
          }
          break
        }

        // 解析流式数据
        const chunk = decoder.decode(value, { stream: true })
        this.processStreamData(chunk)
      }
    } catch (error) {
      console.error('请求失败:', error)
      this.messageTips.showMessage('发送消息失败，请稍后重试', 3000, 1)
      // 移除失败的用户消息
      this.chatHistory.pop()
      throw error
    }
  }

  // 处理流式数据
  private processStreamData(chunk: string): void {
    // 将新数据添加到缓冲区
    this.textBuffer += chunk

    // 查找完整的 data: 行
    const lines = this.textBuffer.split('\n')

    // 保留最后一行（可能不完整）
    this.textBuffer = lines.pop() || ''

    // 处理完整的行
    for (const line of lines) {
      if (line.trim()) {
        this.parseStreamChunk(line.trim())
      }
    }
  }

  // 解析流式数据块
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

  // 处理文本数据
  private handleTextData(text: string): void {
    this.accumulatedText += text
    this.showTempMessage(this.accumulatedText.trim(), -1, 999)

    // 有新文本时清除隐藏消息的定时器
    this.clearHideMessageTimer()
  }

  // 处理音频数据
  private handleAudioData(audioData: string): void {
    const audioBlob = this.base64ToBlob(audioData, 'audio/wav')
    if (audioBlob.size > 0) {
      this.audioQueue.push(audioBlob)
      // 立即尝试播放
      this.playAudioQueue()
    }

    // 有新音频时清除隐藏消息的定时器
    this.clearHideMessageTimer()
  }

  // 处理完成信号
  private handleComplete(): void {
    if (this.accumulatedText.trim()) {
      this.chatHistory.push({
        role: 'assistant',
        content: this.accumulatedText.trim(),
      })
    }
  }

  // 清除隐藏消息的定时器
  private clearHideMessageTimer(): void {
    if (this.hideMessageTimer) {
      clearTimeout(this.hideMessageTimer)
      this.hideMessageTimer = null
    }
  }

  // Base64 转 Blob
  private base64ToBlob(base64: string, mimeType: string): Blob {
    try {
      // 清理base64字符串
      const cleanBase64 = base64.replace(/\s/g, '')

      // 将URL-safe Base64转换为标准Base64
      const standardBase64 = cleanBase64
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(cleanBase64.length + ((4 - (cleanBase64.length % 4)) % 4), '=')

      // 验证base64格式
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(standardBase64)) {
        throw new Error('Invalid base64 format')
      }

      // 解码 Base64字符串
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

  // 播放音频队列
  private async playAudioQueue(): Promise<void> {
    // 如果正在播放或者队列为空，则返回
    if (this.isPlaying || this.audioQueue.length === 0) return

    this.isPlaying = true

    try {
      while (this.audioQueue.length > 0) {
        // 取出队列中的第一个音频片段
        const audioBlob = this.audioQueue.shift()!
        const audioUrl = URL.createObjectURL(audioBlob)

        // 创建音频对象并播放
        const audio = new Audio(audioUrl)

        // 等待音频播放完成
        await new Promise<void>((resolve, reject) => {
          audio.addEventListener('ended', () => {
            URL.revokeObjectURL(audioUrl)
            resolve()
          })

          audio.addEventListener('error', (e) => {
            URL.revokeObjectURL(audioUrl)
            reject(e)
          })

          audio.play().catch(reject)
        })
      }

      // 音频播放完毕后，设置3秒延迟隐藏消息
      this.clearHideMessageTimer()
      this.hideMessageTimer = setTimeout(() => {
        this.messageTips.hideMessage()
        this.hideMessageTimer = null
      }, 3000)
    } catch (error) {
      console.error('播放音频失败:', error)
    } finally {
      this.isPlaying = false
    }
  }

  public showTempMessage(text: string, timeout: number = 5000, priority: number = 1): void {
    if (this.messageTips.tipsElement) {
      this.messageTips.showMessage(text, timeout, priority)
    } else {
      if (window.chatBoxAPI.ipcRenderer) {
        console.log('发送消息给到主线程', { text, timeout, priority })
        window.chatBoxAPI.ipcRenderer.send('show-assistant-message', { text, timeout, priority })
      } else {
        console.error('chatBoxAPI.ipcRenderer is not defined')
      }
    }
  }

  // 隐藏消息
  public hideMessage(): void {
    this.messageTips.hideMessage()
  }

  // 停止所有音频播放
  public stopAudio(): void {
    this.audioQueue = []
    this.clearHideMessageTimer()
  }
}

export { ChatService, ChatMessage }
