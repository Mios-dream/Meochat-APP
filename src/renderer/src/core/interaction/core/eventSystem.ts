import { EventCenter } from './eventCenter'
import { ActionDispatcher } from './dispatcher'
import { IEventHandler } from '../types/IEventHandler'
import { ContextManager, Context } from './context'
import { ChatManager } from '@renderer/chat/ChatManager'

export class EventSystem {
  // 事件处理器实例
  private handlers: Map<string, IEventHandler> = new Map()
  private lastDispatchByType: Map<string, number> = new Map()
  private chatService: ChatManager
  // 正在分发事件时，忽略新的事件触发，避免重复分发和状态更新冲突
  private isDispatching = false

  constructor(
    private eventCenter: EventCenter,
    private contextManager: ContextManager,
    private dispatcher: ActionDispatcher
  ) {
    this.chatService = ChatManager.getInstance()
  }

  /**
   * 注册事件处理器：保存实例并设置事件监听器
   * @param handler 事件处理器实例
   */
  registerHandler(handler: IEventHandler): void {
    this.handlers.set(handler.eventType, handler)
    this.setupEventListeners(handler.eventType)
  }

  /**
   * 安装事件监听器：监听特定事件类型，触发时更新上下文并处理事件
   * @param eventType 事件类型（如 "mouse", "app"），监听该类型的所有事件（如 "mouse.idle", "app.focus"）
   */
  private setupEventListeners(eventType: string): void {
    this.eventCenter.on(`${eventType}.*`, (event: string, context?: Partial<Context>) => {
      if (context) {
        this.contextManager.update(context)
      }

      this.handleIncomingEvent(event)
    })
  }

  /**
   * 处理传入事件：执行中忽略，对话中忽略，否则检查冷却后直接分发
   * @param event 完整事件字符串（如 "mouse.idle"），根据类型检查冷却并分发事件
   */
  private handleIncomingEvent(event: string): void {
    const passiveEvents = new Set(['mouse.idle', 'mouse.busy', 'system.battery-level'])
    if (passiveEvents.has(event)) {
      return
    }

    if (this.isDispatching) {
      return
    }

    const isInConversation = this.chatService.getReplyStatus()
    this.contextManager.update({ isInConversation })

    if (isInConversation) {
      return
    }

    const eventType = event.split('.')[0] || event
    if (!this.checkCooldown(eventType)) {
      return
    }

    this.dispatchEvent(event)
  }

  private checkCooldown(eventType: string): boolean {
    const handler = this.handlers.get(eventType)
    const cooldownMs = handler?.cooldownMs ?? 0
    if (cooldownMs <= 0) {
      return true
    }

    const now = Date.now()
    const lastTypeDispatchAt = this.lastDispatchByType.get(eventType) || 0

    if (now - lastTypeDispatchAt < cooldownMs) {
      return false
    }

    this.lastDispatchByType.set(eventType, now)
    return true
  }

  /**
   * 分发事件：根据事件类型找到处理器，更新上下文并执行处理器逻辑，捕获错误
   * @param event 完整事件字符串（如 "mouse.idle"），根据类型找到处理器并执行，更新上下文的 lastEventTime 和 lastEventType
   */
  private dispatchEvent(event: string): void {
    const eventType = event.split('.')[0] || event
    const handler = this.handlers.get(eventType)
    if (handler) {
      this.contextManager.update({
        isInConversation: false,
        lastEventTime: Date.now(),
        lastEventType: event
      })

      this.isDispatching = true
      // 触发事件处理器逻辑，传入事件字符串、上下文管理器和动作分发器
      handler
        .handle(event, this.contextManager, this.dispatcher)
        .catch((error) => {
          console.error('事件分发失败:', error)
        })
        .finally(() => {
          this.isDispatching = false
        })
    }
  }

  // 调试方法：注册一个监听所有事件的处理器，打印捕获的事件
  registerDebugEvents(): void {
    this.eventCenter.on('*', (e) => console.log('捕获事件', e))
  }
}
