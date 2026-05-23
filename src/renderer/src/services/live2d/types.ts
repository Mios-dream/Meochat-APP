/**
 * Live2D 动作帧叠加层的播放选项。
 */
export interface MotionFrameOptions {
  /** 参数进入目标值的过渡时长，单位毫秒。 */
  transitionMs?: number
  /** 参数保持在目标值附近的时长，单位毫秒。 */
  holdMs?: number
  /** 释放覆盖层时每个参数恢复到的目标值；未指定时使用默认释放目标。 */
  releaseTargetParams?: Record<string, number>
}

/**
 * Live2D 交互部位名称。
 */
export type Live2DPartName = 'head' | 'face' | 'body' | 'hand' | 'leg' | 'head.light' | 'head.heavy'

/**
 * 指针控制器可使用的最小能力集合。
 * 这里仅暴露指针交互真正需要的行为，避免控制器依赖完整的 Manager 实现。
 */
export interface Live2DPointerPorts {
  /** 当前是否锁定。 */
  getLocked(): boolean
  /** 当前是否处于注视状态。 */
  getFocusEnabled(): boolean
  /** 设置注视状态。 */
  setFocusEnabled(enabled: boolean): void
  /** 平滑取消注视。 */
  smoothDisableFocus(duration?: number): void
  /** 当前模型缩放。 */
  getModelScale(): number
  /** 设置模型缩放。 */
  setModelScale(scale: number): void
  /** 触发部位回调。 */
  emitPart(partName: Live2DPartName): void
  /** 应用动作帧覆盖。 */
  applyMotionFrame(parameters: Record<string, number>, options?: MotionFrameOptions): void
  /** 开始全局鼠标跟踪。 */
  startMouseTracking(): void
  /** 当前是否处于睡眠模式。 */
  isSleepModel(): boolean
}
