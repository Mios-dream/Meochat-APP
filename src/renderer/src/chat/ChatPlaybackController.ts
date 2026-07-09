import { Live2DManager } from '../services/Live2dManager'

/** 单个 Live2D 动作步骤，播放层不关心它来自哪个后端 chunk。 */
export interface Live2DMotionStep {
  /** 当前动作步骤持续时间，单位毫秒。 */
  durationMs: number
  /** 参数完整时间序列曲线，key 为参数 ID，value 为等间隔采样的数值数组。 */
  curves: Record<string, number[]>
  /** 曲线数据的帧率，单位 fps。 */
  fps?: number
  /** 表情名称列表，对应模型 .exp3.json 中定义的 expression。 */
  expression?: string[]
}

/** 已完成同步、可进入播放队列的聊天播放片段。 */
export interface ChatPlaybackSegment {
  /** 对应后端 sentence_id，普通 TTS 消息可能没有该字段。 */
  sentenceId?: number
  /** 台词板展示文本。 */
  message: string
  /** 可播放音频 Blob；为空时表示仅文本或仅动作。 */
  audioBlob?: Blob
  /** 可播放动作序列；为空时表示仅语音或仅文本。 */
  motionSequence?: Live2DMotionStep[]
  /** 音频时长，播放层用于估算台词淡入时间和动作对齐。 */
  audioDurationMs?: number
  /** 动作总时长，仅动作播放时使用。 */
  motionDurationMs?: number
  /** 是否追加到累积台词板文本。 */
  appendToDisplayText?: boolean
  /** 事件图标配置，用于在台词板末尾显示对应图标。 */
  icon?: {
    path: string
  }
}

/**
 * 聊天播放控制器。
 *
 * 负责消费已经同步完成的 ChatPlaybackSegment 队列，并协调台词板展示、语音播放、Live2D 口型和动作帧播放。
 * 该类不关心网络请求和 SSE 解析，只处理“已经可以播放”的数据。
 */
export class ChatPlaybackController {
  /** 语音/动作开始播放时的外部回调。 */
  private speechStartCallbacks: Array<(message: string) => void> = []
  /** 当前播放队列全部结束时的外部回调。 */
  private speechEndCallbacks: Array<() => void> = []
  /** 等待播放的文本、音频、动作组合队列。 */
  private playbackQueue: ChatPlaybackSegment[] = []
  /** 防止重复启动播放循环。 */
  private isPlaying = false
  /** 当前播放循环是否是在睡眠模式下启动，用于结束后恢复睡眠表情。 */
  private sleepTalkActive = false
  /** 是否保持睡眠闭眼状态，不触发眼皮微张。 */
  private keepSleepEyesClosed = false
  /** 当前播放音量，范围 0-1。 */
  private volume = 1.0
  /** 当前累积展示在台词板上的回复文本。 */
  private currentDisplayText = ''
  /** 动作序列中断令牌，停止播放时递增以让旧异步循环自动退出。 */
  private motionSequenceToken = 0

  /**
   * @param live2DManager Live2D 管理器，存在时用于语音口型和动作帧；为空时降级普通音频播放。
   * @param showMessage 台词板展示函数，由 ChatManager 注入以保持消息提示实现集中。
   */
  public constructor(
    private readonly live2DManager: Live2DManager | null,
    private readonly showMessage: (
      text: string,
      timeout?: number,
      priority?: number,
      transitionDuration?: number,
      icon?: { path: string }
    ) => void
  ) {}

  /** 将一个可播放组合加入队列，并尝试启动播放循环。 */
  public enqueue(segment: ChatPlaybackSegment): void {
    this.playbackQueue.push(segment)
    void this.playAudioQueueWithLive2D()
  }

  /** 重置台词板累积文本，通常在新回复开始或中断时调用。 */
  public resetDisplayText(): void {
    this.currentDisplayText = ''
  }

  /** 设置是否保持睡眠闭眼状态，梦呓等场景下不触发眼皮微张。 */
  public setKeepSleepEyesClosed(keep: boolean): void {
    this.keepSleepEyesClosed = keep
  }

  /** 获取当前累积展示文本。 */
  public getCurrentDisplayText(): string {
    return this.currentDisplayText
  }

  /** 判断播放层是否仍有正在播放或等待播放的任务。 */
  public hasPendingWork(): boolean {
    return this.isPlaying || this.playbackQueue.length > 0
  }

  /** 获取当前是否处于播放中，用作 ChatManager 的回复状态。 */
  public isReplying(): boolean {
    return this.isPlaying
  }

  /** 注册播放开始回调。 */
  public onSpeechStart(callback: (message: string) => void): void {
    this.speechStartCallbacks.push(callback)
  }

  /** 注册播放结束回调。 */
  public onSpeechEnd(callback: () => void): void {
    this.speechEndCallbacks.push(callback)
  }

  /** 设置音量，并同步到 Live2DManager。 */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    this.live2DManager?.setVolume(volume)
  }

  /** 获取当前音量。 */
  public getVolume(): number {
    return this.volume
  }

  /** 停止当前音频和动作，清空等待队列。 */
  public stopAudio(): void {
    this.playbackQueue = []
    this.isPlaying = false
    this.motionSequenceToken++
    this.live2DManager?.stopMotionCurve()
    this.live2DManager?.clearMotionFrame()
    this.live2DManager?.stopSpeaking()
    this.finishSleepTalkMotion()
  }

  /**
   * 串行消费播放队列。
   *
   * 每个 ChatPlaybackSegment 会先更新台词板，再根据是否有音频/动作选择播放路径。
   * 图标与最后一段文字一起显示。
   */
  private async playAudioQueueWithLive2D(): Promise<void> {
    if (this.isPlaying || this.playbackQueue.length === 0) return

    this.isPlaying = true
    this.startSleepTalkMotionIfNeeded()

    try {
      let speechStarted = false

      while (this.playbackQueue.length > 0) {
        const segment = this.playbackQueue.shift()!
        const hasAudio = Boolean(segment.audioBlob)
        const hasMotion = Boolean(segment.motionSequence?.length)
        const isLastSegment = this.playbackQueue.length === 0

        if (segment.appendToDisplayText !== false) {
          this.currentDisplayText += segment.message
          const baseDuration = segment.audioDurationMs || segment.motionDurationMs || 900
          const fadeDuration = hasAudio ? Math.max(1000, Math.floor(baseDuration * 0.5)) : 1000
          // 最后一个 segment 时传递图标，与文字一起显示
          const iconToShow = isLastSegment ? segment.icon : undefined
          this.showMessage(this.currentDisplayText, -1, 999, fadeDuration, iconToShow)
        }

        if (!speechStarted) {
          speechStarted = true
          this.notifySpeechStart()
        }

        const token = ++this.motionSequenceToken

        if (hasAudio && segment.audioBlob) {
          await this.playAudioSegment(segment, hasMotion, token)
        } else if (hasMotion && segment.motionSequence) {
          await this.playMotionSequence(segment.motionSequence, token)
        }
      }
    } finally {
      this.isPlaying = false
      this.finishSleepTalkMotion()
      this.notifySpeechEnd()
    }
  }

  /** 如果当前处于睡眠模式，则在整段回复期间切换为半睡半醒眼神。 */
  private startSleepTalkMotionIfNeeded(): void {
    if (!this.live2DManager?.sleepModel) return
    if (this.keepSleepEyesClosed) return

    this.sleepTalkActive = true
    this.live2DManager.startSleepTalkMotion()
  }

  /** 整段回复结束或中断后，恢复睡眠闭眼表现。 */
  private finishSleepTalkMotion(): void {
    if (!this.sleepTalkActive) return

    this.sleepTalkActive = false
    this.live2DManager?.stopSleepTalkMotion()
  }

  /** 播放带音频的队列项，优先使用 Live2DManager，缺失时降级为普通 Audio 播放。 */
  private async playAudioSegment(
    segment: ChatPlaybackSegment,
    hasMotion: boolean,
    token: number
  ): Promise<void> {
    if (!segment.audioBlob) return

    const audioArrayBuffer = await segment.audioBlob.arrayBuffer()

    if (this.live2DManager) {
      if (hasMotion && segment.motionSequence) {
        const speakPromise = this.live2DManager.speak(audioArrayBuffer, this.volume)
        const motionPromise = this.playMotionSequence(segment.motionSequence, token)
        await Promise.all([speakPromise, motionPromise])
      } else {
        await this.live2DManager.speak(audioArrayBuffer, this.volume)
      }

      return
    }

    const audioUrl = URL.createObjectURL(segment.audioBlob)
    await playAudioSimple(audioUrl)
    URL.revokeObjectURL(audioUrl)
  }

  /**
   * 按顺序播放 Live2D 动作序列，动作按原始时长播放，不做时间缩放。
   *
   * 将曲线数据构建 motion3.json 交由 SDK 原生 CubismMotion 播放，
   * 利用 fade weight 机制实现平滑淡入，结束阶段由 overlay 覆盖层接管释放。
   *
   * 当动作序列包含眼部参数（ParamEyeLOpen/ParamEyeROpen）时，
   * 临时禁用原生眨眼系统，播放完毕后恢复，避免眨眼覆盖动作写入值。
   *
   * @param sequence 动作步骤数组
   * @param token 中断令牌，与当前令牌不匹配时停止播放
   */
  private async playMotionSequence(sequence: Live2DMotionStep[], token: number): Promise<void> {
    if (!this.live2DManager || sequence.length === 0) return
    // 参数禁用
    this.live2DManager.setEyeBlinkEnabled(false)

    try {
      for (const [stepIndex, step] of sequence.entries()) {
        if (token !== this.motionSequenceToken) return

        const isFirstStep = stepIndex === 0

        if (step.expression && step.expression.length > 0) {
          console.log(
            `[ChatPlaybackController] Applying expressions: ${step.expression.join(', ')}`
          )
          this.live2DManager.applyExpressions(step.expression)
        }

        // fire-and-forget 启动 SDK 原生 CubismMotion，
        // 利用 fade weight 机制平滑淡入。不依赖 SDK 回调判断完成，
        // 直接使用曲线自带时长 + 轮询 token 确定播放结束
        const fadeInMs = isFirstStep ? 500 : 16
        this.live2DManager.playMotionCurves(
          step.curves!,
          step.fps || 30,
          step.durationMs,
          fadeInMs
        )
        const waitMs = step.durationMs + fadeInMs + 50
        if (!(await this.waitWithTokenCheck(waitMs, token))) return
      }
    } finally {
      // 无论正常结束还是因中断令牌提前退出，都恢复原生眨眼
      this.live2DManager.setEyeBlinkEnabled(true)
    }

    if (token === this.motionSequenceToken) {
      // 将曲线步骤最后帧参数注入 overlay 覆盖层，
      // 使 clearMotionFrame 能接管释放阶段，模型平滑恢复到默认姿态
      const releaseFrame = extractMotionFinalValues(sequence)
      if (releaseFrame) {
        this.live2DManager.applyMotionFrame(releaseFrame, { transitionMs: 0, holdMs: 16 })
      }
      this.live2DManager.clearMotionFrame()
    }
  }

  /**
   * 等待指定时长，期间每 50ms 轮询 token 是否变化。
   * 用于替代 SDK 回调的不确定性，直接使用曲线数据中的时长判断播放完成。
   *
   * @param ms 等待时长（ms）
   * @param token 当前中断令牌
   * @returns token 未变化（正常完成）返回 true，被中断返回 false
   */
  private async waitWithTokenCheck(ms: number, token: number): Promise<boolean> {
    const deadline = performance.now() + ms
    while (performance.now() < deadline) {
      if (token !== this.motionSequenceToken) return false
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
    }
    return true
  }

  /** 异步通知外部：第一条台词准备好且播放循环开始。 */
  private notifySpeechStart(): void {
    const message = this.currentDisplayText
    for (const cb of this.speechStartCallbacks) {
      Promise.resolve()
        .then(() => cb(message))
        .catch((e) => console.error('speechStart callback error:', e))
    }
  }

  /** 异步通知外部：当前播放队列消费完成。 */
  private notifySpeechEnd(): void {
    for (const cb of this.speechEndCallbacks) {
      Promise.resolve()
        .then(() => cb())
        .catch((e) => console.error('speechEnd callback error:', e))
    }
  }
}

/**
 * 从动作序列中提取所有参数在最后一帧的最终值，
 * 用于在播放完毕后通过 overlay 覆盖层平滑释放到默认姿态。
 *
 * 后续步骤中的同名参数会覆盖前面的值，取最后一个步骤的终值。
 * @param sequence 动作步骤序列
 * @returns 最后一帧参数键值表；序列为空或无曲线/关键帧时返回 null
 */
function extractMotionFinalValues(sequence: Live2DMotionStep[]): Record<string, number> | null {
  const values: Record<string, number> = {}

  for (const step of sequence) {
    for (const [paramId, samples] of Object.entries(step.curves)) {
      if (Array.isArray(samples) && samples.length > 0) {
        values[paramId] = samples[samples.length - 1]
      }
    }
  }

  return Object.keys(values).length > 0 ? values : null
}

/** 将后端返回的 base64 音频内容转换为 Blob。 */
export function audioBase64ToBlob(base64: string, mimeType: string): Blob {
  try {
    if (!base64) {
      return new Blob([], { type: mimeType })
    }

    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  } catch (error) {
    console.error('Base64解码失败:', error)
    return new Blob([], { type: mimeType })
  }
}

/** 获取音频 Blob 的播放时长，失败时使用 wav 大小做回退估算。 */
export async function estimateAudioDurationMs(audioBlob: Blob): Promise<number> {
  try {
    const audioContext = new AudioContext()
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const duration = audioBuffer.duration * 1000

    await audioContext.close()

    return Math.max(120, duration)
  } catch (error) {
    console.warn('无法精确获取音频时长，使用回退估算方法:', error)
    const audioDataSize = Math.max(0, audioBlob.size - 44)
    const estimatedDuration = (audioDataSize / 176400) * 1000
    return Math.max(120, estimatedDuration)
  }
}

/** 统计动作序列总时长，供仅动作播放和语音动作对齐使用。 */
export function sumMotionDurationMs(sequence: Live2DMotionStep[]): number {
  return sequence.reduce((sum, step) => sum + step.durationMs, 0)
}

/** Live2DManager 不可用时的普通 Audio 播放降级方案。 */
function playAudioSimple(audioUrl: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(audioUrl)

    audio.addEventListener('ended', () => resolve())
    audio.addEventListener('error', (e) => reject(e))

    audio.play().catch(reject)
  })
}
