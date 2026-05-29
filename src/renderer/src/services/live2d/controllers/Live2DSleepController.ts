type SleepParameterWriter = (parameters: Record<string, number>) => void

/**
 * 负责 Live2D 睡眠模式、眼部状态和低频睡眠微动。
 * 睡眠眼部参数直接通过 requestAnimationFrame 持续写入，避免依赖动作更新钩子造成参数残留或不生效。
 */
export class Live2DSleepController {
  private sleeping = false
  private drowsyTalking = false
  private drowsyLingering = false
  private sleepMicroMotionTimer: ReturnType<typeof setTimeout> | null = null
  private drowsyTalkTimer: ReturnType<typeof setTimeout> | null = null
  private drowsyCloseTimer: ReturnType<typeof setTimeout> | null = null
  private drowsyBlinkTimer: ReturnType<typeof setTimeout> | null = null
  private sleepParameterWriter: SleepParameterWriter | null = null
  private sleepParameterFrameId: number | null = null
  private lastFrameAt = 0
  private transitionMs = 500
  private currentParameters: Record<string, number> = createClosedSleepParameters()
  private targetParameters: Record<string, number> = createClosedSleepParameters()

  /**
   * 当前是否处于睡眠模式。
   * @returns 是否处于睡眠模式。
   */
  isSleeping(): boolean {
    return this.sleeping
  }

  /**
   * 进入睡眠待机状态。
   * @param setMotionIdleEnabled 是否启用 idle 动画的设置函数。
   * @param setEyeBlinkEnabled 是否启用眨眼的设置函数。
   * @param setEyeOpenValue 眼睛开合度设置函数。
   * @param writeSleepParameters 睡眠参数直接写入函数。
   */
  enterSleepMode(
    setMotionIdleEnabled: (enabled: boolean) => void,
    setEyeBlinkEnabled: (enabled: boolean) => void,
    writeSleepParameters: SleepParameterWriter
  ): void {
    setMotionIdleEnabled(false)
    setEyeBlinkEnabled(false)

    this.sleeping = true
    this.drowsyTalking = false
    this.drowsyLingering = false
    this.sleepParameterWriter = writeSleepParameters
    // 从当前眼睛开合状态开始过渡，而不是直接设置为闭眼
    this.currentParameters = {
      ParamEyeLOpen: 1,
      ParamEyeROpen: 1,
      ParamEyeBallX: 0,
      ParamEyeBallY: 0,
      ParamAngleX: 0,
      ParamAngleY: 0
    }
    // 缓慢闭眼过渡，时长 1800ms
    this.setSleepParameterTarget(createClosedSleepParameters(), 1800)
    this.startSleepParameterLoop()
    this.clearDrowsyTimers()
    this.scheduleSleepMicroMotion()
    console.log('[Live2D] 进入睡眠待机状态')
  }

  /**
   * 退出睡眠状态。
   * @param setMotionIdleEnabled 是否启用 idle 动画的设置函数。
   * @param setEyeBlinkEnabled 是否启用眨眼的设置函数。
   * @param clearMotionFrame 清除动作覆盖的函数。
   */
  exitSleepMode(
    setMotionIdleEnabled: (enabled: boolean) => void,
    setEyeBlinkEnabled: (enabled: boolean) => void,
    clearMotionFrame: () => void
  ): void {
    this.sleeping = false
    this.drowsyTalking = false
    this.drowsyLingering = false
    this.stopSleepMicroMotion()
    this.clearDrowsyTimers()
    this.stopSleepParameterLoop()
    this.sleepParameterWriter = null
    setMotionIdleEnabled(true)
    setEyeBlinkEnabled(true)
    clearMotionFrame()
    console.log('[Live2D] 退出睡眠状态')
  }

  /**
   * 睡眠模式下开始对话时，让眼睛保持半睁并带有轻微游离视线。
   */
  startDrowsyTalkEyeMotion(): void {
    if (!this.sleeping) return

    this.stopSleepMicroMotion()
    this.clearDrowsyTimers()
    this.drowsyLingering = false
    this.drowsyTalking = true
    this.scheduleDrowsyTalkEyeMotion(0)
  }

  /**
   * 睡眠模式下对话结束时，停止半醒眼神并平滑闭眼回到睡眠。
   */
  stopDrowsyTalkEyeMotion(): void {
    this.clearDrowsyTalkTimer()

    if (!this.sleeping) return

    this.drowsyTalking = false
    this.startDrowsyLingeringMotion()
  }

  /**
   * 只清理半醒眼神计时器，不改变当前是否处于睡眠对话的状态。
   */
  private clearDrowsyTalkTimer(): void {
    if (this.drowsyTalkTimer) {
      clearTimeout(this.drowsyTalkTimer)
      this.drowsyTalkTimer = null
    }
  }

  /**
   * 清理所有半醒相关计时器，用于新对话、退出睡眠和销毁时取消旧状态。
   */
  private clearDrowsyTimers(): void {
    this.clearDrowsyTalkTimer()

    if (this.drowsyCloseTimer) {
      clearTimeout(this.drowsyCloseTimer)
      this.drowsyCloseTimer = null
    }

    if (this.drowsyBlinkTimer) {
      clearTimeout(this.drowsyBlinkTimer)
      this.drowsyBlinkTimer = null
    }
  }

  /**
   * 停止睡眠微动并清理计时器。
   * 退出睡眠或销毁模型时调用。
   */
  stopSleepMicroMotion(): void {
    if (this.sleepMicroMotionTimer) {
      clearTimeout(this.sleepMicroMotionTimer)
      this.sleepMicroMotionTimer = null
    }
  }

  /**
   * 停止所有睡眠表现循环和计时器。
   * 用于模型销毁时确保不会继续写入旧模型参数。
   */
  reset(): void {
    this.sleeping = false
    this.drowsyTalking = false
    this.drowsyLingering = false
    this.stopSleepMicroMotion()
    this.clearDrowsyTimers()
    this.stopSleepParameterLoop()
    this.sleepParameterWriter = null
  }

  /**
   * 立即写入当前睡眠参数。
   * Live2D 运行时每帧更新后调用一次，确保睡眠眼部状态拥有最终覆盖权。
   */
  flushSleepParameters(): void {
    if (!this.sleeping || !this.sleepParameterWriter) return

    this.sleepParameterWriter(this.currentParameters)
  }

  /**
   * 启动睡眠参数逐帧写入循环。
   */
  private startSleepParameterLoop(): void {
    if (this.sleepParameterFrameId !== null) return

    this.lastFrameAt = performance.now()
    const tick = (now: number): void => {
      if (!this.sleeping || !this.sleepParameterWriter) {
        this.sleepParameterFrameId = null
        return
      }

      const elapsedMs = Math.min(50, Math.max(0, now - this.lastFrameAt))
      this.lastFrameAt = now
      const progress = Math.min(1, elapsedMs / Math.max(60, this.transitionMs))
      const easedProgress = 1 - Math.pow(1 - progress, 3)

      for (const [paramId, targetValue] of Object.entries(this.targetParameters)) {
        const currentValue = this.currentParameters[paramId] ?? 0
        this.currentParameters[paramId] =
          currentValue + (targetValue - currentValue) * easedProgress
      }

      this.flushSleepParameters()
      this.sleepParameterFrameId = requestAnimationFrame(tick)
    }

    this.sleepParameterFrameId = requestAnimationFrame(tick)
  }

  /**
   * 停止睡眠参数逐帧写入循环。
   */
  private stopSleepParameterLoop(): void {
    if (this.sleepParameterFrameId !== null) {
      cancelAnimationFrame(this.sleepParameterFrameId)
      this.sleepParameterFrameId = null
    }
  }

  /**
   * 设置睡眠眼部目标参数。
   * @param parameters 目标参数集合。
   * @param transitionMs 过渡时长，单位毫秒。
   */
  private setSleepParameterTarget(parameters: Record<string, number>, transitionMs: number): void {
    this.targetParameters = parameters
    this.transitionMs = transitionMs
  }

  /**
   * 调度睡眠对话期间的半醒眼神。
   * 使用低频随机目标模拟刚醒时视线无法稳定聚焦的状态。
   * @param delayMs 距离下一次半醒眼神更新的延迟，单位毫秒。
   */
  private scheduleDrowsyTalkEyeMotion(delayMs: number): void {
    if (!this.sleeping || !this.drowsyTalking) return

    this.drowsyTalkTimer = setTimeout(() => {
      if (!this.sleeping || !this.drowsyTalking) return

      // 半醒对话时的基础眼睛开合度。
      const openness = 0.28 + Math.random() * 0.3
      // 左右眼开合差，避免眼神过于对称。
      const asymmetry = (Math.random() - 0.5) * 0.06
      // 眼球游移，模拟困倦时视线不稳定。
      const eyeBallX = (Math.random() - 0.5) * 0.34
      const eyeBallY = -0.1 + (Math.random() - 0.5) * 0.22

      this.setSleepParameterTarget(
        {
          ParamEyeLOpen: this.clamp(openness + asymmetry, 0.18, 0.78),
          ParamEyeROpen: this.clamp(openness - asymmetry, 0.18, 0.78),
          ParamEyeBallX: eyeBallX,
          ParamEyeBallY: eyeBallY,
          ParamAngleX: eyeBallX * 3,
          ParamAngleY: -1.5 + eyeBallY * 3
        },
        650 + Math.random() * 450
      )

      this.scheduleDrowsyTalkEyeMotion(900 + Math.random() * 1300)
    }, delayMs)
  }

  /**
   * 对话结束后保留一段半醒状态；若期间没有新对话，再慢慢闭眼。
   */
  private startDrowsyLingeringMotion(): void {
    this.clearDrowsyTimers()
    this.stopSleepMicroMotion()
    this.drowsyLingering = true
    this.scheduleDrowsyLingeringGaze(0)
    this.scheduleDrowsyLingeringBlink()

    this.drowsyCloseTimer = setTimeout(
      () => {
        if (!this.sleeping || this.drowsyTalking) return

        this.drowsyLingering = false
        this.setSleepParameterTarget(createClosedSleepParameters(-0.15), 1200)
        this.scheduleSleepMicroMotion()
      },
      6500 + Math.random() * 2500
    )
  }

  /**
   * 余醒阶段的轻微视线游移，避免对话结束后眼神僵住。
   * @param delayMs 调度下一次视线变动的延迟，单位毫秒。
   */
  private scheduleDrowsyLingeringGaze(delayMs: number): void {
    if (!this.sleeping || !this.drowsyLingering) return

    this.drowsyTalkTimer = setTimeout(() => {
      if (!this.sleeping || !this.drowsyLingering || this.drowsyTalking) return

      // 余醒阶段更轻微的开合与左右差。
      const openness = 0.22 + Math.random() * 0.12
      const asymmetry = (Math.random() - 0.5) * 0.05
      // 余醒阶段的轻微眼球游移。
      const eyeBallX = (Math.random() - 0.5) * 0.24
      const eyeBallY = -0.14 + (Math.random() - 0.5) * 0.14

      this.setSleepParameterTarget(
        {
          ParamEyeLOpen: this.clamp(openness + asymmetry, 0.14, 0.4),
          ParamEyeROpen: this.clamp(openness - asymmetry, 0.14, 0.4),
          ParamEyeBallX: eyeBallX,
          ParamEyeBallY: eyeBallY,
          ParamAngleX: eyeBallX * 2,
          ParamAngleY: -1.8 + eyeBallY * 2
        },
        700 + Math.random() * 500
      )

      this.scheduleDrowsyLingeringGaze(1000 + Math.random() * 1400)
    }, delayMs)
  }

  /**
   * 余醒阶段随机短暂闭眼，模拟困倦时撑着眼皮又快睡回去。
   */
  private scheduleDrowsyLingeringBlink(): void {
    if (!this.sleeping || !this.drowsyLingering) return

    this.drowsyBlinkTimer = setTimeout(
      () => {
        if (!this.sleeping || !this.drowsyLingering || this.drowsyTalking) return

        this.setSleepParameterTarget(
          {
            ...this.targetParameters,
            ParamEyeLOpen: 0.03,
            ParamEyeROpen: 0.03
          },
          140
        )

        window.setTimeout(
          () => {
            if (!this.sleeping || !this.drowsyLingering || this.drowsyTalking) return
            const openness = 0.2 + Math.random() * 0.12
            this.setSleepParameterTarget(
              {
                ...this.targetParameters,
                ParamEyeLOpen: openness,
                ParamEyeROpen: openness + (Math.random() - 0.5) * 0.04
              },
              360
            )
          },
          180 + Math.random() * 120
        )

        this.scheduleDrowsyLingeringBlink()
      },
      1600 + Math.random() * 2400
    )
  }

  /**
   * 调度下一次睡眠微动。
   */
  private scheduleSleepMicroMotion(): void {
    this.stopSleepMicroMotion()
    if (!this.sleeping || this.drowsyTalking || this.drowsyLingering) return

    const delayMs = 6000 + Math.random() * 14000
    this.sleepMicroMotionTimer = setTimeout(() => {
      if (!this.sleeping || this.drowsyTalking || this.drowsyLingering) return
      // console.log('[Live2D] 触发睡眠微动')

      this.setSleepParameterTarget(
        {
          ParamEyeLOpen: 0.1,
          ParamEyeROpen: 0.1
        },
        900
      )

      window.setTimeout(() => {
        if (!this.sleeping || this.drowsyTalking || this.drowsyLingering) return
        this.setSleepParameterTarget(createClosedSleepParameters(), 700)
      }, 1500)

      this.scheduleSleepMicroMotion()
    }, delayMs)
  }

  /**
   * 限制数值范围，避免随机眼睛参数过大导致睡眠表情突兀。
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }
}

/**
 * 创建闭眼睡眠参数，眼球轻微下沉会让闭眼回落更自然。
 */
function createClosedSleepParameters(eyeBallY: number = 0): Record<string, number> {
  return {
    ParamEyeLOpen: 0,
    ParamEyeROpen: 0,
    ParamEyeBallX: 0,
    ParamEyeBallY: eyeBallY,
    ParamAngleX: 0,
    ParamAngleY: 0
  }
}
