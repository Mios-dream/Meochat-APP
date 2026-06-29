import type {
  ChatMotionChunk,
  Live2DMotionStep,
  SentenceAssemblyContext
} from '../ChatStreamProcessor'

/**
 * 动作 chunk 处理器。
 *
 * 负责清洗后端 Live2D 参数数据，支持新旧两种接口格式：
 * - 旧方案：每个 motion 提供参数关键帧（parameters + duration），播放层手动过渡。
 * - 新方案：每个 motion 提供完整参数曲线（curves + duration + fps），播放层逐帧播放。
 * 两种方案互不干扰，旧方案代码保留备用。
 */
export class MotionChunkHandler {
  public constructor(private readonly context: SentenceAssemblyContext) {}

  /**
   * 规范化并合并动作帧到对应 sentence_id 的同步状态。
   * 根据后端返回数据自动选择旧关键帧方案或新曲线方案。
   */
  public handle(data: ChatMotionChunk): void {
    const motionSequence = normalizeMotionFrame(data)
    const state = this.context.getSentenceState(data.sentence_id)
    state.motionSequence = motionSequence
    state.message = data.source_text
    state.motionChunkState = true
    this.context.setSentenceState(data.sentence_id, state)
  }
}

/**
 * 将后端动作帧规范化为播放层可直接消费的 Live2DMotionStep 数组。
 * 自动检测数据格式并选择对应处理逻辑：
 * - 包含 curves 字段 → 使用新曲线方案
 * - 包含 parameters 字段 → 使用旧关键帧方案（保留备用）
 */
function normalizeMotionFrame(data: ChatMotionChunk): Live2DMotionStep[] {
  if (!Array.isArray(data.motions) || data.motions.length === 0) {
    return []
  }

  const normalized: Live2DMotionStep[] = []

  for (const motion of data.motions) {
    if (!motion) continue

    // 新曲线方案：motion 包含 curves 字段
    if (motion.curves && Object.keys(motion.curves).length > 0) {
      const step = normalizeCurveMotion(motion)
      if (step) {
        normalized.push(step)
      }
      continue
    }

    // 旧关键帧方案：motion 包含 parameters 字段（保留备用）
    if (motion.parameters && Object.keys(motion.parameters).length > 0) {
      const step = normalizeKeyframeMotion(motion)
      if (step) {
        normalized.push(step)
      }
    }
  }

  return normalized
}

/**
 * 规范化新曲线方案的动作数据。
 * 直接透传 curves 数据和 fps 给播放层，由播放层负责帧率匹配和插值。
 */
function normalizeCurveMotion(motion: {
  duration?: number
  curves?: Record<string, number[]>
  fps?: number
  expression?: string[]
}): Live2DMotionStep | null {
  const curves = motion.curves
  if (!curves) return null

  // 验证所有曲线中的值是否为有效数字
  const cleanedCurves: Record<string, number[]> = {}
  let hasValidCurve = false

  for (const [paramId, values] of Object.entries(curves)) {
    if (!Array.isArray(values) || values.length === 0) continue

    const validValues: number[] = []
    for (const v of values) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        validValues.push(v)
      }
    }

    if (validValues.length > 0) {
      cleanedCurves[paramId] = validValues
      hasValidCurve = true
    }
  }

  if (!hasValidCurve) return null

  const durationMs = clampMotionDuration(motion.duration)
  const fps =
    typeof motion.fps === 'number' && Number.isFinite(motion.fps) && motion.fps > 0
      ? motion.fps
      : 30

  return {
    durationMs,
    curves: cleanedCurves,
    fps,
    expression: motion.expression
  }
}

/**
 * 规范化旧关键帧方案的动作数据（保留备用）。
 * 将 parameters 映射转换为播放层可消费的 Live2DMotionStep。
 */
function normalizeKeyframeMotion(motion: {
  duration?: number
  parameters?: Record<string, number>
  expression?: string[]
}): Live2DMotionStep | null {
  if (!motion.parameters) return null

  const params: Record<string, number> = {}

  for (const [paramId, rawValue] of Object.entries(motion.parameters)) {
    if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) continue
    params[paramId] = rawValue
  }

  if (Object.keys(params).length === 0) return null

  return {
    durationMs: clampMotionDuration(motion.duration),
    parameters: params,
    expression: motion.expression
  }
}

/** 将动作持续时间限制在安全范围内，避免过短闪烁或过长卡住后续句子。 */
function clampMotionDuration(durationMs?: number): number {
  const defaultDuration = 700
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return defaultDuration
  }

  return Math.max(120, Math.min(8000, durationMs))
}
