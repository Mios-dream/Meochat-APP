/** 将100以内的值归一化到0-1范围，其他值保持不变，非有限值默认归一化为0.8
 * @param value 需要归一化的数值
 * @returns 归一化后的数值
 */
export function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.8
  }

  if (value > 1 && value <= 100) {
    return Math.max(0, Math.min(1, value / 100))
  }

  return Math.max(0, Math.min(1, value))
}
