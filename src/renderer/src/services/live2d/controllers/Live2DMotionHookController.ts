import type { Live2DModel } from 'untitled-pixi-live2d-engine'

type MotionManagerUpdate = (coreModel: object, now: number) => boolean

interface MotionManagerLike {
  update: MotionManagerUpdate
}

/**
 * 负责安装和卸载 motionManager.update 钩子。
 * 钩子用于在 Live2D 内置动作更新后继续应用自定义参数覆盖和口型参数。
 * 该控制器不持有模型本身，只保存原始 update 方法与恢复状态。
 */
export class Live2DMotionHookController {
  private originalUpdate: MotionManagerUpdate | null = null
  private hookedMotionManager: MotionManagerLike | null = null
  private installed = false

  /**
   * 安装 motionManager.update 钩子。
   * @param model 当前 Live2D 模型实例。
   * @param onAfterMotionUpdate 内置动作执行后的回调。
   */
  install(model: Live2DModel | null, onAfterMotionUpdate: () => void): void {
    if (!model || this.installed) return

    const motionManager = model.internalModel.motionManager as MotionManagerLike
    const originalUpdate = motionManager.update

    this.originalUpdate = originalUpdate
    this.hookedMotionManager = motionManager

    motionManager.update = (coreModel: object, now: number): boolean => {
      const result = originalUpdate.call(motionManager, coreModel, now)
      onAfterMotionUpdate()
      return result
    }

    this.installed = true
  }

  /**
   * 卸载 motionManager.update 钩子并恢复运行时原方法。
   */
  uninstall(): void {
    if (!this.installed) {
      this.resetRefs()
      return
    }

    if (this.hookedMotionManager && this.originalUpdate) {
      this.hookedMotionManager.update = this.originalUpdate
    }

    this.installed = false
    this.resetRefs()
  }

  /**
   * 重置内部引用，通常在模型切换后重新安装前调用。
   */
  reset(): void {
    this.installed = false
    this.resetRefs()
  }

  private resetRefs(): void {
    this.originalUpdate = null
    this.hookedMotionManager = null
  }
}
