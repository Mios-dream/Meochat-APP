import { ContextManager } from '../core/context'
import { InteractionEventPayload } from '@renderer/chat/ChatManager'
import { InteractionEffect } from './InteractionEffect'

/**
 * 事件处理器接口。
 * 处理器负责把事件转换为声明式 InteractionEffect，不直接执行聊天、模型或 UI 副作用。
 */
export interface IEventHandler {
  eventType: string
  cooldownMs: number
  responseHandlers: Record<
    string,
    (contextManager: ContextManager) => Promise<InteractionEventPayload | null>
  >
  handle: (event: string, contextManager: ContextManager) => Promise<InteractionEffect[]>
}
