/**
 * 将 CubismIdHandle / csmString 规范化为字符串 ID。
 */
export function normalizeCubismId(idHandle: unknown): string | null {
  if (!idHandle) return null
  if (typeof idHandle === 'string') return idHandle

  // 常见形态：idHandle.getString().s
  if (
    typeof idHandle === 'object' &&
    idHandle !== null &&
    'getString' in idHandle &&
    typeof (idHandle as { getString?: unknown }).getString === 'function'
  ) {
    const raw = (idHandle as { getString: () => unknown }).getString()
    if (typeof raw === 'string') return raw
    if (
      raw &&
      typeof raw === 'object' &&
      's' in raw &&
      typeof (raw as { s?: unknown }).s === 'string'
    ) {
      return (raw as { s: string }).s
    }
  }

  const maybeToString = (idHandle as { toString?: unknown }).toString
  if (typeof maybeToString === 'function') {
    const value = maybeToString.call(idHandle)
    if (typeof value === 'string' && value !== '[object Object]') return value
  }

  return null
}
