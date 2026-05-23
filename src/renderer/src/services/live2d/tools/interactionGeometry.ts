import type { Live2DModel } from 'untitled-pixi-live2d-engine'

export interface ModelScreenBounds {
  /** 模型包围盒左边界，单位为 CSS 像素。 */
  left: number
  /** 模型包围盒上边界，单位为 CSS 像素。 */
  top: number
  /** 模型包围盒右边界，单位为 CSS 像素。 */
  right: number
  /** 模型包围盒下边界，单位为 CSS 像素。 */
  bottom: number
}

/**
 * 获取模型在屏幕空间的包围盒（CSS像素坐标）。
 * @param model 当前 Live2D 模型实例。
 * @returns 模型包围盒；模型不存在时返回 null。
 */
export function getModelScreenBounds(model: Live2DModel | null): ModelScreenBounds | null {
  if (!model) return null
  const bounds = model.getBounds()
  return {
    left: bounds.minX,
    top: bounds.minY,
    right: bounds.maxX,
    bottom: bounds.maxY
  }
}

/**
 * 判断 canvas 相对坐标是否位于模型头部区域（顶部 25%）。
 * @param model 当前 Live2D 模型实例。
 * @param cssX 鼠标在 canvas 内的 X 坐标，单位为 CSS 像素。
 * @param cssY 鼠标在 canvas 内的 Y 坐标，单位为 CSS 像素。
 * @returns 坐标是否落在模型头部区域。
 */
export function isPositionOnModelHead(
  model: Live2DModel | null,
  cssX: number,
  cssY: number
): boolean {
  const bounds = getModelScreenBounds(model)
  if (!bounds) return false
  if (cssX < bounds.left || cssX > bounds.right || cssY < bounds.top || cssY > bounds.bottom) {
    return false
  }
  const relativeY = (cssY - bounds.top) / (bounds.bottom - bounds.top)
  return relativeY <= 0.25
}

/**
 * 根据 canvas 相对坐标映射到身体部位。
 * 简单划分：顶部 15% 为头部，15%-25% 为脸部，25%-70% 为身体（左右 25% 为手），70%-底部为腿部。
 * @param model 当前 Live2D 模型实例。
 * @param cssX 鼠标在 canvas 内的 X 坐标，单位为 CSS 像素。
 * @param cssY 鼠标在 canvas 内的 Y 坐标，单位为 CSS 像素。
 * @returns 命中的身体部位；未命中模型时返回 null。
 */
export function getBodyPartAtPosition(
  model: Live2DModel | null,
  cssX: number,
  cssY: number
): string | null {
  const bounds = getModelScreenBounds(model)
  if (!bounds) return null
  if (cssX < bounds.left || cssX > bounds.right || cssY < bounds.top || cssY > bounds.bottom) {
    return null
  }
  const modelWidth = bounds.right - bounds.left
  const relativeY = (cssY - bounds.top) / (bounds.bottom - bounds.top)
  const relativeX = (cssX - bounds.left) / modelWidth

  if (relativeY <= 0.15) return 'head'
  if (relativeY <= 0.25) return 'face'
  if (relativeY <= 0.7) {
    return relativeX <= 0.25 || relativeX >= 0.75 ? 'hand' : 'body'
  }
  return 'leg'
}
