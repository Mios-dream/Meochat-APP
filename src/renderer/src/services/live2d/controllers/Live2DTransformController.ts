import type { Application } from 'pixi.js'
import type { Live2DModel } from 'untitled-pixi-live2d-engine'

/**
 * 负责 Live2D 模型位置、缩放和锁定状态。
 * 该控制器只保存缩放与锁定的局部状态，模型和应用实例由调用方传入。
 */
export class Live2DTransformController {
  private currentScale = 1
  private readonly minScale = 0.1
  private readonly maxScale = 2
  private readonly scaleStep = 0.05
  private locked = false

  /**
   * 重置模型到初始位置和缩放。
   *
   * 使用 getLocalBounds 计算模型实际内容区域，再设置 pivot 使内容视觉中心对齐画布中心。
   *
   * @param model 当前 Live2D 模型。
   * @param app   Pixi 应用实例，用于读取舞台尺寸。
   */
  resetModelTransform(model: Live2DModel | null, app: Application | null): void {
    if (!model || !app) return

    const displayWidth = app.renderer.width
    const displayHeight = app.renderer.height

    // 先重置缩放到 1，获取准确的原始尺寸
    model.scale.set(1)

    // ---------- 获取模型尺寸 ----------
    const localBounds = model.getLocalBounds()
    const modelWidth = localBounds.width
    const modelHeight = localBounds.height

    // ---------- 计算适配缩放 ----------
    const scaleX = displayWidth / modelWidth
    const scaleY = displayHeight / modelHeight
    const optimalScale = Math.min(scaleX, scaleY) * 0.9

    this.currentScale = optimalScale
    model.scale.set(optimalScale)

    // ---------- 精确居中：基于 localBounds 计算 pivot ----------
    model.pivot.set(localBounds.x + localBounds.width / 2, localBounds.y + localBounds.height / 2)

    model.position.set(app.screen.width / 2, app.screen.height / 2)
  }

  /**
   * 获取当前模型缩放值。
   * @returns 当前缩放值。
   */
  getModelScale(): number {
    return this.currentScale
  }

  /**
   * 获取鼠标滚轮缩放步长。
   * @returns 每次滚轮调整使用的步长。
   */
  getScaleStep(): number {
    return this.scaleStep
  }

  /**
   * 根据缩放步长调整模型缩放值。
   * @param model 当前 Live2D 模型。
   * @param delta 缩放增量，正数放大、负数缩小。
   */
  adjustModelScale(model: Live2DModel | null, delta: number): void {
    this.setModelScale(model, this.currentScale + delta)
  }

  /**
   * 设置模型缩放值。
   * @param model 当前 Live2D 模型。
   * @param scale 目标缩放值。
   */
  setModelScale(model: Live2DModel | null, scale: number): void {
    const newScale = Math.max(this.minScale, Math.min(scale, this.maxScale))
    if (!model) return

    model.scale.set(newScale)
    this.currentScale = newScale
  }

  /**
   * 设置模型位置。
   * @param model 当前 Live2D 模型。
   * @param x X 坐标。
   * @param y Y 坐标。
   */
  setModelPosition(model: Live2DModel | null, x: number, y: number): void {
    if (!model) return

    model.x = x
    model.y = y
  }

  /**
   * 获取模型位置。
   * @param model 当前 Live2D 模型。
   * @returns 当前模型坐标；模型不存在时返回 0,0。
   */
  getModelPosition(model: Live2DModel | null): { x: number; y: number } {
    if (!model) return { x: 0, y: 0 }
    return { x: model.x, y: model.y }
  }

  /**
   * 切换锁定状态。
   * @param onUnlockFocus 解锁后需要执行的焦点恢复回调。
   */
  toggleLock(onUnlockFocus: () => void): void {
    this.setLocked(!this.locked, onUnlockFocus)
  }

  /**
   * 设置锁定状态。
   * @param locked 目标锁定状态。
   * @param onUnlockFocus 从锁定切换到非锁定时执行的回调。
   */
  setLocked(locked: boolean, onUnlockFocus: () => void): void {
    if (this.locked === locked) return

    this.locked = locked
    console.log('Lock status:', this.locked ? 'LOCKED' : 'UNLOCKED')

    if (!this.locked) {
      onUnlockFocus()
    }
  }

  /**
   * 获取锁定状态。
   * @returns 当前是否锁定。
   */
  getLocked(): boolean {
    return this.locked
  }
}
