import { audioBase64ToBlob } from '../ChatPlaybackController'
import type { ChatAudioChunk, SentenceAssemblyContext } from '../ChatStreamProcessor'

/**
 * 音频 chunk 处理器。
 *
 * 负责把后端 base64 wav 转为 Blob，并记录“该句明确没有语音”的状态，供流同步器判断是否允许仅文本或仅动作入队。
 */
export class AudioChunkHandler {
  public constructor(private readonly context: SentenceAssemblyContext) {}

  /** 处理音频 chunk，更新文本、音频 Blob 和缺失语音标记。 */
  public handle(data: ChatAudioChunk): void {
    const state = this.context.getSentenceState(data.sentence_id)
    const hasAudioFile = Boolean(data.file)
    const hasSpokenMessage = Boolean(data.message?.trim())
    const hasSourceText = Boolean(data.source_text?.trim())

    if (hasSourceText) {
      state.displayMessage = data.source_text
    }
    if (hasSpokenMessage) {
      state.message = data.message
      if (!hasSourceText && !state.displayMessage) {
        state.displayMessage = data.message
      }
    }

    if (hasAudioFile) {
      state.audioBlob = audioBase64ToBlob(data.file, 'audio/wav')
      state.audioMissing = false
    } else {
      state.audioMissing = true
      state.audioBlob = undefined
    }

    this.context.setSentenceState(data.sentence_id, state)
  }
}
