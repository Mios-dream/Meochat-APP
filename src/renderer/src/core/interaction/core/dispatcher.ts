import { ChatManager, InteractionEventPayload } from '@renderer/chat/ChatManager'
import { Context } from '@renderer/core/interaction/core/context'

export interface EventReplyRequest {
  event: string
  scene: string
  context: Context
  maxLength?: number
  extraRules?: string[]
  fallback?: string
}

export class ActionDispatcher {
  private chatService: ChatManager
  private lastSentAt = 0

  constructor() {
    this.chatService = ChatManager.getInstance()
  }

  /**
   * 构建发送给后端 /api/interaction/message 的事件载荷
   */
  public static buildEventPayload(request: EventReplyRequest): InteractionEventPayload {
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
   * 发送动作
   * @param action - 要发送的动作
   */
  async send(action: InteractionEventPayload): Promise<void> {
    const now = Date.now()
    if (now - this.lastSentAt < 3000) {
      return
    }

    this.lastSentAt = now

    await this.chatService.interactionChat(action)
    await this.chatService.waitForReplyPlaybackComplete()
  }
}
