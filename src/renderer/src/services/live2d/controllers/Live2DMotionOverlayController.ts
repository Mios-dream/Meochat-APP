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
    easing: 'easeOutCubic',
    releaseMs: 700,
    releaseTargetValue: 1
  },
  ParamEyeROpen: {
    transitionMs: 130,
    easing: 'easeOutCubic',
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
  /**
   * 覆盖层默认保持时长（毫秒）。
   * 未提供 holdMs 时使用该值。
   */
  private readonly overlayDurationMs = 2000
  /** 动作覆盖层当前值（持续插值写入）。 */
  private motionCurrentParams: Record<string, number> = {}
  /** 动作覆盖层目标值（进入态）。 */
  private motionTargetParams: Record<string, number> = {}
  /** 动作覆盖层保持截止时间戳（performance.now）。 */
  private motionHoldUntil = 0
  /** 动作覆盖层上次 tick 的时间戳。 */
  private motionLastTickAt = 0
  /** 动作覆盖层自定义过渡时长（毫秒），为空则使用参数配置。 */
  private motionTransitionMs: number | null = null
  /** 动作覆盖层释放阶段目标值（未指定时走默认释放目标）。 */
  private motionReleaseTargetParams: Record<string, number> = {}

  /** 表情覆盖层当前值（持续插值写入）。 */
  private expressionCurrentParams: Record<string, number> = {}
  /** 表情覆盖层目标值（进入态）。 */
  private expressionTargetParams: Record<string, number> = {}
  /** 表情覆盖层保持截止时间戳（performance.now）。 */
  private expressionHoldUntil = 0
  /** 表情覆盖层上次 tick 的时间戳。 */
  private expressionLastTickAt = 0
  /** 表情覆盖层自定义过渡时长（毫秒），为空则使用参数配置。 */
  private expressionTransitionMs: number | null = null
  /** 表情覆盖层释放阶段目标值（未指定时走默认释放目标）。 */
  private expressionReleaseTargetParams: Record<string, number> = {}

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
    // 语音播放期间口型由语音控制器独占，动作覆盖层不可写入口型参数。
    const speakingBlockedParams = new Set(['ParamMouthOpenY'])

    for (const [paramId, rawValue] of Object.entries(parameters)) {
      // 参数值必须是有效数字，跳过无效值。
      if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) {
        console.warn(`[Live2DMotionOverlayController] 参数值无效 ${paramId}:`, rawValue)
        continue
      }
      // 语音播放期间口型由语音控制器独占，避免动作帧抢写。
      if (isSpeaking && speakingBlockedParams.has(paramId)) {
        // console.warn(`[Live2DMotionOverlayController] 跳过锁定的参数 ${paramId}:`, rawValue)
        continue
      }
      if (!hasModelParameter(coreModel, paramId)) {
        // console.warn(`[Live2DMotionOverlayController] 模型没有这个参数 ${paramId}, skipping.`)
        continue
      }

      const modelValue = getModelParameterValue(coreModel, paramId)
      if (modelValue === null) {
        console.warn(`[Live2DMotionOverlayController] 获取参数 ${paramId} 的当前值失败，跳过。`)
        continue
      }

      targetParams[paramId] = rawValue
      // 始终从模型当前真实值出发，避免因残留释放阶段或外部系统修改导致起始值不同步。
      this.motionCurrentParams[paramId] = modelValue
    }
    // console.log('[Live2DMotionOverlayController] 处理动作帧参数:', targetParams)

    if (Object.keys(targetParams).length === 0) return

    const transitionMs = options?.transitionMs
    // 允许调用方覆盖参数过渡时长。
    // 最小值设为 0，支持曲线逐帧播放时的瞬时写入模式。
    this.motionTransitionMs =
      typeof transitionMs === 'number' && Number.isFinite(transitionMs)
        ? this.clampDuration(transitionMs, 0, 2000)
        : null

    // 保持时长到期后进入释放阶段，回落到 releaseTarget。
    // 最小值设为曲线播放帧间隔，保证逐帧模式每次写入在下一帧前不会被释放。
    const holdDuration = this.clampDuration(options?.holdMs ?? this.overlayDurationMs, 16, 10000)
    this.motionTargetParams = targetParams
    this.motionReleaseTargetParams = options?.releaseTargetParams ?? {}
    this.motionHoldUntil = performance.now() + holdDuration
  }

  /**
   * 应用表情帧参数。
   * 表情覆盖层独立于动作覆盖层，避免互相覆盖。
   */
  applyExpressionFrame(
    parameters: Record<string, number>,
    coreModel: unknown,
    options?: MotionFrameOptions
  ): void {
    if (!parameters || !coreModel) return

    const targetParams: Record<string, number> = {}

    for (const [paramId, rawValue] of Object.entries(parameters)) {
      if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) {
        console.warn(`[Live2DMotionOverlayController] 表情参数无效 ${paramId}:`, rawValue)
        continue
      }
      if (!hasModelParameter(coreModel, paramId)) {
        // console.warn(`[Live2DMotionOverlayController] 模型没有这个参数 ${paramId}, skipping.`)
        continue
      }

      const modelValue = getModelParameterValue(coreModel, paramId)
      if (modelValue === null) {
        console.warn(`[Live2DMotionOverlayController] 获取参数 ${paramId} 的当前值失败，跳过。`)
        continue
      }

      targetParams[paramId] = rawValue
      // 始终从模型当前真实值出发，避免因残留释放阶段或外部系统修改导致起始值不同步。
      this.expressionCurrentParams[paramId] = modelValue
    }

    if (Object.keys(targetParams).length === 0) return

    const transitionMs = options?.transitionMs
    // 表情层过渡时长与动作层解耦，避免互相影响。
    // 最小值统一为 0，与动作层保持一致。
    this.expressionTransitionMs =
      typeof transitionMs === 'number' && Number.isFinite(transitionMs)
        ? this.clampDuration(transitionMs, 0, 2000)
        : null

    const holdDuration = this.clampDuration(options?.holdMs ?? this.overlayDurationMs, 16, 10000)
    this.expressionTargetParams = targetParams
    this.expressionReleaseTargetParams = options?.releaseTargetParams ?? {}
    this.expressionHoldUntil = performance.now() + holdDuration
  }

  /**
   * 清除当前动作帧覆盖，保留释放阶段的平滑恢复。
   *
   * 不再清理 releaseTargetParams，保持其原有的释放目标，
   * 避免因恢复默认值而在睡眠模式下眼睛错误睁开。
   *
   * @param hasModel 当前模型是否存在；如果模型已销毁则直接重置全部状态。
   */
  clearMotionFrame(hasModel: boolean): void {
    if (!hasModel) {
      this.reset()
      return
    }

    // 保留当前值用于释放阶段的平滑回落。
    this.motionTargetParams = {}
    this.motionHoldUntil = 0
    this.motionTransitionMs = null
  }

  /**
   * 清除当前表情帧覆盖，保留释放阶段的平滑恢复。
   *
   * 不再清理 releaseTargetParams，保持其原有的释放目标。
   */
  clearExpressionFrame(hasModel: boolean): void {
    if (!hasModel) {
      this.reset()
      return
    }

    // 保留当前值用于释放阶段的平滑回落。
    this.expressionTargetParams = {}
    this.expressionHoldUntil = 0
    this.expressionTransitionMs = null
  }

  /**
   * 返回当前被动作层或表情层管理的所有参数 ID 集合。
   * 包含正在进行进入过渡、保持中和释放阶段的参数。
   * @returns 活跃参数 ID 集合。
   */
  getActiveParameterIds(): Set<string> {
    const ids = new Set<string>()
    for (const key of Object.keys(this.motionCurrentParams)) ids.add(key)
    for (const key of Object.keys(this.motionTargetParams)) ids.add(key)
    for (const key of Object.keys(this.expressionCurrentParams)) ids.add(key)
    for (const key of Object.keys(this.expressionTargetParams)) ids.add(key)
    return ids
  }

  /**
   * 重置所有覆盖层状态，通常在模型销毁或切换时调用。
   */
  reset(): void {
    this.motionCurrentParams = {}
    this.motionTargetParams = {}
    this.motionReleaseTargetParams = {}
    this.motionHoldUntil = 0
    this.motionLastTickAt = 0
    this.motionTransitionMs = null

    this.expressionCurrentParams = {}
    this.expressionTargetParams = {}
    this.expressionReleaseTargetParams = {}
    this.expressionHoldUntil = 0
    this.expressionLastTickAt = 0
    this.expressionTransitionMs = null
  }

  /**
   * 每帧更新动作参数覆盖层并应用到模型。
   * @param now 当前时间戳，通常来自 performance.now()。
   * @param coreModel Live2D/Cubism 核心模型对象，用于最终参数写入。
   */
  tick(now: number, coreModel: unknown): void {
    if (!coreModel) return

    // 动作层先写入，随后表情层覆盖到最终参数。
    this.tickOverlay(
      coreModel,
      now,
      this.motionCurrentParams,
      this.motionTargetParams,
      this.motionReleaseTargetParams,
      (value) => (this.motionLastTickAt = value),
      () => this.motionHoldUntil,
      () => this.motionLastTickAt,
      () => this.motionTransitionMs
    )

    this.tickOverlay(
      coreModel,
      now,
      this.expressionCurrentParams,
      this.expressionTargetParams,
      this.expressionReleaseTargetParams,
      (value) => (this.expressionLastTickAt = value),
      () => this.expressionHoldUntil,
      () => this.expressionLastTickAt,
      () => this.expressionTransitionMs
    )
  }

  private tickOverlay(
    coreModel: unknown,
    now: number,
    overlayCurrentParams: Record<string, number>,
    overlayTargetParams: Record<string, number>,
    overlayReleaseTargetParams: Record<string, number>,
    setLastTickAt: (value: number) => void,
    getHoldUntil: () => number,
    getLastTickAt: () => number,
    getTransitionMs: () => number | null
  ): void {
    // 避免超大 dt 导致插值跳变，最大 50ms。
    const rawDt = getLastTickAt() > 0 ? now - getLastTickAt() : 16
    setLastTickAt(now)
    const dt = Math.min(rawDt, 50) / 1000
    const isHolding = now <= getHoldUntil()

    const trackedIds = new Set<string>([
      ...Object.keys(overlayCurrentParams),
      ...Object.keys(overlayTargetParams)
    ])

    if (trackedIds.size === 0) return

    for (const paramId of trackedIds) {
      const cfg = PARAM_CONFIG[paramId] ?? DEFAULT_PARAM_CONFIG
      // 进入期使用 transitionMs，释放期使用 releaseMs。
      const transMs = isHolding ? (getTransitionMs() ?? cfg.transitionMs) : cfg.releaseMs
      const easingFn = EASING_FUNCTIONS[cfg.easing]
      const currentValue = overlayCurrentParams[paramId] ?? 0
      const releaseTarget = overlayReleaseTargetParams[paramId] ?? cfg.releaseTargetValue ?? 0
      const targetValue = isHolding ? (overlayTargetParams[paramId] ?? 0) : releaseTarget
      const rawProgress = Math.min(1, dt / (transMs / 1000))
      const easedProgress = easingFn(rawProgress)
      const nextValue = currentValue + (targetValue - currentValue) * easedProgress

      // 释放阶段接近目标值后清理当前参数，避免持续计算。
      if (!isHolding && Math.abs(nextValue - releaseTarget) < 0.005) {
        setModelParameterValue(coreModel, paramId, releaseTarget)
        delete overlayCurrentParams[paramId]
        continue
      }

      overlayCurrentParams[paramId] = nextValue
      setModelParameterValue(coreModel, paramId, nextValue)
    }

    // 释放阶段结束后清空目标集合，等待下一次覆盖。
    // 注意：不清理 overlayReleaseTargetParams，因为释放过程可能持续多帧，
    // 中途清空会导致后续帧回退到配置默认释放目标，造成中途逆转。
    if (!isHolding) {
      for (const key of Object.keys(overlayTargetParams)) {
        delete overlayTargetParams[key]
      }
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
