import type { ChatResultMessage, ChatDoneMessage, ErrorMessage } from '@shared/types/ws'
import {
  audioBase64ToBlob,
  estimateAudioDurationMs,
  type ChatPlaybackSegment,
  type Live2DMotionStep
} from './ChatPlaybackController'

/**
 * WS 聊天结果消息处理器。
 *
 * 负责处理 WebSocket 推送的 chat:result / chat:done / error 消息，
 * 将统一格式的 chat:result 直接解析为可播放的 ChatPlaybackSegment，
 * 不再需要旧的 sentence_id 层面组装。
 */
export class ChatStreamProcessor {
  /**
   * @param enqueue - 将同步完成的句子交给播放层
   * @param onComplete - 本轮回复完成回调，用于 ChatManager 保存最终回复历史
   * @param onError - 服务端错误回调
   */
  public constructor(
    private readonly enqueue: (segment: ChatPlaybackSegment) => void,
    private readonly onComplete: (finalText?: string) => void,
    private readonly onError?: (errorData: ErrorMessage) => void
  ) {}

  /**
   * 向处理器喂入一个 WS 消息。
   *
   * - chat:result: 根据 content / extras 直接创建播放段
   * - chat:done: 触发完成回调
   * - error: 触发错误回调
   */
  public feed(data: ChatResultMessage | ChatDoneMessage | ErrorMessage): void {
    switch (data.type) {
      case 'chat:result':
        void this.handleChatResult(data)
        return

      case 'chat:done':
        this.onComplete(data.full_text)
        return

      case 'error':
        this.onError?.(data)
        return
    }
  }

  /** 将 chat:result 解析为 ChatPlaybackSegment 并入队播放。 */
  private async handleChatResult(data: ChatResultMessage): Promise<void> {
    // 无文本且无 extras 时跳过（理论上不会出现）
    if (data.content === null && !data.extras) return

    const segment: ChatPlaybackSegment = {
      message: data.content ?? '',
      // content 非空时追加到累积台词板文本；仅 extras 增量更新时不追加
      appendToDisplayText: data.content !== null
    }

    // 解析 extras.audio → audioBlob
    if (data.extras?.audio) {
      segment.audioBlob = audioBase64ToBlob(data.extras.audio, 'audio/wav')
      segment.audioDurationMs = await estimateAudioDurationMs(segment.audioBlob)
    }

    // 解析 extras.motion → motionSequence
    if (data.extras?.motion) {
      const motion = data.extras.motion
      segment.motionSequence = [
        {
          durationMs: motion.duration,
          fps: motion.fps,
          curves: motion.curves,
          // 后端返回单个 expression 字符串，转为数组以兼容 Live2DMotionStep
          expression: motion.expression ? [motion.expression] : undefined
        }
      ]
      segment.motionDurationMs = motion.duration
    }

    this.enqueue(segment)
  }
}

export type { Live2DMotionStep }
