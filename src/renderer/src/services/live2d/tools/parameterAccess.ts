import { normalizeCubismId } from './cubismId'

interface ParameterIndexLike {
  getParameterCount?: () => number
  getParameterId?: (index: number) => unknown
  getParameterIndex?: (parameterId: unknown) => number
  getParameterValueByIndex?: (index: number) => number
  getParameterValue?: (index: number) => number
  setParameterValue?: (index: number, value: number) => void
  setParameterValueByIndex?: (index: number, value: number, weight?: number) => void
}

/**
 * 从 coreModel 中解析参数 ID 对应的真实索引。
 * 某些 Cubism 运行时的 getParameterIndex 需要 CubismIdHandle，
 * 直接传字符串会落入 not-exist 参数槽，导致写入看似成功但不生效。
 * @param coreModel Live2D/Cubism 运行时的核心模型对象。
 * @param paramId 需要查找的参数 ID，例如 ParamMouthOpenY。
 * @returns 参数真实索引；不存在时返回 -1。
 */
export function resolveParameterIndex(coreModel: unknown, paramId: string): number {
  if (!coreModel || !paramId || typeof coreModel !== 'object') return -1

  const modelLike = coreModel as ParameterIndexLike

  // 优先按参数列表逐项比对，确保字符串 ID 在不同运行时都能命中真实参数
  if (
    typeof modelLike.getParameterCount === 'function' &&
    typeof modelLike.getParameterId === 'function'
  ) {
    const count = modelLike.getParameterCount()
    for (let i = 0; i < count; i++) {
      const idHandle = modelLike.getParameterId(i)
      const idString = normalizeCubismId(idHandle)
      if (idString === paramId) return i
    }
  }

  // 兜底：若运行时支持字符串 getParameterIndex 且会返回真实索引，继续兼容
  if (typeof modelLike.getParameterIndex === 'function') {
    const fallbackIndex = modelLike.getParameterIndex(paramId)
    const count =
      typeof modelLike.getParameterCount === 'function' ? modelLike.getParameterCount() : 0
    if (typeof fallbackIndex === 'number' && fallbackIndex >= 0 && fallbackIndex < count) {
      return fallbackIndex
    }
  }

  return -1
}

/**
 * 获取模型参数值，兼容不同版本的 Live2D 运行时 API。
 * @param coreModel Live2D/Cubism 运行时的核心模型对象。
 * @param paramId 需要读取的参数 ID。
 * @returns 参数当前值；参数不存在或运行时不支持读取时返回 null。
 */
export function getModelParameterValue(coreModel: unknown, paramId: string): number | null {
  if (!coreModel) return null

  const modelLike = coreModel as ParameterIndexLike
  const paramIndex = resolveParameterIndex(coreModel, paramId)
  if (paramIndex < 0) return null

  if (typeof modelLike.getParameterValueByIndex === 'function') {
    return modelLike.getParameterValueByIndex(paramIndex)
  }

  if (typeof modelLike.getParameterValue === 'function') {
    return modelLike.getParameterValue(paramIndex)
  }

  return null
}

/**
 * 检查模型是否具有指定的参数 ID。
 * @param coreModel Live2D/Cubism 运行时的核心模型对象。
 * @param paramId 需要检查的参数 ID。
 * @returns 模型是否存在该参数。
 */
export function hasModelParameter(coreModel: unknown, paramId: string): boolean {
  try {
    return resolveParameterIndex(coreModel, paramId) >= 0
  } catch {
    return false
  }
}

/**
 * 将参数值写入模型，兼容不同版本的 Live2D 运行时 API。
 * @param coreModel Live2D/Cubism 运行时的核心模型对象。
 * @param paramId 需要写入的参数 ID。
 * @param value 要写入的参数值。
 * @returns 参数写入是否成功；运行时缺少写入 API 时会输出警告。
 */
export function setModelParameterValue(
  coreModel: unknown,
  paramId: string,
  value: number
): boolean {
  if (!coreModel) return false

  const modelLike = coreModel as ParameterIndexLike
  const paramIndex = resolveParameterIndex(coreModel, paramId)
  if (paramIndex < 0) return false

  if (typeof modelLike.setParameterValue === 'function') {
    modelLike.setParameterValue(paramIndex, value)
    return true
  }

  if (typeof modelLike.setParameterValueByIndex === 'function') {
    modelLike.setParameterValueByIndex(paramIndex, value, 1)
    return true
  }

  console.warn(
    `无法设置参数 ${paramId}，运行时不支持 setParameterValue 或 setParameterValueByIndex`
  )
  return true
}
