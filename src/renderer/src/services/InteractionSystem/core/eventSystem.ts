// core/eventSystem.ts
import { EventCenter } from './eventCenter'
import { ActionDispatcher } from './dispatcher'
import { IEventHandler } from '../types/IEventHandler'
import { ContextManager, Context } from './context'
import { ChatService } from '@renderer/services/ChatService'
import { useConfigStore } from '@renderer/stores/useConfigStore'

// 事件系统管理器
export class EventSystem {
  // 注册的事件处理器映射
  private handlers: Map<string, IEventHandler> = new Map()
  // 上一次触发的时间
  private lastDispatchAt: number = 0
  // 上一次触发的事件类型
  private lastDispatchByType: Map<string, number> = new Map()
  private chatService: ChatService

  constructor(
    private eventCenter: EventCenter,
    private contextManager: ContextManager,
    private dispatcher: ActionDispatcher
  ) {
    this.chatService = ChatService.getInstance()
  }

  /**
   * 注册事件处理器
   * @param handler 事件处理器实例
   */
  registerHandler(handler: IEventHandler): void {
    // 设置处理器映射，设置事件类型，回调
    this.handlers.set(handler.eventType, handler)

    // 自动注册该类型的所有事件
    this.setupEventListeners(handler.eventType)
  }

  /**
   * 设置事件监听器
   * @param eventType 事件类型
   */
  private setupEventListeners(eventType: string): void {
    // 使用通配符监听特定类型的事件
    this.eventCenter.on(`${eventType}.*`, (event: string, context?: Partial<Context>) => {
      if (context) {
        this.contextManager.update(context)
      }

      if (!this.shouldDispatchEvent(event)) {
        return
      }

      // 调用具体的事件处理函数
      const handler = this.handlers.get(eventType)
      if (handler) {
        this.contextManager.update({
          isInConversation: false,
          lastEventTime: Date.now(),
          lastEventType: event
        })
        handler.handle(event, this.contextManager, this.dispatcher)
      }
    })
  }

  /**
   * 判断是否应该触发事件，避免过于频繁地触发事件导致回复过多
   * @param event 事件名称
   * @returns
   */
  private shouldDispatchEvent(event: string): boolean {
    // 某些事件被动触发，不受冷却限制
    const passiveEvents = new Set(['mouse.idle', 'mouse.busy', 'system.battery-level'])
    if (passiveEvents.has(event)) {
      return false
    }
    // 如果正在对话中，暂不触发事件
    const isInConversation = this.chatService.getReplyStatus()
    this.contextManager.update({ isInConversation })

    // 正常对话播放期间，不触发交互事件
    if (isInConversation) {
      return false
    }
    // 从配置中获取全局冷却时间，默认8000ms，某些事件类型可能有不同的冷却时间
    const configStore = useConfigStore()
    const globalCooldown = Math.max(500, Number(configStore.config.autoEventCooldownMs || 8000))
    const now = Date.now()

    if (now - this.lastDispatchAt < globalCooldown) {
      return false
    }

    const eventType = event.split('.')[0] || event
    const typeCooldown = this.getTypeCooldownMs(eventType, globalCooldown)
    const lastTypeDispatchAt = this.lastDispatchByType.get(eventType) || 0

    if (now - lastTypeDispatchAt < typeCooldown) {
      return false
    }

    this.lastDispatchAt = now
    this.lastDispatchByType.set(eventType, now)
    return true
  }

  /**
   * 根据事件类型获取冷却时间，某些事件类型可能需要更长或更短的冷却时间
   * @param eventType 事件类型
   * @param defaultCooldownMs 默认冷却时间
   * @returns
   */
  private getTypeCooldownMs(eventType: string, defaultCooldownMs: number): number {
    if (eventType === 'system') {
      return 5000
    }

    if (eventType === 'live2d') {
      return Math.max(1500, Math.floor(defaultCooldownMs / 2))
    }

    return defaultCooldownMs
  }

  // 注册调试事件
  registerDebugEvents(): void {
    this.eventCenter.on('*', (e) => console.log('捕获事件', e))
  }
}
