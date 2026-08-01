import type { Application } from 'pixi.js'
import type { Live2DModel } from 'untitled-pixi-live2d-engine'
import type { Live2DPointerPorts } from '../types'

export interface DragBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * 拖拽行为策略接口。
 * 桌宠模式（PetDragStrategy）与自由模式（FreeDragStrategy）的差异：
 * - 桌宠模式对模型位置施加画布边界约束，拖拽时有窗口滞后偏移，释放后回正到画布中心。
 * - 自由模式无任何边界约束，支持滚轮缩放，位置完全由用户控制。
 */
export interface DragStrategy {
  /** 当前是否有活跃的拖拽偏移状态（桌宠模式窗口拖拽时跳过普通位置平滑） */
  hasActiveDrag(): boolean

  /** 获取位置约束边界，null 表示无约束 */
  getBounds(model: Live2DModel): DragBounds | null

  /** 鼠标按下 */
  onDragStart(ports: Live2DPointerPorts, model: Live2DModel, onRequestAnim: () => void): void

  /** 鼠标释放，返回 true 表示需要继续动画循环 */
  onDragEnd(ports: Live2DPointerPorts, model: Live2DModel): boolean

  /** IPC 全局鼠标状态上报（仅桌宠模式时由控制器调用） */
  bindIpc?(
    ports: Live2DPointerPorts,
    model: Live2DModel | null,
    app: Application | null,
    callbacks: {
      onRequestAnim: () => void
      /** IPC 上报鼠标释放时重置控制器状态并触发回正 */
      onPetMouseRelease: () => void
    }
  ): void

  /** 每帧额外更新逻辑（桌宠模式窗口追踪+回正） */
  tick(dt: number, model: Live2DModel, ports: Live2DPointerPorts, isMousePressed: boolean): boolean

  /** 鼠标离开画布时的清理 */
  onMouseLeave(): void

  /** 清理所有资源 */
  destroy(): void
}

/**
 * 非桌宠模式（助手空间）的策略。
 * 无边界约束、无窗口追踪、无回正。
 */
export class FreeDragStrategy implements DragStrategy {
  hasActiveDrag(): boolean {
    return false
  }

  getBounds(): null {
    return null
  }

  onDragStart(): void {
    /* no-op */
  }

  onDragEnd(): boolean {
    return false
  }

  tick(): boolean {
    return false
  }

  onMouseLeave(): void {
    /* no-op */
  }

  destroy(): void {
    /* no-op */
  }
}
