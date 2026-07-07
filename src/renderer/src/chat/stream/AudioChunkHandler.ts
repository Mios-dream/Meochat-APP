import type { ChatAudioMessage } from '@shared/types/ws'
import { audioBase64ToBlob } from '../ChatPlaybackController'
import type { SentenceAssemblyContext } from '../ChatStreamProcessor'

/**
 * 音频消息处理器。
 *
 * 负责将 chat:audio 消息中的 base64 音频数据转为 Blob，
 * 并标记该句音频已到达（包括无音频情况）。
 */
export class AudioChunkHandler {
  public constructor(private readonly context: SentenceAssemblyContext) {}

  /**
   * 处理音频消息，更新音频 Blob 和到达状态。
   *
   * @param data - chat:audio 消息对象
   */
  public handle(data: ChatAudioMessage): void {
    const state = this.context.getSentenceState(data.sentence_id)
    const hasAudioFile = Boolean(data.file)

    if (hasAudioFile) {
      state.audioBlob = audioBase64ToBlob(data.file, 'audio/wav')
    } else {
      state.audioBlob = undefined
    }

    state.audioChunkState = true
    this.context.setSentenceState(data.sentence_id, state)
  }
}
