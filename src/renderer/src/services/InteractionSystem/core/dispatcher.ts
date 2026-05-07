import { ChatService, InteractionEventPayload } from '@renderer/services/ChatService'

export interface OutputAction {
  text: string
  action?: string
  eventPayload?: InteractionEventPayload
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

    this.sendQueue = this.sendQueue
      .then(() => this.executeSend(actionWithMetadata))
      .catch((error) => {
        console.error('事件发送失败:', error)
      })

    this.notifyListeners(actionWithMetadata)
  }

  /**
   * 执行实际的发送逻辑
   * 有新接口载荷时走完整 SSE 管线（文本+动作+语音+历史记录）
   */
  private async executeSend(action: OutputAction): Promise<void> {
    if (action.eventPayload) {
      await this.chatService.interactionChat(action.eventPayload)
    } else {
      await this.chatService.sendMessage(action.text)
    }
    await this.chatService.waitForReplyPlaybackComplete()
  }

  addListener(listener: (action: OutputAction) => void): void {
    this.listeners.push(listener)
  }

  removeListener(listener: (action: OutputAction) => void): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  private notifyListeners(action: OutputAction): void {
    this.listeners.forEach((listener) => {
      try {
        listener(action)
      } catch (error) {
        console.error('监听器执行失败:', error)
      }
    })
  }

  getListenerCount(): number {
    return this.listeners.length
  }

  /**
   * 等待 sendQueue 中所有任务完成
   */
  async waitForDrain(): Promise<void> {
    await this.sendQueue
  }
}
