import { Context } from '@renderer/services/InteractionSystem/core/context'
import { InteractionEventPayload } from '@renderer/services/ChatService'

interface EventReplyRequest {
  event: string
  scene: string
  context: Context
  maxLength?: number
  extraRules?: string[]
  fallback?: string
}

export interface HandlerResult {
  text: string
  eventPayload?: InteractionEventPayload
}

export class EventReplyGenerator {
  /**
   * 构建发送给后端 /api/interaction/message 的事件载荷
   */
  buildEventPayload(request: EventReplyRequest): InteractionEventPayload {
    return {
      event_type: request.event,
      scene: request.scene,
      context: request.context as unknown as Record<string, unknown>,
      generation_motion: false,
      include_history: true,
      history_limit: 5
    }
  }

  /**
   * 生成交互回复
   * 优先使用新的 /api/interaction/message 接口（SSE 流式，含动作生成）
   */
  async generate(request: EventReplyRequest): Promise<HandlerResult | null> {
    const payload = this.buildEventPayload(request)
    const fallbackText = typeof request.fallback === 'string' ? request.fallback : ''
    return { text: fallbackText, eventPayload: payload }
  }
}
