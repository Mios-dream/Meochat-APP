import type { Application } from 'pixi.js'
import type { Live2DModel } from 'untitled-pixi-live2d-engine'
import type { InternalModel } from 'untitled-pixi-live2d-engine'
import type { Live2DPartName, Live2DPointerPorts } from '../types'
import throttle from '../../../utils/Throttle'
import { getBodyPartAtPosition, isPositionOnModelHead } from '../tools/interactionGeometry'
import { isPixelTransparentFromEvent } from '../tools/transparentPixel'
import type { DragStrategy } from './Live2DDragStrategy'
import { FreeDragStrategy } from './Live2DDragStrategy'
import { PetDragStrategy } from './Live2DPetDragStrategy'

/**
 * 遍历模型所有可见 drawable 做点-三角形碰撞检测。
 * 不依赖 HitAreas，不涉及 GPU 回读。
 * @returns 点击是否落在模型任意可见像素上。
 */
function isClickOnModel(model: Live2DModel | null, event: MouseEvent): boolean {
  if (!model) return false

  // 1) 优先使用 HitAreas（精确且高效）
  if (model.hitTest(event.x, event.y).length > 0) return true

  // 2) 无 HitAreas：自行遍历所有 drawable 做三角形碰撞
  const internalModel = (model as unknown as Record<string, unknown>).internalModel as
    | InternalModel
    | undefined
  const coreModel = internalModel?.coreModel as
    | {
        getDrawableCount(): number
        getDrawableVertexPositions(n: number): Float32Array
        getDrawableVertexIndices(n: number): Uint16Array
        getDrawableOpacity(n: number): number
        getDrawableDynamicFlagIsVisible(n: number): boolean
      }
    | undefined
  if (!coreModel || !internalModel) return false

  // 视口坐标 → Pixi 全局坐标 → 模型局部坐标（含 drawingMatrix 的逆）
  const local = model.toLocal({ x: event.x, y: event.y })
  // drawingMatrix 将 Cubism 模型坐标 (Y↑) 映射到 Pixi 局部坐标 (Y↓)，
  // 求逆后得到与 getDrawableVertexPositions 一致的坐标系
  const invDrawing = internalModel.drawingMatrix.clone()
  invDrawing.invert()
  const cubismLocal = invDrawing.apply(local)

  const count = coreModel.getDrawableCount()
  for (let i = 0; i < count; i++) {
    if (!coreModel.getDrawableDynamicFlagIsVisible(i)) continue
    if (coreModel.getDrawableOpacity(i) < 0.02) continue

    const verts = coreModel.getDrawableVertexPositions(i)
    const idxs = coreModel.getDrawableVertexIndices(i)
    if (hitTestMesh(cubismLocal.x, cubismLocal.y, verts, idxs)) return true
  }
  return false
}

/** 点-三角形网格碰撞检测（barycentric） */
function hitTestMesh(px: number, py: number, verts: Float32Array, idxs: Uint16Array): boolean {
  for (let t = 0; t < idxs.length; t += 3) {
    const i0 = idxs[t] * 2,
      i1 = idxs[t + 1] * 2,
      i2 = idxs[t + 2] * 2
    const ax = verts[i0],
      ay = verts[i0 + 1]
    const bx = verts[i1],
      by = verts[i1 + 1]
    const cx = verts[i2],
      cy = verts[i2 + 1]

    const v0x = cx - ax,
      v0y = cy - ay
    const v1x = bx - ax,
      v1y = by - ay
    const v2x = px - ax,
      v2y = py - ay

    const dot00 = v0x * v0x + v0y * v0y
    const dot01 = v0x * v1x + v0y * v1y
    const dot02 = v0x * v2x + v0y * v2y
    const dot11 = v1x * v1x + v1y * v1y
    const dot12 = v1x * v2x + v1y * v2y

    const inv = 1 / (dot00 * dot11 - dot01 * dot01)
    const u = (dot11 * dot02 - dot01 * dot12) * inv
    const v = (dot00 * dot12 - dot01 * dot02) * inv

    if (u >= 0 && v >= 0 && u + v < 1) return true
  }
  return false
}

interface PointerBindOptions {
  /** 是否处于桌宠模式；桌宠模式会启用鼠标穿透和全局鼠标位置追踪。 */
  isPetMode: boolean
}

/**
 * 负责 Live2D 画布内的指针交互。
 * 该控制器集中管理鼠标按下、拖动、点击、抚摸、滚轮缩放，
 * 避免 Live2DManager 持有大量只服务于 DOM 指针事件的临时状态。
 *
 * 位置约束/窗口追踪/回正等窗口相关的行为差异通过 DragStrategy 策略化，
 * 桌宠模式与助手空间自由模式共用同一控制器但使用不同的策略实现。
 */
export class Live2DPointerController {
  private dragStrategy: DragStrategy = new FreeDragStrategy()
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
  /** 缓存画布 getBoundingClientRect，避免 mousemove 热路径中强制布局 */
  private canvasRect: DOMRect | null = null
  private readonly scaleStep = 0.05

  /* ========== 平滑拖拽 + 缩放动画 ========== */
  /** 平衡点（光标累计位置，模型追赶此处） */
  private dragTargetX = 0
  private dragTargetY = 0
  /** 上一帧时间戳，用于帧率无关的平滑计算 */
  private lastFrameTime = 0
  /** 动画帧 ID */
  private animFrameId: number | null = null
  /** 缩放目标值 */
  private zoomTargetScale = 1
  /** 是否正在文档级拖拽中 */
  private isDragging = false
  /** 文档级拖拽事件存储 */
  private dragMoveHandler: ((event: MouseEvent) => void) | null = null
  private dragEndHandler: ((event: MouseEvent) => void) | null = null
  /** 指数平滑速率（60fps 基准），值越小滞后越大 */
  private readonly SMOOTH_RATE = 0.1
  /** 位置收敛阈值（px），低于此值直接 snap */
  private readonly POS_SETTLE = 2
  /** 缩放平滑系数 */
  private readonly ZOOM_LERP = 0.15
  /** 缩放停止阈值 */
  private readonly ZOOM_THRESHOLD = 0.001

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
    // 根据模式选择拖拽策略
    this.dragStrategy.destroy()
    this.dragStrategy = options.isPetMode ? new PetDragStrategy() : new FreeDragStrategy()

    // 初始化缩放目标为当前模型缩放值，避免首次滚轮缩放时跳变
    this.zoomTargetScale = ports.getModelScale()

    canvas.addEventListener(
      'mousedown',
      (event) => this.handleMouseDown(ports, model, event, canvas, options),
      { signal }
    )
    canvas.addEventListener(
      'mousemove',
      (event) => this.handleMouseMove(ports, model, event, options),
      { signal }
    )
    canvas.addEventListener('mouseup', (event) => this.handleMouseUp(ports, canvas, model, event), {
      signal
    })
    canvas.addEventListener('mouseleave', () => this.handleMouseLeave(ports), { signal })

    if (!options.isPetMode) {
      canvas.addEventListener('wheel', (event) => this.handleWheel(ports, model, event), {
        passive: false,
        signal
      })
    }

    if (options.isPetMode) {
      this.dragStrategy.bindIpc!(ports, model, app, {
        onRequestAnim: () => model && this.startAnim(model, ports),
        onPetMouseRelease: () => {
          this.isMousePressed = false
          this.clearMousePressTimer()
          if (model) this.startAnim(model, ports)
        }
      })
      canvas.addEventListener('mousemove', this.createTransparentPixelHandler(app), { signal })
    }
  }

  /**
   * 清理指针交互中的定时器和穿透状态。
   * 销毁模型或重新绑定监听器前调用，避免长按、焦点和穿透恢复定时器继续运行。
   */
  destroy(): void {
    this.stopAnim()
    this.uninstallDragListeners()
    this.resetInteractionState()
    this.clearMousePressTimer()
    this.clearFocusTimeout()
    this.dragStrategy.destroy()
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
    event: MouseEvent,
    canvas?: HTMLCanvasElement,
    options?: PointerBindOptions
  ): void {
    this.stopAnim()

    this.isMousePressed = true
    this.dragStartX = event.clientX
    this.dragStartY = event.clientY
    this.strokeStartAt = Date.now()
    this.strokeDistance = 0
    this.lastStrokePoint = { x: event.clientX, y: event.clientY }
    this.canvasRect = canvas?.getBoundingClientRect() ?? null
    // 将弹簧平衡点初始化为模型当前位置
    if (model) {
      this.dragTargetX = model.x
      this.dragTargetY = model.y
    }
    this.interactionStartedOnTransparent = !isClickOnModel(model, event)

    if (!this.interactionStartedOnTransparent) {
      model?.tap(event.x, event.y)
    }

    /* ---- 桌宠模式：启动窗口位置轮询，跟踪拖拽位移 ---- */
    if (options?.isPetMode && !ports.getLocked() && model) {
      this.dragStrategy.onDragStart(ports, model, () => this.startAnim(model, ports))
    }

    this.mousePressTimer = setTimeout(() => {
      if (this.isMousePressed && model && ports.getLocked()) {
        this.enableFocusTemporarily(ports)
      }
    }, this.longPressDuration)

    // 未锁定时安装文档级拖拽监听，确保鼠标离开画布后仍能拖动
    if (!ports.getLocked() && !options?.isPetMode && model && canvas) {
      this.installDragListeners(ports, model, canvas)
    }
  }

  /**
   * 处理画布内鼠标移动。
   * 锁定时用于长按注视，未锁定时用于拖动模型，同时累计滑动距离用于抚摸判定。
   * @param ports 指针交互所需的最小能力集合。
   * @param model 当前 Live2D 模型。
   * @param event 鼠标移动事件。
   * @param options 指针绑定选项。
   */
  private handleMouseMove(
    ports: Live2DPointerPorts,
    model: Live2DModel | null,
    event: MouseEvent,
    options: PointerBindOptions
  ): void {
    if (this.isMousePressed && ports.getFocusEnabled() && model && ports.getLocked()) {
      model.focus(
        event.clientX - (this.canvasRect?.left ?? 0),
        event.clientY - (this.canvasRect?.top ?? 0),
        false
      )
    }

    // 文档级拖拽监听器已接管鼠标移动，跳过此处避免重复处理
    if (this.isDragging) return

    if (this.isMousePressed && !ports.getLocked() && !options.isPetMode && model) {
      const deltaX = event.clientX - this.dragStartX
      const deltaY = event.clientY - this.dragStartY
      model.x += deltaX
      model.y += deltaY
      this.dragStartX = event.clientX
      this.dragStartY = event.clientY
    }

    // 拖拽中由文档级监听器追踪抚摸，避免双重计数和对象分配
    if (this.isMousePressed && this.lastStrokePoint && !this.isDragging) {
      const dx = event.clientX - this.lastStrokePoint.x
      const dy = event.clientY - this.lastStrokePoint.y
      const delta = Math.hypot(dx, dy)
      this.strokeDistance += delta
      // 复用点对象，减少 GC
      this.lastStrokePoint.x = event.clientX
      this.lastStrokePoint.y = event.clientY
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
    event: MouseEvent
  ): void {
    // 拖拽模式下由文档级监听器处理释放逻辑
    if (this.isDragging) return

    if (!this.interactionStartedOnTransparent) {
      const strokeDurationMs = Date.now() - this.strokeStartAt
      const displacement = this.strokeDistance

      if (displacement < 5) {
        this.handleModelClick(ports, canvas, model, event)
      } else if (displacement >= 12 && strokeDurationMs >= 120) {
        this.handleHeadStroke(ports, canvas, model, event, strokeDurationMs)
      }
    }

    /* ---- 桌宠模式：停止轮询，激活回正弹簧 ---- */
    if (model) {
      const needsAnim = this.dragStrategy.onDragEnd(ports, model)
      if (needsAnim) {
        this.startAnim(model, ports)
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
  private handleMouseLeave(ports: Live2DPointerPorts): void {
    // 拖拽中由文档级监听器接管，不重置状态，否则拖拽会中断
    if (!this.isDragging) {
      this.resetInteractionState()
    }
    this.clearMousePressTimer()

    if (ports.getLocked() && this.focusTimeout) {
      ports.smoothDisableFocus(500)
    }
    this.dragStrategy.onMouseLeave()
  }

  /**
   * 处理滚轮缩放。
   * 仅在非锁定模式下生效，桌宠模式不会绑定该事件。
   * @param ports 指针交互所需的最小能力集合。
   * @param model 当前 Live2D 模型。
   * @param event 鼠标滚轮事件。
   */
  private handleWheel(
    ports: Live2DPointerPorts,
    model: Live2DModel | null,
    event: WheelEvent
  ): void {
    event.preventDefault()
    if (!model || ports.getLocked()) return

    // 设置缩放目标值，由平滑动画循环 lerp 逼近
    this.zoomTargetScale += event.deltaY < 0 ? this.scaleStep : -this.scaleStep
    this.zoomTargetScale = Math.max(0.1, Math.min(2, this.zoomTargetScale))

    this.startAnim(model, ports)
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
    event: MouseEvent
  ): void {
    if (!isClickOnModel(model, event)) return

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
  private createTransparentPixelHandler(app: Application | null): (event: MouseEvent) => void {
    let ignoreState = false
    let restoreTimer: ReturnType<typeof setTimeout> | null = null

    return throttle((event: MouseEvent) => {
      const shouldIgnore = isPixelTransparentFromEvent(app, event)
      if (shouldIgnore === ignoreState) return

      ignoreState = shouldIgnore
      window.api.setIgnoreMouse(ignoreState)

      if (ignoreState) {
        if (restoreTimer) clearTimeout(restoreTimer)
        restoreTimer = setTimeout(() => {
          ignoreState = false
          window.api.setIgnoreMouse(false)
          restoreTimer = null
        }, 1000)
        return
      }

      if (restoreTimer) {
        clearTimeout(restoreTimer)
        restoreTimer = null
      }
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
    this.canvasRect = null
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
   * 清理临时注视定时器。
   */
  private clearFocusTimeout(): void {
    if (this.focusTimeout) {
      clearTimeout(this.focusTimeout)
      this.focusTimeout = null
    }
  }

  /* ========== 平滑拖拽 & 缩放动画系统 ========== */

  /**
   * 安装文档级拖拽事件监听器，使鼠标离开画布后仍能持续拖动。
   * 拖拽过程中不直接修改 model.x/y，而是更新 dragTarget，
   * 由平滑动画循环对位置进行 lerp 插值，产生带阻尼的跟随感。
   * @param ports 指针交互端口。
   * @param model 当前模型。
   * @param canvas 画布元素，用于点击/抚摸检测的坐标转换。
   * @param app Pixi 应用实例。
   */
  private installDragListeners(
    ports: Live2DPointerPorts,
    model: Live2DModel | null,
    canvas: HTMLCanvasElement
  ): void {
    if (this.isDragging) return
    this.isDragging = true

    const handleMove = (event: MouseEvent): void => {
      if (!model) return

      const deltaX = event.clientX - this.dragStartX
      const deltaY = event.clientY - this.dragStartY

      // 事件只更新弹簧平衡点，弹簧物理由 rAF 循环驱动
      this.dragTargetX += deltaX
      this.dragTargetY += deltaY

      this.dragStartX = event.clientX
      this.dragStartY = event.clientY

      // 抚摸轨迹追踪
      if (this.lastStrokePoint) {
        const dx = event.clientX - this.lastStrokePoint.x
        const dy = event.clientY - this.lastStrokePoint.y
        const delta = Math.hypot(dx, dy)
        this.strokeDistance += delta
        this.lastStrokePoint.x = event.clientX
        this.lastStrokePoint.y = event.clientY
      }

      // 启动平滑动画
      this.startAnim(model, ports)
    }

    const handleUp = (event: MouseEvent): void => {
      // 点击/抚摸检测
      if (!this.interactionStartedOnTransparent && model) {
        const strokeDurationMs = Date.now() - this.strokeStartAt
        const displacement = this.strokeDistance

        if (displacement < 5) {
          this.handleModelClick(ports, canvas, model, event)
        } else if (displacement >= 12 && strokeDurationMs >= 120) {
          this.handleHeadStroke(ports, canvas, model, event, strokeDurationMs)
        }
      }

      // 清理
      this.stopAnim()
      this.uninstallDragListeners()
      this.resetInteractionState()
      this.clearMousePressTimer()

      if (ports.getLocked() && this.focusTimeout) {
        ports.smoothDisableFocus(500)
      }
    }

    this.dragMoveHandler = handleMove
    this.dragEndHandler = handleUp
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }

  /**
   * 卸载文档级拖拽事件监听器。
   */
  private uninstallDragListeners(): void {
    if (this.dragMoveHandler) {
      document.removeEventListener('mousemove', this.dragMoveHandler)
      this.dragMoveHandler = null
    }
    if (this.dragEndHandler) {
      document.removeEventListener('mouseup', this.dragEndHandler)
      this.dragEndHandler = null
    }
    this.isDragging = false
  }

  /**
   * 启动帧率无关的平滑追逐 + 缩放动画。
   *
   * 位置更新使用指数平滑，alpha 根据实际帧时间校正，保证任何帧率下
   * 模型滞后时间恒定（SMOOTH_RATE = 0.08 ≈ 208ms 滞后）。
   *
   * 位置约束由当前 DragStrategy.getBounds() 提供：
   * - 桌宠模式下约束到画布可视范围，防止模型越界。
   * - 助手空间自由模式下无约束，允许用户拖拽/缩放超出画布。
   *
   * 额外的策略动画（桌宠窗口追踪+回正）通过 strategy.tick() 驱动。
   *
   * @param model 当前 Live2D 模型。
   * @param ports 指针交互端口。
   */
  private startAnim(model: Live2DModel | null, ports: Live2DPointerPorts): void {
    if (!model) return
    if (this.animFrameId !== null) return

    this.lastFrameTime = performance.now()

    const animate = (): void => {
      let needsContinue = false
      const now = performance.now()
      const frameDeltaMs = now - this.lastFrameTime
      const dt = Math.min(frameDeltaMs / 16.667, 4)
      this.lastFrameTime = now

      // 由策略决定当前是否有活跃的桌宠窗口拖拽（有此标记时跳过普通平滑）
      const hasActiveDrag = this.dragStrategy.hasActiveDrag()

      // 预计算边界约束（由策略提供，自由模式返回 null）
      const canvasBounds = this.dragStrategy.getBounds(model)

      /* ---- 位置：帧率无关的指数平滑（桌宠窗口拖拽激活时跳过） ---- */
      if (!hasActiveDrag) {
        const diffX = this.dragTargetX - model.x
        const diffY = this.dragTargetY - model.y

        if (Math.abs(diffX) > this.POS_SETTLE || Math.abs(diffY) > this.POS_SETTLE) {
          const decay = 1 - this.SMOOTH_RATE
          let pow = decay
          if (dt >= 2) pow *= decay
          if (dt >= 3) pow *= decay
          if (dt >= 4) pow *= decay
          const alpha = 1 - pow
          model.x += diffX * alpha
          model.y += diffY * alpha
          needsContinue = true
        } else {
          model.x = this.dragTargetX
          model.y = this.dragTargetY
        }

        // 约束模型位置 & 同步拖拽目标（桌宠模式生效）
        if (canvasBounds) {
          model.x = Math.max(canvasBounds.minX, Math.min(canvasBounds.maxX, model.x))
          model.y = Math.max(canvasBounds.minY, Math.min(canvasBounds.maxY, model.y))
          this.dragTargetX = Math.max(
            canvasBounds.minX,
            Math.min(canvasBounds.maxX, this.dragTargetX)
          )
          this.dragTargetY = Math.max(
            canvasBounds.minY,
            Math.min(canvasBounds.maxY, this.dragTargetY)
          )
        }
      }

      /* ---- 策略额外动画（桌宠窗口追踪+回正） ---- */
      if (this.dragStrategy.tick(dt, model, ports, this.isMousePressed)) {
        needsContinue = true
      }

      /* ---- 缩放平滑 ---- */
      const currentScale = ports.getModelScale()
      if (Math.abs(currentScale - this.zoomTargetScale) > this.ZOOM_THRESHOLD) {
        const newScale = currentScale + (this.zoomTargetScale - currentScale) * this.ZOOM_LERP
        ports.setModelScale(newScale)
        needsContinue = true
      }

      if (needsContinue) {
        this.animFrameId = requestAnimationFrame(animate)
      } else {
        this.animFrameId = null
      }
    }

    this.animFrameId = requestAnimationFrame(animate)
  }

  /**
   * 停止动画。
   */
  private stopAnim(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }
}
