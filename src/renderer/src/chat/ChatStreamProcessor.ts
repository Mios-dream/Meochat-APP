import {
  estimateAudioDurationMs,
  sumMotionDurationMs,
  type ChatPlaybackSegment,
  type Live2DMotionStep
} from './ChatPlaybackController'
import { AudioChunkHandler } from './stream/AudioChunkHandler'
import { MotionChunkHandler } from './stream/MotionChunkHandler'
import { TextChunkHandler } from './stream/TextChunkHandler'

/** SSE 文本块，通常先于音频或动作到达，用于台词板兜底展示。 */
export interface ChatTextChunk {
  type: 'text'
  /** 句子序号，用于和同句的音频、动作帧配对。 */
  sentence_id: number
  /** 保留括号动作描述的原文，台词板展示优先使用它。 */
  message: string
  /** 后端可选完成标记。 */
  done?: boolean
}

/** SSE 动作帧块，承载 Live2D 参数变化序列。 */
export interface ChatMotionChunk {
  type: 'motion_frame'
  /** 句子序号，用于等待同句音频或仅动作播放。 */
  sentence_id: number
  /** 动作帧对应原文，文本块缺失时可用于展示兜底。 */
  source_text?: string
  /** 动作帧数组，每一项代表一段参数过渡。 */
  motions?: Array<{
    /** 当前动作段持续时间，单位毫秒。 */
    duration?: number
    /** 动作名称，目前仅作为后端兼容字段保留。 */
    action?: string
    /** Live2D 参数 ID 到参数值的映射。 */
    parameters?: Record<string, number>
  }>
  /** 兼容后端可能直接返回的持续时间字段。 */
  duration?: number
  /** 后端可选完成标记。 */
  done?: boolean
}

/** SSE 音频块，承载语音文本和 base64 wav 数据。 */
export interface ChatAudioChunk {
  type: 'audio'
  /** 句子序号，用于和文本、动作帧同步。 */
  sentence_id: number
  /** 删除括号后的实际朗读文本。 */
  message: string
  /** 保留括号动作描述的原文，台词板展示优先使用它。 */
  source_text: string
  /** base64 编码的 wav 内容；空字符串表示该句没有语音。 */
  file: string
  /** 后端可选完成标记。 */
  done?: boolean
}

/** SSE 完成块，表示本轮回复流结束。 */
interface ChatDoneChunk {
  type: 'done'
  /** 后端聚合后的完整回复文本，用于聊天历史保存。 */
  full_text?: string
  done: true
}

/** 后端 SSE 可能返回的全部 chunk 类型。 */
type ChatStreamChunk = ChatTextChunk | ChatMotionChunk | ChatAudioChunk | ChatDoneChunk

/** 文本、音频、动作乱序到达时的句子同步状态。 */
export interface SentenceAssemblyState {
  /** 句子序号。 */
  sentenceId: number
  /** 台词板展示优先文本。 */
  displayMessage: string
  /** 实际朗读文本 */
  message?: string
  /** 判断当前句子是否已接收音频 chunk。 */
  audioChunkState?: boolean
  /** 当前句子的语音 Blob。 */
  audioBlob?: Blob
  /** 判断当前句子是否已接收动作 chunk。 */
  motionChunkState?: boolean
  /** 当前句子的动作序列。 */
  motionSequence?: Live2DMotionStep[]
  /** 是否已经进入播放队列，防止重复入队。 */
  isQueued: boolean
}

/** 句子处理器共享上下文，统一管理 sentence_id 状态读写。 */
export interface SentenceAssemblyContext {
  /** 获取或创建指定 sentence_id 的同步状态。 */
  getSentenceState(sentenceId: number): SentenceAssemblyState
  /** 保存更新后的句子同步状态。 */
  setSentenceState(sentenceId: number, state: SentenceAssemblyState): void
}

/**
 * 聊天 SSE 流处理器。
 *
 * 负责读取后端流式响应，解析 text/audio/motion_frame/done chunk，并按 sentence_id 将乱序到达的数据同步成可播放队列项。
 */
export class ChatStreamProcessor implements SentenceAssemblyContext {
  /** 按 sentence_id 暂存尚未满足入队条件的文本、音频和动作。 */
  private pendingSentences: Map<number, SentenceAssemblyState> = new Map()
  /** 下一个允许入队的 sentence_id，确保播放顺序稳定。 */
  private nextSentenceId: number = 1
  /** SSE 文本缓冲区，用于处理网络 chunk 截断 JSON 行的问题。 */
  private chunkBuffer = ''
  /** 当前回复是否期望动作帧，用于决定有音频但还没动作时能否提前入队。 */
  private useMotion = false
  /** 文本 chunk 处理器。 */
  private readonly textHandler = new TextChunkHandler(this)
  /** 音频 chunk 处理器。 */
  private readonly audioHandler = new AudioChunkHandler(this)
  /** 动作 chunk 处理器。 */
  private readonly motionHandler = new MotionChunkHandler(this)

  /**
   * @param enqueue 将同步完成的句子交给播放层。
   * @param onComplete 完成事件回调，用于 ChatManager 保存最终回复历史。
   */
  public constructor(
    private readonly enqueue: (segment: ChatPlaybackSegment) => void,
    private readonly onComplete: (finalText?: string) => void
  ) {}

  /** 开始新一轮流式回复前重置内部状态。 */
  public reset(useMotion: boolean): void {
    this.pendingSentences.clear()
    this.nextSentenceId = 1
    this.chunkBuffer = ''
    this.useMotion = useMotion
  }

  /** 清除所有待同步数据和残留缓冲，通常用于中断当前回复。 */
  public clearPending(): void {
    this.pendingSentences.clear()
    this.nextSentenceId = 1
    this.chunkBuffer = ''
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

  /** 读取 Response.body 流，并把解码后的文本片段交给行解析器。 */
  public async readStreamResponse(response: Response): Promise<void> {
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        const flushChunk = decoder.decode()
        if (flushChunk) {
          this.parseStreamChunk(flushChunk)
        }

        const pendingLine = this.chunkBuffer.trim()
        this.chunkBuffer = ''
        if (pendingLine) {
          this.parseStreamLine(pendingLine)
        }
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      this.parseStreamChunk(chunk)
    }
  }

  /** 解析网络 chunk，并把不完整的最后一行留到下一次拼接。 */
  private parseStreamChunk(chunk: string): void {
    if (!chunk) {
      return
    }

    this.chunkBuffer += chunk

    const lines = this.chunkBuffer.split(/\r?\n/)
    this.chunkBuffer = lines.pop() || ''

    for (const line of lines) {
      this.parseStreamLine(line)
    }
  }

  /** 解析单行 SSE 数据，兼容 data: 前缀和直接 JSON 两种格式。 */
  private parseStreamLine(line: string): void {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine === '[DONE]') {
      return
    }

    if (!trimmedLine.startsWith('data:') && !trimmedLine.startsWith('{')) {
      return
    }

    const jsonStr = trimmedLine.startsWith('data:')
      ? trimmedLine.replace(/^data:\s*/, '')
      : trimmedLine

    try {
      const data = JSON.parse(jsonStr) as ChatStreamChunk
      void this.handleStreamChunk(data)
    } catch (error) {
      console.error('解析数据失败:', error, jsonStr)
    }
  }

  /** 根据 chunk 类型分发给对应处理器。 */
  private async handleStreamChunk(data: ChatStreamChunk): Promise<void> {
    if (!('type' in data) || typeof data.type !== 'string') {
      return
    }

    switch (data.type) {
      case 'text':
        this.textHandler.handle(data)
        this.checkAndEnqueue(data.sentence_id)
        return
      case 'motion_frame':
        this.motionHandler.handle(data)
        this.checkAndEnqueue(data.sentence_id)
        return
      case 'audio':
        this.audioHandler.handle(data)
        this.checkAndEnqueue(data.sentence_id)
        return
      case 'done':
        this.onComplete(data.full_text)
        return
      default:
        return
    }
  }

  /** 检查指定 sentence_id 是否满足入队条件，满足时创建播放段并入队。 */
  private checkAndEnqueue(sentenceId: number): void {
    const state = this.pendingSentences.get(sentenceId)
    if (!state || state.isQueued) {
      return
    }
    // 如果预期有动作但还没收到动作 chunk，进行等待。如果没有动作预期则不等待，收到音频 chunk 就入队，保证有内容可播。
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

  /** 根据同步状态创建播放层消费的 ChatPlaybackSegment。 */
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
