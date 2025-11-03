// core/eventSystem.ts
import { EventCenter } from './eventCenter'
// import { InteractionEngine } from './engine'
import { ActionDispatcher } from './dispatcher'
import { IEventHandler } from '../types/IEventHandler'
import { ContextManager } from './context'

// 事件系统管理器
export class EventSystem {
  // 注册的事件处理器映射
  private handlers: Map<string, IEventHandler> = new Map()

  constructor(
    private eventCenter: EventCenter,
    private contextManager: ContextManager,
    private dispatcher: ActionDispatcher,
  ) {}

  /**
   * 注册事件处理器
   * @param handler 事件处理器实例
   */
  registerHandler(handler: IEventHandler) {
    // 设置处理器映射，设置事件类型，回调
    this.handlers.set(handler.eventType, handler)

    // 自动注册该类型的所有事件
    this.setupEventListeners(handler.eventType)
  }

  /**
   * 设置事件监听器
   * @param eventType 事件类型
   */
  private setupEventListeners(eventType: string) {
    // 使用通配符监听特定类型的事件
    this.eventCenter.on(`${eventType}.*`, (event: string) => {
      // 调用具体的事件处理函数
      const handler = this.handlers.get(eventType)
      if (handler) {
        handler.handle(event, this.contextManager, this.dispatcher)
      }
    })
  }

  // 注册调试事件
  registerDebugEvents() {
    this.eventCenter.on('*', (e) => console.log('捕获事件', e))
  }
}
