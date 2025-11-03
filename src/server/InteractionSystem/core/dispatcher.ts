import { ChatService, TextAndAudioData } from '@/server/ChatService'
import { useConfigStore } from '@/stores/useConfigStore'
import { computed } from 'vue'

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
  // AbortController 用于取消请求
  private abortController: AbortController | null = null

  private apiUrl = computed(() => {
    // 延迟获取 configStore
    const configStore = useConfigStore()
    return `http://${configStore.config.baseUrl}/api/gptsovits`
  })

  constructor() {
    this.chatService = ChatService.getInstance()
  }

  /**
   * 发送动作
   * @param action - 要发送的动作
   */
  send(action: OutputAction) {
    // 添加元数据
    const actionWithMetadata: OutputAction = {
      ...action,
      metadata: {
        timestamp: Date.now(),
        eventType: action.metadata?.eventType,
        source: 'event-system',
        ...action.metadata,
      },
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
  private async executeSend(action: OutputAction) {
    // 这里可以集成实际的发送逻辑，比如：
    // - 发送到聊天窗口
    // - 调用语音合成
    // - 显示通知

    console.log(`[Dispatcher] 发送消息: ${action.text}`)

    // 创建 AbortController 用于可能的中断
    this.abortController = new AbortController()

    const response = await fetch(this.apiUrl.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msg: action.text,
      }),
      signal: this.abortController.signal, // 添加信号用于中断
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      if (!chunk.startsWith('data: ')) return
      const jsonStr = chunk.substring(6)
      console.log('[Dispatcher] 接收到数据:', jsonStr)
      const data: TextAndAudioData = JSON.parse(jsonStr)
      this.chatService.handleTextAndAudio(data)
    }
  }

  /**
   * 添加监听器
   * @param listener
   */
  addListener(listener: (action: OutputAction) => void) {
    this.listeners.push(listener)
  }

  /**
   * 移除监听器
   * @param listener
   */
  removeListener(listener: (action: OutputAction) => void) {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * 通知所有监听器
   * @param action
   */
  private notifyListeners(action: OutputAction) {
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
