import type {
  ChatTextMessage,
  ChatAudioMessage,
  ChatMotionMessage,
  ChatDoneMessage,
  ErrorMessage
} from '@shared/types/ws'
import {
  estimateAudioDurationMs,
  sumMotionDurationMs,
  type ChatPlaybackSegment,
  type Live2DMotionStep
} from './ChatPlaybackController'
import { AudioChunkHandler } from './stream/AudioChunkHandler'
import { MotionChunkHandler } from './stream/MotionChunkHandler'
import { TextChunkHandler } from './stream/TextChunkHandler'

/**
 * 句子同步状态。
 *
 * 按 sentence_id 组织文本、音频、动作数据，确保三者到齐后再入队播放。
 */
export interface SentenceAssemblyState {
  /** 句子序号。 */
  sentenceId: number
  /** 台词板展示优先文本*/
  displayMessage: string
  /** 实际朗读文本（chat:motion 可能携带 source_text 覆盖）。 */
  message?: string
  /** 当前句子音频数据是否已到达（包括无音频标记）。 */
  audioChunkState?: boolean
  /** 当前句子的语音 Blob。 */
  audioBlob?: Blob
  /** 当前句子动作数据是否已到达。 */
  motionChunkState?: boolean
  /** 当前句子的动作序列。 */
  motionSequence?: Live2DMotionStep[]
  /** 是否已经进入播放队列，防止重复入队。 */
  isQueued: boolean
}

/**
 * 句子处理器共享上下文。
 *
 * 统一管理 sentence_id 状态读写，三个子处理器通过该接口协作。
 */
export interface SentenceAssemblyContext {
  /** 获取或创建指定 sentence_id 的同步状态。 */
  getSentenceState(sentenceId: number): SentenceAssemblyState
  /** 保存更新后的句子同步状态。 */
  setSentenceState(sentenceId: number, state: SentenceAssemblyState): void
}

/**
 * WS 聊天消息流处理器。
 *
 * 负责处理 WebSocket 推送的 chat:text / chat:audio / chat:motion / chat:done / chat:error 消息，
 * 按 sentence_id 将乱序到达的数据同步成可播放队列项，并管理流完整生命周期回调。
 */
export class ChatStreamProcessor implements SentenceAssemblyContext {
  /** 按 sentence_id 暂存尚未满足入队条件的文本、音频和动作。 */
  private pendingSentences: Map<number, SentenceAssemblyState> = new Map()
  /** 下一个允许入队的 sentence_id，确保播放顺序稳定。 */
  private nextSentenceId: number = 1
  /** 当前回复是否期望动作帧，用于决定有音频但还没动作时能否提前入队。 */
  private useMotion = false
  /** 文本消息处理器。 */
  private readonly textHandler = new TextChunkHandler(this)
  /** 音频消息处理器。 */
  private readonly audioHandler = new AudioChunkHandler(this)
  /** 动作消息处理器。 */
  private readonly motionHandler = new MotionChunkHandler(this)

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

  /** 开始新一轮流式回复前重置内部状态。 */
  public reset(useMotion: boolean): void {
    this.pendingSentences.clear()
    this.nextSentenceId = 1
    this.useMotion = useMotion
  }

  /** 清除所有待同步数据，通常用于中断当前回复。 */
  public clearPending(): void {
    this.pendingSentences.clear()
    this.nextSentenceId = 1
  }

  /** 判断流处理层是否还有未入队句子。 */
  public hasPendingWork(): boolean {
    return this.pendingSentences.size > 0
  }

  /** 获取或创建指定 sentence_id 的同步状态。 */
  public getSentenceState(sentenceId: number): SentenceAssemblyState {
    const existing = this.pendingSentences.get(sentenceId)
    if (existing) {
      return existing
    }

    return {
      sentenceId,
      displayMessage: '',
      message: '',
      isQueued: false
    }
  }

  /** 保存更新后的句子同步状态。 */
  public setSentenceState(sentenceId: number, state: SentenceAssemblyState): void {
    this.pendingSentences.set(sentenceId, state)
  }

  /**
   * 向处理器喂入一个 WS 消息，按 type 分发给对应子处理器。
   *
   * - chat:text: 累积 token 文本，不触发入队检查
   * - chat:audio: 设置音频 Blob，触发入队检查
   * - chat:motion: 设置动作序列，触发入队检查
   * - chat:done: 触发完成回调，刷新未入队句子后触发入队检查
   * - chat:error: 触发错误回调，清理待处理数据
   */
  public feed(
    data: ChatTextMessage | ChatAudioMessage | ChatMotionMessage | ChatDoneMessage | ErrorMessage
  ): void {
    switch (data.type) {
      case 'chat:text':
        this.textHandler.handle(data)
        return

      case 'chat:audio':
        this.audioHandler.handle(data)
        this.checkAndEnqueue(data.sentence_id)
        return

      case 'chat:motion':
        this.motionHandler.handle(data)
        this.checkAndEnqueue(data.sentence_id)
        return

      case 'chat:done':
        this.onComplete(data.full_text)
        return

      case 'error':
        this.clearPending()
        this.onError?.(data)
        return
    }
  }

  /**
   * 检查指定 sentence_id 是否满足入队条件，满足时创建播放段并入队。
   * 入队成功后递归检查下一个 sentence_id，防止数据乱序到达导致后续句子卡住。
   *
   * 入队条件:
   *   - 动作已到达（useMotion 为 false 时跳过该条件）
   *   - 音频已到达（含无音频标记）
   *   - sentence_id 在播放序列中（非超前句子）
   *   - 尚未入队
   */
  private checkAndEnqueue(sentenceId: number): void {
    const state = this.pendingSentences.get(sentenceId)
    if (!state || state.isQueued) {
      return
    }

    // 跳过超前句子，严格按序号入队保证播放顺序
    if (sentenceId !== this.nextSentenceId) {
      // 如果当前句子不是下一个，不对它做任何处理，但也不影响后续句子
      return
    }

    const motionAvailable = this.useMotion ? state.motionChunkState : true
    const audioAvailable = state.audioChunkState || false
    if (motionAvailable && audioAvailable) {
      state.isQueued = true
      this.createQueueSegment(
        state,
        state.displayMessage,
        Boolean(state.motionSequence),
        Boolean(state.displayMessage)
      ).then((segment) => {
        this.enqueue(segment)
        this.pendingSentences.delete(sentenceId)
      })
      this.nextSentenceId += 1
    }
  }

  /**
   * 根据同步状态创建播放层消费的 ChatPlaybackSegment。
   *
   * @param state - 句子同步状态
   * @param displayMessage - 台词板展示文本
   * @param hasMotion - 是否包含动作数据
   * @param hasDisplayText - 是否追加到累积台词板文本
   */
  private async createQueueSegment(
    state: SentenceAssemblyState,
    displayMessage: string,
    hasMotion: boolean,
    hasDisplayText: boolean
  ): Promise<ChatPlaybackSegment> {
    const segment: ChatPlaybackSegment = {
      sentenceId: state.sentenceId,
      message: displayMessage,
      motionSequence: state.motionSequence,
      motionDurationMs: hasMotion ? sumMotionDurationMs(state.motionSequence!) : undefined,
      appendToDisplayText: hasDisplayText
    }

    if (state.audioBlob) {
      segment.audioBlob = state.audioBlob
      segment.audioDurationMs = await estimateAudioDurationMs(state.audioBlob)
    }

    return segment
  }
}

export type { Live2DMotionStep }
