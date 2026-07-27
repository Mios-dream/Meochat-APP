import type { Application } from 'pixi.js'
import type { Live2DModel } from 'untitled-pixi-live2d-engine'
import type { Live2DPointerPorts } from '../types'
import { isPixelTransparentFromEvent } from '../tools/transparentPixel'
import throttle from '../../../utils/Throttle'
import type { DragBounds, DragStrategy } from './Live2DDragStrategy'

/**
 * 桌宠模式拖拽策略。
 * 职责：
 * 1. 画布边界约束 — 模型不能超出窗口可视区域。
 * 2. 窗口拖拽滞后偏移 — 原生窗口拖拽时模型向反方向偏移，制造"惯性"感。
 * 3. 释放后回正 — 鼠标释放后模型平滑回到画布中心。
 * 4. IPC 全局鼠标追踪 — 基于主进程上报的全局坐标更新模型注视。
 * 5. 透明像素鼠标穿透 — 模型透明区域不拦截鼠标事件。
 */
export class PetDragStrategy implements DragStrategy {
  /** 策略内部鼠标按下状态，用于轮询守卫（原生拖拽时 DOM mouseup 不触发） */
  private mousePressed = false

  /* ========== 窗口拖拽滞后偏移 ========== */
  private petBaseX = 0
  private petBaseY = 0
  private petBaseSet = false
  private petWinOriginX = 0
  private petWinOriginY = 0
  private petPollTimer: ReturnType<typeof setInterval> | null = null
  private readonly PET_FOLLOW_RATIO = 0.7
  private readonly PET_SMOOTH = 0.05
  private readonly PET_SETTLE = 1.5
  private readonly PET_POLL_INTERVAL = 33

  /* ========== 透明像素鼠标穿透 ========== */
  private ignoreState = false
  private restoreTimer: ReturnType<typeof setTimeout> | null = null
  private readonly TRANSPARENT_RESTORE_MS = 1000

  /* ========== DragStrategy 接口实现 ========== */

  hasActiveDrag(): boolean {
    return this.petBaseSet
  }

  getBounds(model: Live2DModel): DragBounds | null {
    const modelW = model.width
    const modelH = model.height
    if (modelW <= 0 || modelH <= 0) return null

    const cw = window.innerWidth
    const ch = window.innerHeight

    // 保留 85% 模型可见，允许 15% 超出画布（兼顾滞后感与可视性）
    const visibleRatio = 0.85
    const marginX = modelW * (visibleRatio - 0.5)
    const marginY = modelH * (visibleRatio - 0.5)

    return {
      minX: marginX,
      maxX: cw - marginX,
      minY: marginY,
      maxY: ch - marginY
    }
  }

  onDragStart(_ports: Live2DPointerPorts, model: Live2DModel, onRequestAnim: () => void): void {
    this.mousePressed = true
    this.startPetPolling(model, onRequestAnim)
  }

  onDragEnd(_ports: Live2DPointerPorts, _model: Live2DModel): boolean {
    this.mousePressed = false
    this.stopPetPolling()
    if (this.petBaseSet) {
      return true
    }
    return false
  }

  bindIpc(
    ports: Live2DPointerPorts,
    model: Live2DModel | null,
    app: Application | null,
    callbacks: {
      onEnableFocus: () => void
      onRequestAnim: () => void
      onPetMouseRelease: () => void
    }
  ): void {
    window.api.ipcRenderer.removeAllListeners('assistant:mouse-position')
    window.api.ipcRenderer.on('assistant:mouse-position', (data) => {
      const mouseData = data as {
        isMouseDown: boolean
        screenX: number
        screenY: number
        windowX: number
        windowY: number
        windowWidth: number
        windowHeight: number
      }

      if (mouseData.isMouseDown) {
        callbacks.onEnableFocus()
      }

      if (!ports.getLocked() && model) {
        this.updatePetLag(ports, model, mouseData, callbacks.onPetMouseRelease)
      }

      this.updateFocusFromScreen(ports, model, app, mouseData)
    })

    ports.startMouseTracking()
  }

  tick(
    dt: number,
    model: Live2DModel,
    _ports: Live2DPointerPorts,
    isMousePressed: boolean
  ): boolean {
    if (!this.petBaseSet) return false

    let needsContinue = false
    const canvasBounds = this.getBounds(model)

    if (isMousePressed) {
      /* ---- 拖拽中：追赶目标位置 ---- */
      const rawDx = window.screenX - this.petWinOriginX
      const rawDy = window.screenY - this.petWinOriginY
      const halfW = window.innerWidth * 0.35
      const halfH = window.innerHeight * 0.35
      const targetOffX = Math.max(-halfW, Math.min(halfW, rawDx * this.PET_FOLLOW_RATIO))
      const targetOffY = Math.max(-halfH, Math.min(halfH, rawDy * this.PET_FOLLOW_RATIO))

      const rawTargetX = this.petBaseX + targetOffX
      const rawTargetY = this.petBaseY + targetOffY
      const targetX = canvasBounds
        ? Math.max(canvasBounds.minX, Math.min(canvasBounds.maxX, rawTargetX))
        : rawTargetX
      const targetY = canvasBounds
        ? Math.max(canvasBounds.minY, Math.min(canvasBounds.maxY, rawTargetY))
        : rawTargetY

      const diffX = targetX - model.x
      const diffY = targetY - model.y

      if (Math.abs(diffX) > this.PET_SETTLE || Math.abs(diffY) > this.PET_SETTLE) {
        const alpha = 1 - Math.pow(1 - this.PET_SMOOTH, dt)
        model.x += diffX * alpha
        model.y += diffY * alpha
        needsContinue = true
      } else {
        model.x = targetX
        model.y = targetY
      }

      // lerp 后二次约束模型位置，防止累积帧误差导致越界
      if (canvasBounds) {
        model.x = Math.max(canvasBounds.minX, Math.min(canvasBounds.maxX, model.x))
        model.y = Math.max(canvasBounds.minY, Math.min(canvasBounds.maxY, model.y))
      }
    } else {
      /* ---- 释放后：平滑回到画布中心 ---- */
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const dxR = cx - model.x
      const dyR = cy - model.y

      if (Math.abs(dxR) > this.PET_SETTLE || Math.abs(dyR) > this.PET_SETTLE) {
        const alpha = 1 - Math.pow(1 - 0.03, dt)
        model.x += dxR * alpha
        model.y += dyR * alpha
        needsContinue = true
      } else {
        model.x = cx
        model.y = cy
        this.resetPetLagState()
      }
    }

    return needsContinue
  }

  onMouseLeave(): void {
    this.ignoreState = false
    window.api.setIgnoreMouse(false)
    this.clearRestoreTimer()
  }

  destroy(): void {
    this.stopPetPolling()
    this.resetPetLagState()
    this.clearRestoreTimer()
  }

  /* ========== 窗口拖拽滞后偏移 ========== */

  private startPetPolling(model: Live2DModel, onRequestAnim: () => void): void {
    this.stopPetPolling()
    this.petWinOriginX = window.screenX
    this.petWinOriginY = window.screenY
    this.petBaseX = model.x
    this.petBaseY = model.y
    this.petBaseSet = true

    this.petPollTimer = setInterval(() => {
      if (!this.mousePressed) return
      const cx = window.screenX
      const cy = window.screenY
      if (cx !== this.petWinOriginX || cy !== this.petWinOriginY) {
        onRequestAnim()
      }
    }, this.PET_POLL_INTERVAL)
  }

  private stopPetPolling(): void {
    if (this.petPollTimer !== null) {
      clearInterval(this.petPollTimer)
      this.petPollTimer = null
    }
  }

  private resetPetLagState(): void {
    this.stopPetPolling()
    this.petBaseSet = false
  }

  private updatePetLag(
    ports: Live2DPointerPorts,
    _model: Live2DModel,
    mouseData: { isMouseDown: boolean },
    onPetMouseRelease: () => void
  ): void {
    if (!mouseData.isMouseDown && !ports.getLocked() && this.petBaseSet) {
      this.mousePressed = false
      this.stopPetPolling()
      onPetMouseRelease()
    }
  }

  /* ========== 全局注视追踪 ========== */

  private updateFocusFromScreen(
    ports: Live2DPointerPorts,
    model: Live2DModel | null,
    app: Application | null,
    mouseData: { screenX: number; screenY: number; windowX: number; windowY: number }
  ): void {
    if (!model || !app) return

    if (ports.isSleepModel()) {
      const centerX = app.screen.width / 2
      const centerY = app.screen.height / 2
      const normalizedX = (mouseData.screenX - mouseData.windowX - centerX) / (centerX || 1)
      const normalizedY = (mouseData.screenY - mouseData.windowY - centerY) / (centerY || 1)

      ports.applyMotionFrame(
        {
          ParamAngleX: normalizedX * 5,
          ParamAngleY: -normalizedY * 5,
          ParamBodyAngleX: normalizedX * 5
        },
        { transitionMs: 300, holdMs: 500 }
      )
      return
    }

    model.focus(mouseData.screenX - mouseData.windowX, mouseData.screenY - mouseData.windowY, false)
  }

  /* ========== 透明像素鼠标穿透 ========== */

  createTransparentPixelHandler(app: Application | null): (event: MouseEvent) => void {
    return throttle((event: MouseEvent) => {
      const shouldIgnore = isPixelTransparentFromEvent(app, event)
      if (shouldIgnore === this.ignoreState) return

      this.ignoreState = shouldIgnore
      window.api.setIgnoreMouse(this.ignoreState)

      if (this.ignoreState) {
        this.clearRestoreTimer()
        this.restoreTimer = setTimeout(() => {
          this.ignoreState = false
          window.api.setIgnoreMouse(false)
          this.restoreTimer = null
        }, this.TRANSPARENT_RESTORE_MS)
        return
      }

      this.clearRestoreTimer()
    }, 200)
  }

  private clearRestoreTimer(): void {
    if (this.restoreTimer) {
      window.clearTimeout(this.restoreTimer)
      this.restoreTimer = null
    }
  }
}
