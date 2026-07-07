import type { ChatTextMessage } from '@shared/types/ws'
import type { SentenceAssemblyContext } from '../ChatStreamProcessor'

/**
 * 文本消息处理器，将 chat:text 消息写入对应 sentence_id 的同步状态。
 * 直接显示在台词板上，无需额外处理。
 */
export class TextChunkHandler {
  public constructor(private readonly context: SentenceAssemblyContext) {}

  /** 将文本内容写入对应 sentence_id 的同步状态。 */
  public handle(data: ChatTextMessage): void {
    const state = this.context.getSentenceState(data.sentence_id)
    state.displayMessage = data.message
    this.context.setSentenceState(data.sentence_id, state)
  }
}
