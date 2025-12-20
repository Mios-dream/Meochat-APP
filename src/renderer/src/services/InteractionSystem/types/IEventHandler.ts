import { Context, ContextManager } from '../core/context'
import { ActionDispatcher } from '../core/dispatcher'
// import { InteractionEngine } from '../core/engine'

// 定义事件处理器接口
export interface IEventHandler {
  eventType: string
  responseHandlers: Record<string, (context: Context) => Promise<string | null>>
  handle: (event: string, contextManager: ContextManager, dispatcher: ActionDispatcher) => void
}
