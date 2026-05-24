import type { ChatTextChunk, SentenceAssemblyContext } from '../ChatStreamProcessor'

/**
 * 文本 chunk 处理器。
 * 暂时无作用
 */
export class TextChunkHandler {
  public constructor(private readonly context: SentenceAssemblyContext) {}

  /** 将文本内容写入对应 sentence_id 的同步状态。 */
  public handle(data: ChatTextChunk): void {
    const state = this.context.getSentenceState(data.sentence_id)
    state.displayMessage = data.message
    this.context.setSentenceState(data.sentence_id, state)
  }
}
