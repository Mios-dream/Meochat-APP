import { ContextManager } from '../core/context'
import { ActionDispatcher, OutputAction } from '../core/dispatcher'

export interface IEventHandler {
  eventType: string
  responseHandlers: Record<string, (contextManager: ContextManager) => Promise<OutputAction | null>>
  handle: (event: string, contextManager: ContextManager, dispatcher: ActionDispatcher) => void
}
