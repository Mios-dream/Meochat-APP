import { ChatService } from '@renderer/server/ChatService'

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

  constructor() {
    this.chatService = ChatService.getInstance()
  }

  /**
   * 发送动作
   * @param action - 要发送的动作
   */
  send(action: OutputAction): void {
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

    // 调用具体的发送逻辑
    this.executeSend(actionWithMetadata)

    // 通知所有监听器
    this.notifyListeners(actionWithMetadata)
  }

  /**
   * 执行实际的发送逻辑
   * @param action
   */
  private async executeSend(action: OutputAction): Promise<void> {
    this.chatService.sendMessage(action.text)
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
