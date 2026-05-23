import { Context } from './context'

type EventHandler = (event: string, context?: Partial<Context>) => void

export class EventCenter {
  private handlers = new Map<string, EventHandler[]>()

  /**
   * 监听事件（支持通配符）
   * @param event - 事件名称，支持通配符（如 "time.*", "*"）
   * @param handler
   */
  on(event: string, handler: EventHandler): void {
    console.log(`事件监听注册: ${event}`)
    const list = this.handlers.get(event) || []
    list.push(handler)
    this.handlers.set(event, list)
  }

  /**
   * 触发事件
   * @param event
   * @param context - 可选的事件上下文数据，处理器可以根据这些数据做出不同的响应
   */
  emit(event: string, context?: Partial<Context>): void {
    // console.log(`事件触发: ${event}`)

    // 触发通配符匹配的事件
    this.handlers.forEach((handlers, pattern) => {
      if (pattern.includes('*') && this.matchesPattern(event, pattern)) {
        handlers.forEach((handler) => handler(event, context))
      }
    })
  }

  /**
   * 检查事件是否匹配通配符模式
   * @param event - 实际事件名称
   * @param pattern - 通配符模式
   */
  private matchesPattern(event: string, pattern: string): boolean {
    if (pattern === '*') {
      return true // 匹配所有事件
    }

    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2) // 移除 ".*"
      return event.startsWith(prefix + '.')
    }

    return false
  }

  /**
   * 移除事件监听
   * @param event
   * @param handler
   */
  off(event: string, handler: EventHandler): void {
    const list = this.handlers.get(event)
    if (list) {
      this.handlers.set(
        event,
        list.filter((h) => h !== handler)
      )
    }
  }

  /**
   * 获取所有注册的事件监听器
   */
  getEventListeners(): Map<string, EventHandler[]> {
    return new Map(this.handlers)
  }
}
