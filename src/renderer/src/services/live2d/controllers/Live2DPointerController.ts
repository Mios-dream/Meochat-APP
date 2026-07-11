import type { Application } from 'pixi.js'
import type { Live2DModel } from 'untitled-pixi-live2d-engine'
import type { Live2DPartName, Live2DPointerPorts } from '../types'
import throttle from '../../../utils/Throttle'
import { getBodyPartAtPosition, isPositionOnModelHead } from '../tools/interactionGeometry'
import { isPixelTransparentFromEvent } from '../tools/transparentPixel'

interface PointerBindOptions {
  /** 是否处于桌宠模式；桌宠模式会启用鼠标穿透和全局鼠标位置追踪。 */
  isPetMode: boolean
}

/**
 * 负责 Live2D 画布内的指针交互。
 * 该控制器集中管理鼠标按下、拖动、点击、抚摸、滚轮缩放和桌宠模式穿透检测，
 * 避免 Live2DManager 持有大量只服务于 DOM 指针事件的临时状态。
 */
export class Live2DPointerController {
  private isMousePressed = false
  private mousePressTimer: ReturnType<typeof setTimeout> | null = null
  private focusTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly longPressDuration = 50
  private dragStartX = 0
  private dragStartY = 0
  private strokeStartAt = 0
  private strokeDistance = 0
  private lastStrokePoint: { x: number; y: number } | null = null
  private interactionStartedOnTransparent = false
  private interactionMaxDisplacement = 0
  private ignoreState = false
  private restoreTimer: ReturnType<typeof setTimeout> | null = null
  private readonly scaleStep = 0.05

  /**
   * 绑定画布指针事件。
   * @param ports 指针交互所需的最小能力集合。
   * @param canvas Live2D 渲染画布，所有鼠标事件都绑定在该元素上。
   * @param model 当前 Live2D 模型；为空时只注册事件但跳过模型操作。
   * @param app Pixi 应用实例，用于透明像素检测和桌宠模式下的画布坐标计算。
   * @param signal DOM 事件的 AbortSignal，用于外部统一注销监听器。
   * @param options 指针交互绑定选项。
   */
  bind(
    ports: Live2DPointerPorts,
    canvas: HTMLCanvasElement,
    model: Live2DModel | null,
    app: Application | null,
    signal: AbortSignal,
    options: PointerBindOptions
  ): void {
    canvas.addEventListener(
      'mousedown',
      (event) => this.handleMouseDown(ports, model, app, event),
      { signal }
    )
    canvas.addEventListener(
      'mousemove',
      (event) => this.handleMouseMove(ports, canvas, model, event, options),
      { signal }
    )
    canvas.addEventListener(
      'mouseup',
      (event) => this.handleMouseUp(ports, canvas, model, app, event),
      { signal }
    )
    canvas.addEventListener('mouseleave', () => this.handleMouseLeave(ports, options), { signal })

    if (!options.isPetMode) {
      canvas.addEventListener('wheel', (event) => this.handleWheel(ports, model, event), {
        passive: false,
        signal
      })
    }

    if (options.isPetMode) {
      window.api.ipcRenderer.removeAllListeners('assistant:mouse-position')
      window.api.ipcRenderer.on('assistant:mouse-position', (data) => {
        const mouseData = data as {
          isMouseDown: boolean
          screenX: number
          screenY: number
          windowX: number
          windowY: number
        }
        if (mouseData.isMouseDown) {
          this.enableFocusTemporarily(ports)
        }

        this.updateFocusFromScreen(
          ports,
          model,
          app,
          mouseData.screenX,
          mouseData.screenY,
          mouseData.windowX,
          mouseData.windowY
        )
      })

      ports.startMouseTracking()
      canvas.addEventListener('mousemove', this.updateMouseInteraction(app), { signal })
    }
  }

  /**
   * 清理指针交互中的定时器和穿透状态。
   * 销毁模型或重新绑定监听器前调用，避免长按、焦点和穿透恢复定时器继续运行。
   */
  destroy(): void {
    this.resetInteractionState()
    this.clearMousePressTimer()
    this.clearFocusTimeout()
    this.clearRestoreTimer()
  }

  /**
   * 处理画布内鼠标按下。
   * 记录拖动起点、触摸轨迹起点和透明像素命中状态，并在长按后启用注视。
   * @param ports 指针交互所需的最小能力集合。
   * @param model 当前模型。
   * @param app Pixi 应用实例，用于读取像素透明度。
   * @param event 鼠标按下事件。
   */
  private handleMouseDown(
    ports: Live2DPointerPorts,
    model: Live2DModel | null,
    app: Application | null,
    event: MouseEvent
  ): void {
    this.isMousePressed = true
    this.dragStartX = event.clientX
    this.dragStartY = event.clientY
    this.strokeStartAt = Date.now()
    this.strokeDistance = 0
    this.lastStrokePoint = { x: event.clientX, y: event.clientY }
    this.interactionMaxDisplacement = 0
    this.interactionStartedOnTransparent = isPixelTransparentFromEvent(app, event)

    if (!this.interactionStartedOnTransparent) {
      model?.tap(event.x, event.y)
    }

    this.mousePressTimer = setTimeout(() => {
      if (this.isMousePressed && model && ports.getLocked()) {
        this.enableFocusTemporarily(ports)
      }
    }, this.longPressDuration)
  }

  /**
   * 处理画布内鼠标移动。
   * 锁定时用于长按注视，未锁定时用于拖动模型，同时累计滑动距离用于抚摸判定。
   * @param ports 指针交互所需的最小能力集合。
   * @param canvas 绑定事件的 canvas 元素。
   * @param model 当前 Live2D 模型。
   * @param event 鼠标移动事件。
   * @param options 指针绑定选项。
   */
  private handleMouseMove(
    ports: Live2DPointerPorts,
    canvas: HTMLCanvasElement,
    model: Live2DModel | null,
    event: MouseEvent,
    options: PointerBindOptions
  ): void {
    if (this.isMousePressed && ports.getFocusEnabled() && model && ports.getLocked()) {
      const rect = canvas.getBoundingClientRect()
      model.focus(event.clientX - rect.left, event.clientY - rect.top, false)
    }

    if (this.isMousePressed && !ports.getLocked() && !options.isPetMode && model) {
      const deltaX = event.clientX - this.dragStartX
      const deltaY = event.clientY - this.dragStartY
      model.x += deltaX
      model.y += deltaY
      this.dragStartX = event.clientX
      this.dragStartY = event.clientY
    }

    if (this.isMousePressed && this.lastStrokePoint) {
      const dx = event.clientX - this.lastStrokePoint.x
      const dy = event.clientY - this.lastStrokePoint.y
      const delta = Math.hypot(dx, dy)
      this.strokeDistance += delta
      this.interactionMaxDisplacement += delta
      this.lastStrokePoint = { x: event.clientX, y: event.clientY }
    }
  }

  /**
   * 处理鼠标释放。
   * 根据交互位移区分点击与抚摸，并在释放后清理本次交互状态。
   * @param ports 指针交互所需的最小能力集合。
   * @param canvas 绑定事件的 canvas 元素。
   * @param model 当前 Live2D 模型。
   * @param app Pixi 应用实例。
   * @param event 鼠标释放事件。
   */
  private handleMouseUp(
    ports: Live2DPointerPorts,
    canvas: HTMLCanvasElement,
    model: Live2DModel | null,
    app: Application | null,
    event: MouseEvent
  ): void {
    if (!this.interactionStartedOnTransparent) {
      const strokeDurationMs = Date.now() - this.strokeStartAt
      const displacement = this.interactionMaxDisplacement

      if (displacement < 5) {
        this.handleModelClick(ports, canvas, model, app, event)
      } else if (displacement >= 12 && strokeDurationMs >= 120) {
        this.handleHeadStroke(ports, canvas, model, event, strokeDurationMs)
      }
    }

    this.resetInteractionState()
    this.clearMousePressTimer()

    if (ports.getLocked() && this.focusTimeout) {
      ports.smoothDisableFocus(500)
    }
  }

  /**
   * 处理鼠标离开画布。
   * 用于取消拖动、抚摸、长按注视和桌宠穿透状态。
   * @param ports 指针交互所需的最小能力集合。
   * @param options 指针绑定选项。
   */
  private handleMouseLeave(ports: Live2DPointerPorts, options: PointerBindOptions): void {
    this.resetInteractionState()
    this.clearMousePressTimer()

    if (ports.getLocked() && this.focusTimeout) {
      ports.smoothDisableFocus(500)
    }

    this.ignoreState = false
    if (options.isPetMode) {
      window.api.setIgnoreMouse(false)
    }
    this.clearRestoreTimer()
  }

  /**
   * 处理滚轮缩放。
   * 仅在非锁定模式下生效，桌宠模式不会绑定该事件。
   * @param ports 指针交互所需的最小能力集合。
   * @param model 当前 Live2D 模型。
   * @param event 鼠标滚轮事件。
   */
  private handleWheel(ports: Live2DPointerPorts, model: Live2DModel | null, event: WheelEvent): void {
    event.preventDefault()
    if (!model || ports.getLocked()) return

    ports.setModelScale(
      ports.getModelScale() + (event.deltaY < 0 ? this.scaleStep : -this.scaleStep)
    )
  }

  /**
   * 处理模型点击。
   * 二次确认释放点不是透明像素后，将画布坐标映射为 Live2DPartName 并通过端口回传。
   * @param ports 指针交互所需的最小能力集合。
   * @param canvas 绑定事件的 canvas 元素。
   * @param model 当前 Live2D 模型。
   * @param app Pixi 应用实例。
   * @param event 鼠标释放事件。
   */
  private handleModelClick(
    ports: Live2DPointerPorts,
    canvas: HTMLCanvasElement,
    model: Live2DModel | null,
    app: Application | null,
    event: MouseEvent
  ): void {
    if (isPixelTransparentFromEvent(app, event)) return

    const rect = canvas.getBoundingClientRect()
    const cssX = event.clientX - rect.left
    const cssY = event.clientY - rect.top
    const partName = getBodyPartAtPosition(model, cssX, cssY) as Live2DPartName | null
    if (partName) ports.emitPart(partName)
  }

  /**
   * 处理头部抚摸。
   * 只有滑动结束点位于模型头部区域时才触发，并按滑动速度区分轻抚与重抚。
   * @param ports 指针交互所需的最小能力集合。
   * @param canvas 绑定事件的 canvas 元素。
   * @param model 当前 Live2D 模型。
   * @param event 鼠标释放事件。
   * @param strokeDurationMs 从按下到释放的持续时长。
   */
  private handleHeadStroke(
    ports: Live2DPointerPorts,
    canvas: HTMLCanvasElement,
    model: Live2DModel | null,
    event: MouseEvent,
    strokeDurationMs: number
  ): void {
    const rect = canvas.getBoundingClientRect()
    const cssX = event.clientX - rect.left
    const cssY = event.clientY - rect.top
    if (!isPositionOnModelHead(model, cssX, cssY)) return

    const speedPxPerSecond = (this.strokeDistance / strokeDurationMs) * 1000
    ports.emitPart(speedPxPerSecond >= 360 ? 'head.heavy' : 'head.light')
  }

  /**
   * 创建桌宠模式下的鼠标穿透检测处理器。
   * 透明像素会通知主进程忽略鼠标，非透明像素会恢复窗口可交互状态。
   * @param app Pixi 应用实例。
   * @returns 节流后的鼠标移动处理函数。
   */
  private updateMouseInteraction(app: Application | null): (event: MouseEvent) => void {
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
        }, 1000)
        return
      }

      this.clearRestoreTimer()
    }, 200)
  }

  /**
   * 重置单次按下到释放期间的交互状态。
   */
  private resetInteractionState(): void {
    this.isMousePressed = false
    this.strokeDistance = 0
    this.lastStrokePoint = null
    this.interactionStartedOnTransparent = false
    this.interactionMaxDisplacement = 0
  }

  /**
   * 清理长按定时器。
   */
  private clearMousePressTimer(): void {
    if (this.mousePressTimer) {
      clearTimeout(this.mousePressTimer)
      this.mousePressTimer = null
    }
  }

  /**
   * 清理桌宠穿透恢复定时器。
   */
  private clearRestoreTimer(): void {
    if (this.restoreTimer) {
      window.clearTimeout(this.restoreTimer)
      this.restoreTimer = null
    }
  }

  /**
   * 临时启用注视状态。
   * 超时后通过 smoothDisableFocus 平滑恢复中心注视。
   * @param ports 指针交互所需的最小能力集合。
   */
  private enableFocusTemporarily(ports: Live2DPointerPorts): void {
    this.clearFocusTimeout()
    ports.setFocusEnabled(true)
    this.focusTimeout = setTimeout(() => {
      ports.smoothDisableFocus(1500)
      this.focusTimeout = null
    }, 5000)
  }

  /**
   * 根据主进程上报的全局鼠标坐标更新模型注视。
   * 睡眠模式下不直接对焦鼠标，而是转为轻微参数偏移，避免睡眠状态动作过强。
   * @param ports 指针交互所需的最小能力集合。
   * @param model 当前 Live2D 模型。
   * @param app Pixi 应用实例。
   * @param screenX 屏幕 X 坐标。
   * @param screenY 屏幕 Y 坐标。
   * @param windowX 窗口 X 坐标。
   * @param windowY 窗口 Y 坐标。
   */
  private updateFocusFromScreen(
    ports: Live2DPointerPorts,
    model: Live2DModel | null,
    app: Application | null,
    screenX: number,
    screenY: number,
    windowX: number,
    windowY: number
  ): void {
    if (!model || !app || !this.focusTimeout) return

    if (ports.isSleepModel()) {
      const centerX = app.screen.width / 2
      const centerY = app.screen.height / 2
      const normalizedX = (screenX - windowX - centerX) / (centerX || 1)
      const normalizedY = (screenY - windowY - centerY) / (centerY || 1)

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

    model.focus(screenX - windowX, screenY - windowY, false)
  }

  /**
   * 清理临时注视定时器。
   */
  private clearFocusTimeout(): void {
    if (this.focusTimeout) {
      clearTimeout(this.focusTimeout)
      this.focusTimeout = null
    }
  }
}
