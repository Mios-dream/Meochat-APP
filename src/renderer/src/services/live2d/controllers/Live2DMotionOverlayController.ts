import type { MotionFrameOptions } from '../types'
import {
  getModelParameterValue,
  hasModelParameter,
  setModelParameterValue
} from '../tools/parameterAccess'

type EasingName = keyof typeof EASING_FUNCTIONS

interface ParamConfig {
  transitionMs: number
  easing: EasingName
  releaseMs: number
  releaseTargetValue?: number
}

/**
 * 缓动函数集合。
 * key 与参数配置中的 easing 字段一一对应。
 */
const EASING_FUNCTIONS = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => {
    const s = t - 1
    return s * s * s + 1
  },
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  bounce: (t: number) => {
    if (t < 1 / 2.75) return 7.5625 * t * t
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
  }
}

/**
 * 每个参数的独立过渡配置。
 * 这里按参数粒度区分进入过渡、释放过渡和释放目标值，避免统一参数导致表情和眼睛动作过硬。
 */
const PARAM_CONFIG: Record<string, ParamConfig> = {
  ParamEyeBallX: {
    transitionMs: 80,
    easing: 'easeOutCubic',
    releaseMs: 500,
    releaseTargetValue: 0
  },
  ParamEyeBallY: {
    transitionMs: 80,
    easing: 'easeOutCubic',
    releaseMs: 500,
    releaseTargetValue: 0
  },
  ParamEyeLOpen: {
    transitionMs: 130,
    easing: 'easeInCubic',
    releaseMs: 700,
    releaseTargetValue: 1
  },
  ParamEyeROpen: {
    transitionMs: 130,
    easing: 'easeInCubic',
    releaseMs: 700,
    releaseTargetValue: 1
  }
}

const DEFAULT_PARAM_CONFIG: Required<ParamConfig> = {
  transitionMs: 220,
  easing: 'linear',
  releaseMs: 1000,
  releaseTargetValue: 0
}

/**
 * 负责 Live2D 动作帧参数叠加、平滑过渡和释放恢复。
 * 该控制器只保存覆盖层的状态，不直接持有模型引用，调用时通过 coreModel 注入。
 */
export class Live2DMotionOverlayController {
  private readonly overlayDurationMs = 2000
  private overlayCurrentParams: Record<string, number> = {}
  private overlayTargetParams: Record<string, number> = {}
  private overlayHoldUntil = 0
  private overlayLastTickAt = 0
  private overlayTransitionMs: number | null = null
  private overlayReleaseTargetParams: Record<string, number> = {}

  /**
   * 应用动作帧参数。
   * 该方法会过滤非法参数、说话中冲突参数和模型中不存在的参数，然后再写入覆盖层状态。
   */
  applyMotionFrame(
    parameters: Record<string, number>,
    coreModel: unknown,
    isSpeaking: boolean,
    options?: MotionFrameOptions
  ): void {
    if (!parameters || !coreModel) return

    const targetParams: Record<string, number> = {}
    const speakingBlockedParams = new Set(['ParamMouthOpenY'])

    for (const [paramId, rawValue] of Object.entries(parameters)) {
      // 参数值必须是有效数字，跳过无效值。
      if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) continue
      // 语音播放期间口型由语音控制器独占，避免动作帧抢写。
      if (isSpeaking && speakingBlockedParams.has(paramId)) continue
      if (!hasModelParameter(coreModel, paramId)) continue

      const modelValue = getModelParameterValue(coreModel, paramId)
      if (modelValue === null) continue

      targetParams[paramId] = rawValue
      if (!(paramId in this.overlayCurrentParams)) {
        this.overlayCurrentParams[paramId] = modelValue
      }
    }

    if (Object.keys(targetParams).length === 0) return

    const transitionMs = options?.transitionMs
    this.overlayTransitionMs =
      typeof transitionMs === 'number' && Number.isFinite(transitionMs)
        ? this.clampDuration(transitionMs, 60, 2000)
        : null

    const holdDuration = this.clampDuration(options?.holdMs ?? this.overlayDurationMs, 300, 10000)
    this.overlayTargetParams = targetParams
    this.overlayReleaseTargetParams = options?.releaseTargetParams ?? {}
    this.overlayHoldUntil = performance.now() + holdDuration
  }

  /**
   * 清除当前动作帧覆盖，保留释放阶段的平滑恢复。
   * @param hasModel 当前模型是否存在；如果模型已销毁则直接重置全部状态。
   */
  clearMotionFrame(hasModel: boolean): void {
    if (!hasModel) {
      this.reset()
      return
    }

    this.overlayTargetParams = {}
    this.overlayReleaseTargetParams = {}
    this.overlayHoldUntil = 0
    this.overlayTransitionMs = null
  }

  /**
   * 重置所有覆盖层状态，通常在模型销毁或切换时调用。
   */
  reset(): void {
    this.overlayCurrentParams = {}
    this.overlayTargetParams = {}
    this.overlayReleaseTargetParams = {}
    this.overlayHoldUntil = 0
    this.overlayLastTickAt = 0
    this.overlayTransitionMs = null
  }

  /**
   * 每帧更新动作参数覆盖层并应用到模型。
   * @param now 当前时间戳，通常来自 performance.now()。
   * @param coreModel Live2D/Cubism 核心模型对象，用于最终参数写入。
   */
  tick(now: number, coreModel: unknown): void {
    if (!coreModel) return

    const rawDt = this.overlayLastTickAt > 0 ? now - this.overlayLastTickAt : 16
    this.overlayLastTickAt = now
    const dt = Math.min(rawDt, 50) / 1000
    const isHolding = now <= this.overlayHoldUntil

    const trackedIds = new Set<string>([
      ...Object.keys(this.overlayCurrentParams),
      ...Object.keys(this.overlayTargetParams)
    ])

    if (trackedIds.size === 0) return

    for (const paramId of trackedIds) {
      const cfg = PARAM_CONFIG[paramId] ?? DEFAULT_PARAM_CONFIG
      const transMs = isHolding ? (this.overlayTransitionMs ?? cfg.transitionMs) : cfg.releaseMs
      const easingFn = EASING_FUNCTIONS[cfg.easing]
      const currentValue = this.overlayCurrentParams[paramId] ?? 0
      const releaseTarget = this.overlayReleaseTargetParams[paramId] ?? cfg.releaseTargetValue ?? 0
      const targetValue = isHolding ? (this.overlayTargetParams[paramId] ?? 0) : releaseTarget
      const rawProgress = Math.min(1, dt / (transMs / 1000))
      const easedProgress = easingFn(rawProgress)
      const nextValue = currentValue + (targetValue - currentValue) * easedProgress

      if (!isHolding && Math.abs(nextValue - releaseTarget) < 0.005) {
        setModelParameterValue(coreModel, paramId, releaseTarget)
        delete this.overlayCurrentParams[paramId]
        continue
      }

      this.overlayCurrentParams[paramId] = nextValue
      setModelParameterValue(coreModel, paramId, nextValue)
    }

    if (!isHolding) {
      this.overlayTargetParams = {}
      this.overlayReleaseTargetParams = {}
    }
  }

  /**
   * 限制持续时间在合理范围内。
   */
  private clampDuration(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min
    return Math.max(min, Math.min(max, value))
  }
}
