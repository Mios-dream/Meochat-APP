import { Live2DManager } from '../services/Live2dManager'

/** 曲线数据逐帧播放时的目标帧率。使用 60fps 以获得平滑动作表现。 */
const CURVE_PLAYBACK_FPS = 60
/** 曲线逐帧播放时每帧间隔，单位毫秒。 */
const CURVE_FRAME_INTERVAL_MS = 1000 / CURVE_PLAYBACK_FPS

/** 单个 Live2D 动作步骤，播放层不关心它来自哪个后端 chunk。 */
export interface Live2DMotionStep {
  /** 当前动作步骤持续时间，单位毫秒。 */
  durationMs: number
  /** 当前步骤要应用到 Live2D 模型的参数（旧关键帧方案）。 */
  parameters?: Record<string, number>
  /** 参数完整时间序列曲线，key 为参数 ID，value 为等间隔采样的数值数组（新曲线方案）。 */
  curves?: Record<string, number[]>
  /** 曲线数据的帧率，单位 fps（新曲线方案专有）。 */
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
   * 支持两种动作数据格式：
   * - 旧关键帧方案（step.parameters 存在）：逐 step 过渡播放，参数跨 step 累加。
   * - 新曲线方案（step.curves 存在）：按播放帧率逐帧采样曲线，线性插值播放。
   * 两种格式可在同一 sequence 中混合，但推荐统一使用一种。
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
      let carriedParams: Record<string, number> = {}

      for (const step of sequence) {
        if (token !== this.motionSequenceToken) return

        if (step.expression && step.expression.length > 0) {
          console.log(
            `[ChatPlaybackController] Applying expressions: ${step.expression.join(', ')}`
          )
          this.live2DManager.applyExpressions(step.expression)
        }

        // 新曲线方案：完整参数时间序列，按原始时长逐帧插值播放
        if (step.curves) {
          await this.playMotionCurveFrames(step, token)
          continue
        }

        // 旧关键帧方案（保留备用）：单帧目标值 + 平滑过渡
        if (step.parameters) {
          const mergedParams = { ...carriedParams, ...step.parameters }
          carriedParams = mergedParams

          const durationMs = step.durationMs
          const transitionMs = Math.min(980, Math.max(220, Math.floor(durationMs * 0.88)))
          const holdMs = durationMs + Math.min(220, Math.floor(durationMs * 0.24))
          const waitMs = Math.max(100, durationMs)

          this.live2DManager.applyMotionFrame(mergedParams, { transitionMs, holdMs })
          await new Promise((resolve) => window.setTimeout(resolve, waitMs))
        }
      }
    } finally {
      // 无论正常结束还是因中断令牌提前退出，都恢复原生眨眼
      this.live2DManager.setEyeBlinkEnabled(true)
    }

    if (token === this.motionSequenceToken) {
      this.live2DManager.clearMotionFrame()
    }
  }

  /**
   * 按原始时长逐帧播放曲线数据，不做时间缩放。
   *
   * 对源曲线（sourceFps）按播放帧率（CURVE_PLAYBACK_FPS）做线性插值，
   * 得到每一帧的参数值后通过 applyMotionFrame 应用到 Live2D 模型。
   *
   * @param step 包含 curves 和 fps 的动作步骤
   * @param token 中断令牌，与当前令牌不匹配时停止播放
   */
  private async playMotionCurveFrames(step: Live2DMotionStep, token: number): Promise<void> {
    if (!this.live2DManager || !step.curves) return

    const curves = step.curves
    const sourceFps = step.fps || 30
    const totalDurationMs = step.durationMs

    // 播放总帧数（向上取整保证覆盖全程）
    const totalFrames = Math.ceil((totalDurationMs / 1000) * CURVE_PLAYBACK_FPS)

    // transitionMs 选 clampDuration 下限 60，保证每帧能快速向目标值过渡
    // holdMs 选 clampDuration 下限 300，避免被后续帧立即覆盖影响缓动表现
    const transitionMs = 60
    const holdMs = 300

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (token !== this.motionSequenceToken) return

      // 当前帧在源时间轴上的时间位置（秒），按原始时长不做缩放
      const sourceTimeSeconds = (frameIndex * CURVE_FRAME_INTERVAL_MS) / 1000

      // 从每条曲线中插值当前帧的参数值
      const frameParams = interpolateCurveFrame(curves, sourceFps, sourceTimeSeconds)

      if (Object.keys(frameParams).length > 0) {
        this.live2DManager.applyMotionFrame(frameParams, { transitionMs, holdMs })
      }

      await new Promise((resolve) => window.setTimeout(resolve, CURVE_FRAME_INTERVAL_MS))
    }
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

/**
 * 从多条参数曲线中线性插值出指定时刻的参数帧。
 *
 * @param curves 参数 ID 到完整时间序列的映射
 * @param sourceFps 源曲线数据的帧率
 * @param timeSeconds 需要采样的时刻（源时间轴，单位秒）
 * @returns 该时刻所有参数的值
 */
function interpolateCurveFrame(
  curves: Record<string, number[]>,
  sourceFps: number,
  timeSeconds: number
): Record<string, number> {
  const frameParams: Record<string, number> = {}

  for (const [paramId, curve] of Object.entries(curves)) {
    if (!Array.isArray(curve) || curve.length === 0) continue

    // 将源时间转换为曲线数组中的浮点索引
    const sourceIndex = timeSeconds * sourceFps
    const lowerIdx = Math.floor(sourceIndex)
    const upperIdx = Math.min(lowerIdx + 1, curve.length - 1)

    if (lowerIdx < 0) {
      // 时间戳在曲线开始之前，使用第一个值
      frameParams[paramId] = curve[0]
    } else if (lowerIdx >= curve.length - 1) {
      // 时间戳在曲线结束之后，使用最后一个值
      frameParams[paramId] = curve[curve.length - 1]
    } else {
      // 在两个采样点之间线性插值
      const t = sourceIndex - lowerIdx
      frameParams[paramId] = curve[lowerIdx] + (curve[upperIdx] - curve[lowerIdx]) * t
    }
  }

  return frameParams
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
