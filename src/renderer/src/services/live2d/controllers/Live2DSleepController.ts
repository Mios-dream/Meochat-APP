import type { MotionFrameOptions } from '../types'

/**
 * 负责 Live2D 睡眠模式、眼部状态和低频睡眠微动。
 * 外部在调用时显式传入当前模型是否存在，以及需要执行的状态更新函数，保持依赖简单直接。
 */
export class Live2DSleepController {
  private sleeping = false
  private sleepMicroMotionTimer: ReturnType<typeof setTimeout> | null = null

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
   * @param applyMotionFrame 睡眠微动使用的动作帧应用函数。
   */
  enterSleepMode(
    setMotionIdleEnabled: (enabled: boolean) => void,
    setEyeBlinkEnabled: (enabled: boolean) => void,
    setEyeOpenValue: (value: number) => void,
    applyMotionFrame: (parameters: Record<string, number>, options?: MotionFrameOptions) => void
  ): void {
    setMotionIdleEnabled(false)
    setEyeBlinkEnabled(false)
    setEyeOpenValue(0)
    this.sleeping = true
    this.scheduleSleepMicroMotion(applyMotionFrame)
    console.log('[Live2D] 进入睡眠待机状态')
  }

  /**
   * 退出睡眠状态。
   * @param hasModel 当前模型是否存在。
   * @param setMotionIdleEnabled 是否启用 idle 动画的设置函数。
   * @param clearMotionFrame 清除动作覆盖的函数。
   */
  exitSleepMode(
    setMotionIdleEnabled: (enabled: boolean) => void,
    clearMotionFrame: () => void
  ): void {
    this.sleeping = false
    this.stopSleepMicroMotion()
    setMotionIdleEnabled(true)
    clearMotionFrame()
    console.log('[Live2D] 退出睡眠状态')
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
   * 调度下一次睡眠微动。
   */
  private scheduleSleepMicroMotion(
    applyMotionFrame: (parameters: Record<string, number>, options?: MotionFrameOptions) => void
  ): void {
    this.stopSleepMicroMotion()
    if (!this.sleeping) return

    const delayMs = 6000 + Math.random() * 14000
    this.sleepMicroMotionTimer = setTimeout(() => {
      if (!this.sleeping) return
      console.log('[Live2D] 触发睡眠微动')
      applyMotionFrame(
        {
          ParamEyeLOpen: 30,
          ParamEyeROpen: 30
        },
        {
          transitionMs: 200,
          holdMs: 900,
          releaseTargetParams: {
            ParamEyeLOpen: 0,
            ParamEyeROpen: 0
          }
        }
      )
      this.scheduleSleepMicroMotion(applyMotionFrame)
    }, delayMs)
  }
}
