import { InteractionEventPayload } from '@renderer/chat/ChatManager'
import { Context } from '@renderer/core/interaction/core/context'

export interface EventReplyRequest {
  event: string
  scene: string
  context: Context
  maxLength?: number
  extraRules?: string[]
  fallback?: string
}

/**
 * 事件回复载荷构建器。
 * 只负责把事件上下文转换为 ChatManager 需要的请求载荷，不执行任何副作用。
 */
export class InteractionPayloadBuilder {
  /**
   * 构建发送给后端 /api/interaction/message 的事件载荷。
   * @param request 事件、场景、上下文和生成限制等回复请求参数。
   */
  static buildEventPayload(request: EventReplyRequest): InteractionEventPayload {
    return {
      event_type: request.event,
      scene: request.scene,
      context: request.context as unknown as Record<string, unknown>,
      generation_motion: false,
      include_history: true,
      history_limit: 5
    }
  }
}
