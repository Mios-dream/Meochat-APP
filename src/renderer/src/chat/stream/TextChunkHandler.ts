import type { ChatTextChunk, SentenceAssemblyContext } from '../ChatStreamProcessor'

/**
 * 文本 chunk 处理器。
 *
 * 文本块主要提供台词板展示内容。当后端音频为空或动作稍后才到时，它可以作为展示兜底，避免界面长时间没有反馈。
 */
export class TextChunkHandler {
  public constructor(private readonly context: SentenceAssemblyContext) {}

  /** 将文本内容写入对应 sentence_id 的同步状态。 */
  public handle(data: ChatTextChunk): void {
    const state = this.context.getSentenceState(data.sentence_id)

    if (data.source_text) {
      state.displayMessage = data.source_text
      if (!state.message) {
        state.message = data.source_text
      }
      this.context.setSentenceState(data.sentence_id, state)
    }
  }
}
