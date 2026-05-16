import { ContextManager } from '../core/context'
import { ActionDispatcher } from '../core/dispatcher'
import { InteractionEventPayload } from '@renderer/services/ChatService'

export interface IEventHandler {
  eventType: string
  cooldownMs: number
  responseHandlers: Record<
    string,
    (contextManager: ContextManager) => Promise<InteractionEventPayload | null>
  >
  handle: (
    event: string,
    contextManager: ContextManager,
    dispatcher: ActionDispatcher
  ) => Promise<void>
}
