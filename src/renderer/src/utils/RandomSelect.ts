/**
 * 从迭代器中随机选择一个元素
 * @param ite 可迭代对象
 * @returns 随机选择的元素
 */
function randomSelect<T>(ite: Iterable<T>): T | null {
  const items = Array.from(ite)
  if (items.length === 0) return null
  const randomIndex = Math.floor(Math.random() * items.length)
  return items[randomIndex]
}

export default randomSelect
