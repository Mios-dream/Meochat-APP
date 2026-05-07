import { EventCenter } from './eventCenter'
import { ActionDispatcher } from './dispatcher'
import { IEventHandler } from '../types/IEventHandler'
import { ContextManager, Context } from './context'
import { ChatService } from '@renderer/services/ChatService'
import { useConfigStore } from '@renderer/stores/useConfigStore'

interface QueuedEvent {
  event: string
  context: Partial<Context>
}

export class EventSystem {
  private handlers: Map<string, IEventHandler> = new Map()
  private lastDispatchAt: number = 0
  private lastDispatchByType: Map<string, number> = new Map()
  private chatService: ChatService
  private pendingEventQueue: QueuedEvent[] = []
  private readonly maxQueueSize = 3
  private isDispatching = false
  private dispatchComplete: Promise<void> = Promise.resolve()

  constructor(
    private eventCenter: EventCenter,
    private contextManager: ContextManager,
    private dispatcher: ActionDispatcher
  ) {
    this.chatService = ChatService.getInstance()
    this.chatService.onSpeechEnd(() => {
      window.setTimeout(() => {
        this.flushPendingEvents().catch((error) => {
          console.error('清空待处理事件队列失败:', error)
        })
      }, 2000)
    })
  }

  registerHandler(handler: IEventHandler): void {
    this.handlers.set(handler.eventType, handler)
    this.setupEventListeners(handler.eventType)
  }

  private setupEventListeners(eventType: string): void {
    this.eventCenter.on(`${eventType}.*`, (event: string, context?: Partial<Context>) => {
      if (context) {
        this.contextManager.update(context)
      }

      this.handleIncomingEvent(event, context || {})
    })
  }

  /**
   * 处理传入事件：对话中排队，否则检查冷却后直接分发
   */
  private handleIncomingEvent(event: string, context: Partial<Context>): void {
    const passiveEvents = new Set(['mouse.idle', 'mouse.busy', 'system.battery-level'])
    if (passiveEvents.has(event)) {
      return
    }

    if (this.isDispatching) {
      this.enqueueEvent(event, context)
      return
    }

    const isInConversation = this.chatService.getReplyStatus()
    this.contextManager.update({ isInConversation })

    if (isInConversation) {
      this.enqueueEvent(event, context)
      return
    }

    if (!this.checkCooldown(event)) {
      return
    }

    this.dispatchEvent(event)
  }

  /**
   * 将事件加入待处理队列，超出上限时移除最旧的事件
   */
  private enqueueEvent(event: string, context: Partial<Context>): void {
    this.pendingEventQueue = this.pendingEventQueue.filter((e) => e.event !== event)
    this.pendingEventQueue.push({ event, context })

    while (this.pendingEventQueue.length > this.maxQueueSize) {
      this.pendingEventQueue.shift()
    }
  }

  /**
   * 清空待处理事件队列，逐个分发
   */
  private async flushPendingEvents(): Promise<void> {
    await this.dispatchComplete

    const isInConversation = this.chatService.getReplyStatus()
    if (isInConversation) {
      return
    }

    const queue = [...this.pendingEventQueue]
    this.pendingEventQueue = []

    for (const item of queue) {
      if (this.chatService.getReplyStatus()) {
        this.pendingEventQueue.push(item)
        break
      }

      this.contextManager.update(item.context)
      this.dispatchEvent(item.event)
      await this.dispatchComplete
    }
  }

  private checkCooldown(event: string): boolean {
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
      this.dispatchComplete = (async () => {
        try {
          await handler.handle(event, this.contextManager, this.dispatcher)
          await this.dispatcher.waitForDrain()
        } catch (error) {
          console.error('事件分发失败:', error)
        } finally {
          this.isDispatching = false
        }
      })()
    }
  }

  private getTypeCooldownMs(eventType: string, defaultCooldownMs: number): number {
    if (eventType === 'system') {
      return 5000
    }

    if (eventType === 'live2d') {
      return Math.max(1500, Math.floor(defaultCooldownMs / 2))
    }

    return defaultCooldownMs
  }

  registerDebugEvents(): void {
    this.eventCenter.on('*', (e) => console.log('捕获事件', e))
  }
}
