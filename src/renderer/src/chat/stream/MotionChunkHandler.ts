import type {
  ChatMotionChunk,
  Live2DMotionStep,
  SentenceAssemblyContext
} from '../ChatStreamProcessor'

/**
 * 动作 chunk 处理器。
 *
 * 负责清洗后端 Live2D 参数帧，并把同一句的多段动作合并为连续动作序列。
 */
export class MotionChunkHandler {
  public constructor(private readonly context: SentenceAssemblyContext) {}

  /** 规范化并合并动作帧到对应 sentence_id 的同步状态。 */
  public handle(data: ChatMotionChunk): void {
    const motionSequence = normalizeMotionFrame(data)
    const state = this.context.getSentenceState(data.sentence_id)
    state.motionSequence = motionSequence
    state.message = data.source_text
    state.motionChunkState = true
    this.context.setSentenceState(data.sentence_id, state)
  }
}

/** 将后端动作帧规范化为播放层可直接消费的 Live2DMotionStep 数组。 */
function normalizeMotionFrame(data: ChatMotionChunk): Live2DMotionStep[] {
  const normalized: Live2DMotionStep[] = []

  if (!Array.isArray(data.motions) || data.motions.length === 0) {
    return normalized
  }

  for (const motion of data.motions) {
    if (!motion || !motion.parameters) continue

    const params: Record<string, number> = {}

    for (const [paramId, rawValue] of Object.entries(motion.parameters)) {
      if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) continue
      params[paramId] = rawValue
    }

    if (Object.keys(params).length === 0) continue

    normalized.push({
      durationMs: clampMotionDuration(motion.duration),
      parameters: params
    })
  }

  return normalized
}

/** 将动作持续时间限制在安全范围内，避免过短闪烁或过长卡住后续句子。 */
function clampMotionDuration(durationMs?: number): number {
  const defaultDuration = 700
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return defaultDuration
  }

  return Math.max(120, Math.min(8000, durationMs))
}
