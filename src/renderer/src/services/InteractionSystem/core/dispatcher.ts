import { ChatService } from '@renderer/services/ChatService'

export interface OutputAction {
  // 文本数据
  text: string
  // 动作数据
  action?: string
  // 元数据
  metadata?: {
    timestamp: number
    eventType?: string
    source?: string
  }
}

export class ActionDispatcher {
  private listeners: Array<(action: OutputAction) => void> = []
  private chatService: ChatService
  private lastSentText = ''
  private lastSentAt = 0
  private sendQueue: Promise<void> = Promise.resolve()

  constructor() {
    this.chatService = ChatService.getInstance()
  }

  /**
   * 发送动作
   * @param action - 要发送的动作
   */
  send(action: OutputAction): void {
    const normalizedText = (action.text || '').trim()
    const now = Date.now()
    if (normalizedText && normalizedText === this.lastSentText && now - this.lastSentAt < 3000) {
      return
    }

    // 添加元数据
    const actionWithMetadata: OutputAction = {
      ...action,
      metadata: {
        timestamp: Date.now(),
        eventType: action.metadata?.eventType,
        source: 'event-system',
        ...action.metadata
      }
    }

    this.lastSentText = normalizedText
    this.lastSentAt = now

    // 串行执行发送，确保当前回复完整结束后再发送下一条。
    this.sendQueue = this.sendQueue
      .then(() => this.executeSend(actionWithMetadata))
      .catch((error) => {
        console.error('事件发送失败:', error)
      })

    // 通知所有监听器
    this.notifyListeners(actionWithMetadata)
  }

  /**
   * 执行实际的发送逻辑
   * @param action
   */
  private async executeSend(action: OutputAction): Promise<void> {
    // console.log('执行发送:', action)
    await this.chatService.sendMessage(action.text)
    await this.chatService.waitForReplyPlaybackComplete()
  }

  /**
   * 添加监听器
   * @param listener
   */
  addListener(listener: (action: OutputAction) => void): void {
    this.listeners.push(listener)
  }

  /**
   * 移除监听器
   * @param listener
   */
  removeListener(listener: (action: OutputAction) => void): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * 通知所有监听器
   * @param action
   */
  private notifyListeners(action: OutputAction): void {
    this.listeners.forEach((listener) => {
      try {
        listener(action)
      } catch (error) {
        console.error('监听器执行失败:', error)
      }
    })
  }

  /**
   * 获取监听器数量
   */
  getListenerCount(): number {
    return this.listeners.length
  }
}
