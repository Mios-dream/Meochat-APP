import { Live2DModel, MotionPriority, config } from 'untitled-pixi-live2d-engine'
import { Application, WebGLRenderer } from 'pixi.js'
import throttle from '../utils/Throttle'
import { InteractionSystem } from '@renderer/core/interaction/InteractionSystem'
import { useConfigStore } from '../stores/useConfigStore'

// 设置模型配置
config.motionFadingDuration = 500
config.idleMotionFadingDuration = 500
config.expressionFadingDuration = 500

interface MotionFrameOptions {
  transitionMs?: number
  holdMs?: number
}

export class Live2DManager {
  // 单例模式
  private static instance: Live2DManager
  // 是否禁用模型的自动动作和交互，进入纯展示状态
  public disabled = false
  // 用于清理 initListeners 注册的 DOM 事件监听器，避免重复注册
  private listenerAbortController: AbortController | null = null
  // 画布元素
  private canvasElement: HTMLCanvasElement | null = null
  // 渲染器
  public app: Application | null = null
  // 模型对象
  private model: Live2DModel | null = null
  // 音频上下文
  private audioContext: AudioContext | null = null
  // 是否聚焦鼠标，用于全局鼠标跟踪
  private isMouseTracking = false
  // 聚焦的状态,是否可以聚焦
  private isFocusEnabled = false
  // 聚焦超时定时器
  private focusTimeout: ReturnType<typeof setTimeout> | null = null
  // 聚焦超时,用于全局
  public focus_timeout_ms = 5000 // 5秒无点击后取消聚焦
  // 用于控制忽略状态。是否点击的空白区域
  private ignoreState = false
  // 恢复模型可交互状态的定时器
  private restoreTimer: ReturnType<typeof setTimeout> | null = null

  // 用于画布内鼠标跟踪
  // 鼠标点击和长按状态
  private isMousePressed = false
  // 鼠标按下的定时器
  private mousePressTimer: ReturnType<typeof setTimeout> | null = null
  // 鼠标长按触发时间
  private longPressDuration = 50 // 长按触发时间（毫秒）
  // 拖动相关
  private dragStartX = 0
  private dragStartY = 0
  // 触摸轨迹相关（用于轻抚/重抚判定）
  private strokeStartAt = 0
  private strokeDistance = 0
  private lastStrokePoint: { x: number; y: number } | null = null
  // 交互起始是否在透明像素上
  private interactionStartedOnTransparent = false
  // 交互期间的最大位移（用于区分点击和滑动）
  private interactionMaxDisplacement = 0

  // 缩放相关
  private currentScale = 1
  private minScale = 0.1
  private maxScale = 2
  private scaleStep = 0.05

  // 画步锁定相关
  private isLocked = false
  // 音量控制属性
  private volume: number = 1.0 // 0.0 to 1.0
  // 当前语音播放的增益节点，用于在播放中动态调整音量
  private activeGainNode: GainNode | null = null
  // 语音播放状态，用于避免动作帧覆盖口型参数
  private isSpeaking = false
  // 动作帧默认保持时长
  private overlayDurationMs = 2000
  // 当前叠加层参数状态
  private overlayCurrentParams: Record<string, number> = {}
  // 新的动作帧目标参数状态
  private overlayTargetParams: Record<string, number> = {}
  // 叠加层保持结束时间戳，单位 ms，过了这个时间会触发参数恢复
  private overlayHoldUntil = 0
  // 上次 tick 叠加层更新的时间戳，单位 ms，用于计算过渡进度
  private overlayLastTickAt = 0
  // 当前叠加层过渡时长，单位 ms，null 表示使用默认值
  private overlayTransitionMs: number | null = null

  // 当前口型开合度，用于语音驱动口型时的平滑过渡
  private currentMouthOpenY = 0
  // motionManager.update 原始方法与钩子状态
  private originalMotionManagerUpdate: ((coreModel: object, now: number) => boolean) | null = null
  private hookedMotionManager: { update: (coreModel: object, now: number) => boolean } | null = null
  // 是否已安装 motionManager.update 钩子
  private motionManagerHookInstalled = false

  /**
   * 每个参数的独立过渡配置。
   * transitionMs：进入目标值的过渡时长
   * easing：进入时缓动函数名
   * releaseMs：结束后恢复默认的过渡时长
   * releaseTargetValue：释放时的目标值（默认为0，但眼睛等参数可自定义为1）
   */
  private readonly PARAM_CONFIG: Record<
    string,
    {
      transitionMs: number
      easing: keyof Live2DManager['EASING_FUNCTIONS']
      releaseMs: number
      releaseTargetValue?: number
    }
  > = {
    // 眼球 —— 最快，带弹性（释放时回到0，中立位置）
    ParamEyeBallX: {
      transitionMs: 80,
      easing: 'easeOutCubic',
      releaseMs: 500,
      releaseTargetValue: 0
    },
    ParamEyeBallY: {
      transitionMs: 80,
      easing: 'easeOutCubic',
      releaseMs: 500,
      releaseTargetValue: 0
    },
    // 眼睛开合 —— 释放时应该回到睁开状态（1），而不是闭合（0）
    ParamEyeLOpen: {
      transitionMs: 130,
      easing: 'easeInCubic',
      releaseMs: 700,
      releaseTargetValue: 1
    },
    ParamEyeROpen: {
      transitionMs: 130,
      easing: 'easeInCubic',
      releaseMs: 700,
      releaseTargetValue: 1
    }
  }

  private readonly DEFAULT_PARAM_CONFIG: {
    transitionMs: number
    easing: keyof Live2DManager['EASING_FUNCTIONS']
    releaseMs: number
    releaseTargetValue: number
  } = {
    transitionMs: 220,
    easing: 'linear',
    releaseMs: 1000,
    releaseTargetValue: 0
  }

  /**
   * 缓动函数集合
   */
  private EASING_FUNCTIONS = {
    // 线性（匀速）
    linear: (t: number) => t,
    // 缓入
    easeIn: (t: number) => t * t,
    // 缓出
    easeOut: (t: number) => t * (2 - t),
    // 缓入缓出
    easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    // 更平滑的缓入缓出
    easeInCubic: (t: number) => t * t * t,
    // 更平滑的缓出
    easeOutCubic: (t: number) => {
      const s = t - 1
      return s * s * s + 1
    },
    // 更平滑的缓入缓出
    easeInOutCubic: (t: number) =>
      t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    // 弹性缓动
    bounce: (t: number) => {
      if (t < 1 / 2.75) return 7.5625 * t * t
      if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
      if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
    }
  }

  /**
   * 获取单例实例
   * @returns Live2DManager 单例实例
   */
  static getInstance(): Live2DManager {
    if (!Live2DManager.instance) {
      Live2DManager.instance = new Live2DManager()
    }
    return Live2DManager.instance
  }

  /**
   * 初始化Live2D模型
   * @param canvasId 画布ID
   * @param modelPath 模型路径
   * @returns Promise<Live2DModel> 模型对象
   */
  public async init(canvasId: string, modelPath: string): Promise<void> {
    if (!canvasId || !modelPath) {
      console.warn('Live2D初始化参数为空')
      return
    }
    // 获取画布元素
    this.canvasElement = document.getElementById(canvasId) as HTMLCanvasElement
    // 创建渲染器
    this.app = new Application()
    await this.app.init({
      preference: 'webgl',
      view: this.canvasElement,
      backgroundAlpha: 0,
      autoStart: true,
      // 允许保存画布,便于获取画布数据
      preserveDrawingBuffer: true,
      // 提高分辨率以获得更清晰的渲染效果，尤其在高 DPI 显示器上
      resolution: 2,
      antialias: true,
      resizeTo: window,
      autoDensity: true,
      sharedTicker: true,
      powerPreference: 'high-performance'
    })

    // 加载模型
    this.model = await Live2DModel.from(modelPath, {
      autoFocus: false,
      autoHitTest: true,
      autoUpdate: true
    })

    this.installMotionManagerHook()

    this.resetModelTransform()

    // 添加模型到舞台
    this.app.stage.addChild(this.model)
    // 初始化 AudioContext
    this.audioContext = new AudioContext()
  }

  /**
   * 销毁方法
   */
  public destroy(): void {
    // 清理 initListeners 注册的 DOM 事件监听器
    if (this.listenerAbortController) {
      this.listenerAbortController.abort()
      this.listenerAbortController = null
    }

    // 清理监听器
    this.stopMouseTracking()

    // 获取交互系统实例
    const interactionSystem = InteractionSystem.getInstance()

    interactionSystem.stop()

    // 清理长按定时器
    if (this.mousePressTimer) {
      clearTimeout(this.mousePressTimer)
      this.mousePressTimer = null
    }

    // 清理聚焦定时器
    if (this.focusTimeout) {
      clearTimeout(this.focusTimeout)
      this.focusTimeout = null
    }

    // 清理重设定时器
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer)
    }

    this.isSpeaking = false
    this.currentMouthOpenY = 0
    this.overlayCurrentParams = {}
    this.overlayTargetParams = {}
    this.overlayHoldUntil = 0
    this.overlayLastTickAt = 0
    this.overlayTransitionMs = null

    this.uninstallMotionManagerHook()

    // 销毁模型
    if (this.model) {
      this.model.destroy()
      this.model = null
    }

    // 销毁渲染器
    if (this.app) {
      this.app.destroy(true)
      this.app = null
      this.canvasElement = null
    }
  }

  /**
   * 禁用模型的自动动作和交互，进入纯展示状态
   * 返回是否成功禁用（需要模型存在）
   */
  public disabledModel(): boolean {
    if (!this.model || !this.model.internalModel) return false

    // this.model.internalModel.updateFocus = () => {} // 视线跟随
    this.model.internalModel.motionManager.state.shouldRequestIdleMotion = () => false // idle 动作
    const eyeBlink = (
      this.model.internalModel as unknown as {
        eyeBlink?: { updateParameters?: (...args: unknown[]) => void }
      }
    ).eyeBlink
    if (eyeBlink) {
      eyeBlink.updateParameters = () => {}
    }
    // 将眼睑参数设置为闭合状态
    this.setModelParameterValue('ParamEyeLOpen', 0)
    this.setModelParameterValue('ParamEyeROpen', 0)
    this.disabled = true
    return true
  }

  /**
   * 启用模型的自动动作和交互，恢复正常状态
   */
  public enableModel(): boolean {
    if (!this.model || !this.model.internalModel) return false
    this.disabled = false
    return true
  }

  /*
   * 设置画布内的监听器（鼠标跟踪）
   */
  public initListeners(options: { isPetMode?: boolean } = { isPetMode: false }): void {
    if (this.disabled) return

    // 移除上一次注册的所有 DOM 事件监听器
    if (this.listenerAbortController) {
      this.listenerAbortController.abort()
    }
    this.listenerAbortController = new AbortController()
    const { signal } = this.listenerAbortController

    // 获取交互系统实例
    const interactionSystem = InteractionSystem.getInstance()

    // 鼠标按下事件
    this.canvasElement!.addEventListener(
      'mousedown',
      (e) => {
        // 长按触发模型注视，短按则正常处理点击
        this.isMousePressed = true
        // 记录拖动起始位置
        this.dragStartX = e.clientX
        this.dragStartY = e.clientY
        // 重置触摸轨迹数据
        this.strokeStartAt = Date.now()
        // 触摸开始时重置距离和起始点
        this.strokeDistance = 0
        // 记录当前点为起始点
        this.lastStrokePoint = { x: e.clientX, y: e.clientY }
        // 重置交互位移跟踪
        this.interactionMaxDisplacement = 0
        // 检测交互是否起始于模型非透明区域
        this.interactionStartedOnTransparent = this.isPixelTransparentFromEvent(e)
        // 仅在点击模型区域时触发 tap
        if (!this.interactionStartedOnTransparent) {
          this.model!.tap(e.x, e.y)
        }
        // 设置长按定时器
        this.mousePressTimer = setTimeout(() => {
          // 长按触发，如果已锁定则启用注视
          if (this.isMousePressed && this.model && this.isLocked) {
            this.isFocusEnabled = true
          }
        }, this.longPressDuration)
      },
      { signal }
    )

    // 鼠标移动事件
    this.canvasElement!.addEventListener(
      'mousemove',
      (e) => {
        // 长按期间持续更新模型视线（仅在锁定且启用注视时）
        if (this.isMousePressed && this.isFocusEnabled && this.model && this.isLocked) {
          const rect = this.canvasElement!.getBoundingClientRect()
          const relativeX = e.clientX - rect.left
          const relativeY = e.clientY - rect.top
          this.model.focus(relativeX, relativeY, false)
        }

        // 拖动模型（仅在未锁定和非桌宠模式时可用）
        if (this.isMousePressed && !this.isLocked && !options.isPetMode && this.model) {
          const deltaX = e.clientX - this.dragStartX
          const deltaY = e.clientY - this.dragStartY

          this.model.x += deltaX
          this.model.y += deltaY

          this.dragStartX = e.clientX
          this.dragStartY = e.clientY
        }
        // 计算触摸轨迹距离（仅在长按期间）
        if (this.isMousePressed && this.lastStrokePoint) {
          const dx = e.clientX - this.lastStrokePoint.x
          const dy = e.clientY - this.lastStrokePoint.y
          const delta = Math.hypot(dx, dy)
          this.strokeDistance += delta
          this.interactionMaxDisplacement += delta
          this.lastStrokePoint = { x: e.clientX, y: e.clientY }
        }
      },
      { signal }
    )

    // 鼠标抬起事件
    this.canvasElement!.addEventListener(
      'mouseup',
      (e) => {
        // 仅在交互起始于模型非透明区域时处理
        if (!this.interactionStartedOnTransparent) {
          const strokeDurationMs = Date.now() - this.strokeStartAt
          const displacement = this.interactionMaxDisplacement

          if (displacement < 5) {
            // 几乎无移动 → 点击，按位置映射身体部位
            this.handleModelClick(e)
          } else if (displacement >= 12 && strokeDurationMs >= 120) {
            // 明显滑动 → 仅在头部区域触发摸头事件
            const rect = this.canvasElement!.getBoundingClientRect()
            const cssX = e.clientX - rect.left
            const cssY = e.clientY - rect.top

            if (this.isPositionOnModelHead(cssX, cssY)) {
              const speedPxPerSecond = (this.strokeDistance / strokeDurationMs) * 1000
              const configStore = useConfigStore()
              const speedThreshold = Math.max(
                60,
                Number(configStore.config.live2dStrokeSpeedThreshold || 360)
              )
              interactionSystem.triggerEvent(
                speedPxPerSecond >= speedThreshold
                  ? 'live2d.stroke.head.heavy'
                  : 'live2d.stroke.head.light'
              )
            }
          }
          // 中间位移（5-11px）静默忽略，避免误触发
        }

        // 释放，重置所有交互状态
        this.isMousePressed = false
        this.strokeDistance = 0
        this.lastStrokePoint = null
        this.interactionStartedOnTransparent = false
        this.interactionMaxDisplacement = 0

        // 清除长按定时器
        if (this.mousePressTimer) {
          clearTimeout(this.mousePressTimer)
          this.mousePressTimer = null
        }

        // 取消注视，平滑过渡回中心（仅在锁定模式下）
        if (this.isFocusEnabled && this.isLocked) {
          this.smoothDisableFocus(500)
        }
      },
      { signal }
    )

    this.canvasElement!.addEventListener(
      'mouseleave',
      () => {
        // 重置状态
        this.isMousePressed = false
        // 离开画布时重置触摸轨迹数据
        this.strokeDistance = 0
        // 离开画布时重置最后触摸点
        this.lastStrokePoint = null
        this.interactionStartedOnTransparent = false
        this.interactionMaxDisplacement = 0

        // 清除长按定时器
        if (this.mousePressTimer) {
          clearTimeout(this.mousePressTimer)
          this.mousePressTimer = null
        }

        // 取消注视（仅在锁定模式下）
        if (this.isFocusEnabled && this.isLocked) {
          this.smoothDisableFocus(500)
        }

        // 重置模型可交互状态
        this.ignoreState = false
        // 设置模型忽略鼠标事件，避免在模型区域外触发交互
        if (options.isPetMode) {
          window.api.setIgnoreMouse(false)
        }
        // 清除检查是否进入交互状态定时器
        if (this.restoreTimer) {
          clearTimeout(this.restoreTimer)
          this.restoreTimer = null
        }
      },
      { signal }
    )

    // 只有在非桌宠模式下才启用缩放功能，宠物模式下保持固定大小，使用面板调整
    if (!options.isPetMode) {
      // 鼠标滚轮事件
      this.canvasElement!.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault()

          // 仅在未锁定时允许缩放
          if (!this.model || this.isLocked) return

          // 获取当前缩放值
          let newScale = this.currentScale

          // 向上滚动放大，向下滚动缩小
          if (e.deltaY < 0) {
            newScale += this.scaleStep
          } else {
            newScale -= this.scaleStep
          }

          // 限制缩放范围
          newScale = Math.max(this.minScale, Math.min(newScale, this.maxScale))

          // 更新模型缩放
          this.model.scale.set(newScale)
          this.currentScale = newScale
        },
        { passive: false, signal }
      )
    }
    // 只有在桌宠模式下才启用鼠标事件，离开画布时重置状态
    if (options.isPetMode) {
      // 移除旧的 IPC 监听器，避免重复注册
      window.api.ipcRenderer.removeAllListeners('assistant:mouse-position')
      // 监听来自主进程的鼠标位置更新，更新模型注视位置
      window.api.ipcRenderer.on('assistant:mouse-position', (_event, data) => {
        // // 检测鼠标点击状态
        if (data.isMouseDown) {
          this.handleMouseClick()
        }

        // 只有在启用聚焦时才更新模型视线
        if (this.isFocusEnabled) {
          this.updateModelFocus(data.screenX, data.screenY, data.windowX, data.windowY)
        }
      })

      // 开启全局鼠标跟踪
      this.startMouseTracking()
      // 鼠标移动时更新模型交互,在不透明区域不触发交互
      this.canvasElement!.addEventListener('mousemove', this.updateMouseInteraction, { signal })
    }
  }

  public async switchModel(modelPath: string): Promise<void> {
    if (!modelPath) {
      console.warn('Live2D模型路径为空')
      return
    }
    // 移除旧模型
    if (this.model) {
      this.uninstallMotionManagerHook()
      this.model.destroy()
      this.app!.stage.removeChild(this.model)
    }
    // 加载新模型
    this.model = await Live2DModel.from(modelPath, {
      autoFocus: false,
      autoHitTest: true,
      autoUpdate: true
    })

    // 模型切换后重置语音/动作覆盖状态，避免沿用旧模型参数状态
    this.isSpeaking = false
    this.currentMouthOpenY = 0
    this.overlayCurrentParams = {}
    this.overlayTargetParams = {}
    this.overlayHoldUntil = 0
    this.overlayLastTickAt = 0
    this.overlayTransitionMs = null

    this.motionManagerHookInstalled = false
    this.originalMotionManagerUpdate = null
    this.hookedMotionManager = null
    this.installMotionManagerHook()
    // 添加新模型到舞台
    this.app!.stage.addChild(this.model)

    // 重置模型变换
    this.resetModelTransform()
  }

  /**
   * 重置模型到初始位置和缩放
   */
  public resetModelTransform(): void {
    if (!this.model || !this.app) return

    const displayWidth = this.app.renderer.width
    const displayHeight = this.app.renderer.height

    // 计算基于宽高的缩放比例，让模型尽可能大地填充画布
    const scaleX = displayWidth / this.model.width
    const scaleY = displayHeight / this.model.height

    // 选择较小的缩放比例以确保模型完整显示
    const optimalScale = Math.min(scaleX, scaleY) * 0.9 // 预留一些边距

    this.currentScale = optimalScale

    this.model.scale.set(optimalScale)

    // 设置模型锚点为中心
    this.model.anchor.set(0.5)
    this.model.position.set(this.app.screen.width / 2, this.app.screen.height / 2)
  }

  /**
   * 获取当前模型的缩放值
   */
  public getModelScale(): number {
    return this.currentScale
  }

  /**
   * 设置模型的缩放值
   * @param scale 缩放值
   */
  public setModelScale(scale: number): void {
    const newScale = Math.max(this.minScale, Math.min(scale, this.maxScale))
    if (this.model) {
      this.model.scale.set(newScale)
      this.currentScale = newScale
    }
  }

  /**
   * 设置模型的位置
   * @param x X坐标
   * @param y Y坐标
   */
  public setModelPosition(x: number, y: number): void {
    if (this.model) {
      this.model.x = x
      this.model.y = y
    }
  }

  /**
   * 获取模型的位置
   */
  public getModelPosition(): { x: number; y: number } {
    if (this.model) {
      return { x: this.model.x, y: this.model.y }
    }
    return { x: 0, y: 0 }
  }

  /**
   * 切换锁定状态
   * 锁定时：模型注视鼠标，无法调整大小和位置
   * 未锁定时：可以拖动和滚轮缩放
   */
  public toggleLock(): void {
    this.isLocked = !this.isLocked
    console.log('Lock status:', this.isLocked ? 'LOCKED' : 'UNLOCKED')

    // 如果解锁，平滑取消注视
    if (!this.isLocked && this.isFocusEnabled) {
      this.smoothDisableFocus(500)
    }
  }

  /**
   * 设置锁定状态
   * @param locked 是否锁定
   */
  public setLocked(locked: boolean): void {
    if (this.isLocked === locked) return

    this.isLocked = locked
    console.log('Lock status:', this.isLocked ? 'LOCKED' : 'UNLOCKED')

    // 如果解锁，平滑取消注视
    if (!this.isLocked && this.isFocusEnabled) {
      this.smoothDisableFocus(500)
    }
  }

  /**
   * 获取锁定状态
   */
  public getLocked(): boolean {
    return this.isLocked
  }

  // 处理鼠标点击
  private handleMouseClick(): void {
    // 如果之前未启用聚焦，现在启用
    if (!this.isFocusEnabled) {
      this.isFocusEnabled = true
    }

    // 清除之前的超时定时器
    if (this.focusTimeout) {
      clearTimeout(this.focusTimeout)
    }

    // 设置新的超时定时器：5秒后取消聚焦
    this.focusTimeout = setTimeout(() => {
      // this.disableFocus()
      this.smoothDisableFocus(1500)
    }, this.focus_timeout_ms)
  }

  /**
   * 取消聚焦状态
   */
  public disableFocus(): void {
    if (this.isFocusEnabled) {
      this.isFocusEnabled = false
      // 重置模型视线到模型（中心）
      if (this.model) {
        // this.model.focus(this.model.x, this.model.y)
        this.model.internalModel.focusController.focus(0, 0, false)
      }
    }
  }

  /**
   * 平滑地将模型焦点移回中心位置
   * @param duration 过渡持续时间（毫秒）
   */
  public smoothDisableFocus(duration: number = 1000): void {
    if (this.isFocusEnabled && this.model) {
      this.isFocusEnabled = false

      // 获取当前焦点位置
      const startX = this.model.internalModel.focusController.x
      const startY = this.model.internalModel.focusController.y

      // 目标为中心位置 (0, 0)
      const endX = 0
      const endY = 0

      // 记录开始时间
      const startTime = performance.now()

      // 创建动画循环
      const animate = (currentTime: number): void => {
        // 计算经过的时间
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // 使用缓动函数（easeOutCubic）
        const easeProgress = 1 - Math.pow(1 - progress, 3)

        // 计算当前帧的位置
        const currentX = startX + (endX - startX) * easeProgress
        const currentY = startY + (endY - startY) * easeProgress

        // 更新模型焦点
        this.model!.internalModel.focusController.focus(currentX, currentY, false)

        // 如果动画未完成，继续下一帧
        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }

      // 开始动画
      requestAnimationFrame(animate)
    }
  }

  /**
   * 更新模型注视鼠标的位置
   * @param screenX 屏幕的X坐标
   * @param screenY 屏幕的Y坐标
   * @param windowX 窗口的X坐标
   * @param windowY 窗口的Y坐标
   * @returns void
   */
  private updateModelFocus(
    screenX: number,
    screenY: number,
    windowX: number,
    windowY: number
  ): void {
    if (!this.model || !this.app || !this.isFocusEnabled) return
    // 直接传入相对于窗口的坐标
    const relativeX = screenX - windowX
    const relativeY = screenY - windowY
    this.model.focus(relativeX, relativeY, false)
  }

  /**
   * 开始全局鼠标跟踪
   */
  public startMouseTracking(): void {
    if (!this.isMouseTracking) {
      window.api.ipcRenderer.send('assistant:start-mouse-tracking', null)
      this.isMouseTracking = true
    }
  }

  /**
   * 停止鼠标跟踪（模型恢复初始状态）
   */
  public stopMouseTracking(): void {
    if (this.isMouseTracking) {
      window.api.ipcRenderer.send('assistant:stop-mouse-tracking', null)
      this.isMouseTracking = false
    }

    // 清理聚焦相关的定时器
    if (this.focusTimeout) {
      clearTimeout(this.focusTimeout)
      this.focusTimeout = null
    }

    this.isFocusEnabled = false
  }

  /**
   * 设置音量
   * @param volume 音量值 (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))

    if (this.activeGainNode && this.audioContext) {
      this.activeGainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime)
    }
  }

  /**
   * 获取当前音量
   * @returns 当前音量值
   */
  public getVolume(): number {
    return this.volume
  }

  /**
   * 获取模型参数值，兼容不同版本的 Live2D 运行时 API
   * @param paramId 参数 ID
   * @returns 参数值或 null
   */
  private getModelParameterValue(paramId: string): number | null {
    if (!this.model) return null

    const coreModel = this.model.internalModel.coreModel
    if (!coreModel) return null

    const paramIndex = this.resolveParameterIndex(coreModel, paramId)
    if (paramIndex >= 0) {
      // @ts-expect-error 运行时 API 存在但类型不完整
      if (typeof coreModel.getParameterValueByIndex === 'function') {
        // @ts-expect-error 运行时 API 存在但类型不完整
        const valueByIndex = coreModel.getParameterValueByIndex(paramIndex)
        return valueByIndex
      } else {
        // @ts-expect-error 运行时 API 存在但类型不完整
        const valueLegacy = coreModel.getParameterValue(paramIndex)
        return valueLegacy
      }
    } else {
      return null
    }
  }

  /**
   * 检查模型是否具有指定的参数 ID
   * @param paramId 参数 ID
   * @returns 是否存在该参数
   */
  private hasModelParameter(paramId: string): boolean {
    if (!this.model) return false
    try {
      const coreModel = this.model.internalModel.coreModel
      if (!coreModel) return false
      return this.resolveParameterIndex(coreModel, paramId) >= 0
    } catch {
      return false
    }
  }

  /**
   * 从 coreModel 中解析参数 ID 对应的真实索引。
   * 某些 Cubism 运行时的 getParameterIndex 需要 CubismIdHandle，
   * 直接传字符串会落入 not-exist 参数槽，导致写入看似成功但不生效。
   */
  private resolveParameterIndex(coreModel: unknown, paramId: string): number {
    if (!coreModel || !paramId || typeof coreModel !== 'object') return -1

    const modelLike = coreModel as {
      getParameterCount?: () => number
      getParameterId?: (index: number) => unknown
      getParameterIndex?: (parameterId: unknown) => number
    }

    // 优先按参数列表逐项比对，确保字符串 ID 在不同运行时都能命中真实参数
    if (
      typeof modelLike.getParameterCount === 'function' &&
      typeof modelLike.getParameterId === 'function'
    ) {
      const count = modelLike.getParameterCount()
      for (let i = 0; i < count; i++) {
        const idHandle = modelLike.getParameterId(i)
        const idString = this.normalizeCubismId(idHandle)
        if (idString === paramId) return i
      }
    }

    // 兜底：若运行时支持字符串 getParameterIndex 且会返回真实索引，继续兼容
    if (typeof modelLike.getParameterIndex === 'function') {
      const fallbackIndex = modelLike.getParameterIndex(paramId)
      const count =
        typeof modelLike.getParameterCount === 'function' ? modelLike.getParameterCount() : 0
      if (typeof fallbackIndex === 'number' && fallbackIndex >= 0 && fallbackIndex < count) {
        return fallbackIndex
      }
    }

    return -1
  }

  private setModelParameterValue(paramId: string, value: number): boolean {
    if (!this.model || !this.model.internalModel) return false

    const coreModel = this.model.internalModel.coreModel
    const paramIndex = this.resolveParameterIndex(coreModel, paramId)

    if (paramIndex < 0) return false
    // @ts-expect-error 运行时 API 存在但类型不完整
    if (typeof coreModel.setParameterValue === 'function') {
      // @ts-expect-error 运行时 API 存在但类型不完整
      coreModel.setParameterValue(paramIndex, value)
      return true
      // @ts-expect-error 运行时 API 存在但类型不完整
    } else if (typeof coreModel.setParameterValueByIndex === 'function') {
      // @ts-expect-error 运行时 API 存在但类型不完整
      coreModel.setParameterValueByIndex(paramIndex, value, 1)
      return true
    } else {
      console.warn(
        `无法设置参数 ${paramId}，运行时不支持 setParameterValue 或 setParameterValueByIndex`
      )
      return true
    }
  }

  /*
   * 安装对 motionManager.update 的挂钩，以在动作更新后应用参数覆盖
   * 这允许我们在动作帧过渡期间持续覆盖参数（如口型），而不会被动作本身覆盖
   */
  private installMotionManagerHook(): void {
    if (!this.model || this.motionManagerHookInstalled) return

    const motionManager = this.model.internalModel.motionManager
    const originalUpdate = motionManager.update
    this.originalMotionManagerUpdate = originalUpdate
    this.hookedMotionManager = motionManager

    motionManager.update = (coreModel: object, now: number): boolean => {
      const result = originalUpdate.call(motionManager, coreModel, now)

      // 1. 先执行动作参数覆盖层（pose 级别）
      this.tickMotionOverlay(performance.now())

      // 3. 最后写入口型，确保语音驱动不被覆盖
      if (this.isSpeaking) {
        this.setModelParameterValue('ParamMouthOpenY', this.currentMouthOpenY)
      }

      return result
    }

    this.motionManagerHookInstalled = true
  }

  private uninstallMotionManagerHook(): void {
    if (!this.motionManagerHookInstalled) {
      this.originalMotionManagerUpdate = null
      this.hookedMotionManager = null
      return
    }

    if (this.hookedMotionManager && this.originalMotionManagerUpdate) {
      this.hookedMotionManager.update = this.originalMotionManagerUpdate
    }

    this.originalMotionManagerUpdate = null
    this.hookedMotionManager = null
    this.motionManagerHookInstalled = false
  }

  /**
   * 应用动作帧参数
   * @param parameters Live2D 参数键值对
   */
  public applyMotionFrame(parameters: Record<string, number>, options?: MotionFrameOptions): void {
    if (!this.model || !parameters) return

    const targetParams: Record<string, number> = {}
    const speakingBlockedParams = new Set(['ParamMouthOpenY'])

    for (const [paramId, rawValue] of Object.entries(parameters)) {
      // 参数值必须是有效数字，跳过无效值
      if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) continue
      // 如果正在说话且该参数会被语音覆盖，跳过以避免冲突
      if (this.isSpeaking && speakingBlockedParams.has(paramId)) continue
      // 参数不存在于模型中，跳过（避免无效参数导致的异常）
      if (!this.hasModelParameter(paramId)) continue
      // 获取模型当前值，如果为 null 说明参数不可用，跳过
      const modelValue = this.getModelParameterValue(paramId)
      if (modelValue === null) continue
      // 记录目标参数值，后续在 tickMotionOverlay 中平滑过渡
      targetParams[paramId] = rawValue

      // 若该参数从未被追踪过，从模型当前值出发，避免首次进入时的跳变。
      // 若已在追踪中（chunk 衔接），保留 overlayCurrentParams 的当前插值位置，
      // 直接更新目标即可，插值会从"正在运动的位置"平滑转向新目标。
      if (!(paramId in this.overlayCurrentParams)) {
        this.overlayCurrentParams[paramId] = modelValue
      }
    }
    // 如果没有有效参数需要覆盖，直接返回，避免无意义的过渡和性能开销
    if (Object.keys(targetParams).length === 0) return

    const transitionMs = options?.transitionMs
    // 如果外部指定了过渡时间，且是有效数字，则使用它；否则保持现有的过渡时间设置（可能是上次调用时设置的，也可能是默认值）
    this.overlayTransitionMs =
      typeof transitionMs === 'number' && Number.isFinite(transitionMs)
        ? this.clampDuration(transitionMs, 60, 2000)
        : null

    const holdDuration = this.clampDuration(options?.holdMs ?? this.overlayDurationMs, 300, 10000)
    // 直接更新目标参数和持续时间，不重置 overlayCurrentParams
    this.overlayTargetParams = targetParams
    // holdUntil 设为当前时间加上持续时长，tickMotionOverlay 会根据这个时间判断是保持阶段还是释放阶段
    this.overlayHoldUntil = performance.now() + holdDuration
  }

  /**
   * 限制持续时间在合理范围内，避免过短或过长导致的异常行为
   * @param value 输入的持续时间（毫秒）
   * @param min 最小持续时间（毫秒）
   * @param max 最大持续时间（毫秒）
   * @returns 限制后的持续时间
   */
  private clampDuration(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min
    }
    return Math.max(min, Math.min(max, value))
  }

  /**
   * 清除当前的动作帧覆盖，平滑恢复模型参数到正常状态
   */
  public clearMotionFrame(): void {
    if (!this.model) {
      this.overlayCurrentParams = {}
      this.overlayTargetParams = {}
      this.overlayHoldUntil = 0
      this.overlayTransitionMs = null
      return
    }
    // 清空目标，让 tickMotionOverlay 执行平滑释放，不立即归零
    this.overlayTargetParams = {}
    this.overlayHoldUntil = 0
    this.overlayTransitionMs = null
  }

  public stopSpeaking(): void {
    this.isSpeaking = false
    this.currentMouthOpenY = 0
    this.model?.stopSpeaking()
  }

  /**
   * 每帧调用，更新动作参数覆盖层并应用到模型。
   * 改动要点：
   *  1. 使用 PARAM_CONFIG 为每个参数独立查询 transitionMs / releaseMs / easing / releaseTargetValue
   *  2. dt 上限 50ms，防止窗口切换后大步长导致参数瞬移
   *  3. 新 chunk 到来时 overlayCurrentParams 保留，从当前位置平滑切换目标
   *  4. 释放阶段根据参数的 releaseTargetValue 进行过渡，眼睛等参数返回到睁开（1）而非闭合（0）
   */
  private tickMotionOverlay(now: number): void {
    // 计算时间步长，第一次 tick 时默认 16ms，后续基于上次 tick 的时间戳计算，确保平滑过渡
    const rawDt = this.overlayLastTickAt > 0 ? now - this.overlayLastTickAt : 16
    // 覆盖层的时间步长计算基于上次 tick 的时间戳，确保无论帧率如何波动，过渡都能保持平滑和一致
    this.overlayLastTickAt = now
    // 上限 50ms，避免页面切换后的超大步长
    const dt = Math.min(rawDt, 50) / 1000
    // 根据当前时间和 holdUntil 判断是保持阶段还是释放阶段，保持阶段使用 targetParams，释放阶段使用各参数的 releaseTargetValue
    const isHolding = now <= this.overlayHoldUntil

    const trackedIds = new Set<string>([
      ...Object.keys(this.overlayCurrentParams),
      ...Object.keys(this.overlayTargetParams)
    ])

    if (trackedIds.size === 0) return

    for (const paramId of trackedIds) {
      // 对于每个正在追踪的参数，分别获取其配置、当前值、目标值，根据当前阶段（保持/释放）计算过渡，并应用到模型
      const cfg = this.PARAM_CONFIG[paramId] ?? this.DEFAULT_PARAM_CONFIG
      // 保持阶段使用 overlayTransitionMs
      const transMs = isHolding ? (this.overlayTransitionMs ?? cfg.transitionMs) : cfg.releaseMs
      // 获取缓动函数
      const easingFn = this.EASING_FUNCTIONS[cfg.easing]
      // 当前值来自 overlayCurrentParams，目标值根据阶段选择 overlayTargetParams 或各参数的 releaseTargetValue
      const currentValue = this.overlayCurrentParams[paramId] ?? 0
      // 保持阶段目标为 overlayTargetParams[paramId]，释放阶段目标为参数的 releaseTargetValue（眼睛为1，其他为0）
      const releaseTarget = cfg.releaseTargetValue ?? 0
      const targetValue = isHolding ? (this.overlayTargetParams[paramId] ?? 0) : releaseTarget

      // 用时间步长计算本帧进度，再经缓动函数映射
      const rawProgress = Math.min(1, dt / (transMs / 1000))
      const easedProgress = easingFn(rawProgress)
      // 根据当前值、目标值和缓动进度计算本帧的新值
      const nextValue = currentValue + (targetValue - currentValue) * easedProgress

      // 释放阶段接近目标值时直接清除，避免长尾抖动
      if (!isHolding && Math.abs(nextValue - releaseTarget) < 0.005) {
        delete this.overlayCurrentParams[paramId]
        continue
      }
      // 更新当前值并应用到模型
      this.overlayCurrentParams[paramId] = nextValue
      this.setModelParameterValue(paramId, nextValue)
    }
    // 如果当前没有任何参数需要保持，清空目标参数，确保模型平滑过渡回默认状态
    if (!isHolding) {
      this.overlayTargetParams = {}
    }
  }

  /**
   * 播放音频,并同步口型 (使用二进制音频数据)
   * @param audioData 音频二进制数据
   * @param volume 音量值 (0.0 to 1.0)
   */
  public async speak(audioData: ArrayBuffer, volume: number = this.volume): Promise<void> {
    if (this.disabled) return

    // const audioUrl = URL.createObjectURL(new Blob([audioData]))
    // this.model?.speak(audioUrl)

    return new Promise((resolve, reject) => {
      try {
        this.isSpeaking = true
        this.currentMouthOpenY = 0
        this.model!.motion('Speak', 0, MotionPriority.NORMAL)
        // this.model!.internalModel.motionManager.state.shouldRequestIdleMotion = () => false // 取消idle 动作

        this.audioContext!.decodeAudioData(audioData)
          .then((audioBuffer) => {
            const source = this.audioContext!.createBufferSource()
            const analyser = this.audioContext!.createAnalyser()
            const gainNode = this.audioContext!.createGain()
            // 设置音量
            gainNode.gain.value = Math.max(0, Math.min(1, volume))
            this.activeGainNode = gainNode

            source.buffer = audioBuffer
            source.connect(gainNode)
            gainNode.connect(analyser)
            analyser.connect(this.audioContext!.destination)

            let requestId: number | null = null

            // 监听音频播放完毕
            source.onended = () => {
              if (requestId !== null) {
                cancelAnimationFrame(requestId)
              }
              this.currentMouthOpenY = 0
              this.setModelParameterValue('ParamMouthOpenY', 0)
              this.isSpeaking = false
              this.activeGainNode = null

              resolve()
            }

            source.start(0)

            const updateMouth = (): void => {
              const dataArray = new Uint8Array(analyser.frequencyBinCount)
              analyser.getByteFrequencyData(dataArray)
              const volume = dataArray.reduce((a, b) => a + b) / dataArray.length
              const mouthOpenCoefficient = 1.2
              const mouthOpen = Math.min(1, (volume / 40) * mouthOpenCoefficient)
              this.currentMouthOpenY = mouthOpen

              requestId = requestAnimationFrame(updateMouth)
            }

            requestId = requestAnimationFrame(updateMouth)
          })
          .catch((error) => {
            this.isSpeaking = false
            this.activeGainNode = null
            reject(error)
          })
      } catch (error) {
        this.isSpeaking = false
        this.activeGainNode = null
        reject(error)
      }
    })
  }

  /**
   * 工具函数
   * 从点击的位置判断像素是否透明
   * @param event 鼠标点击事件对象
   */
  private isPixelTransparentFromEvent(event: MouseEvent): boolean {
    if (!this.app || !this.app.renderer) return false

    const gl = (this.app.renderer as WebGLRenderer).gl
    const canvas = this.app.canvas as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()

    // 计算相对于canvas的CSS坐标
    const cssX = event.clientX - rect.left
    const cssY = event.clientY - rect.top

    // 使用真实画布像素尺寸进行映射，避免 autoDensity / DPI 场景下命中偏移
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1
    const glX = Math.floor(cssX * scaleX)
    const glY = Math.floor(cssY * scaleY)

    // 注意：WebGL坐标系Y轴方向与CSS相反
    const glYFlipped = canvas.height - glY - 1

    // 边界检查
    if (glX < 0 || glYFlipped < 0 || glX >= canvas.width || glYFlipped >= canvas.height) {
      return true // 超出边界视为透明
    }

    const pixels = new Uint8Array(4)
    gl.readPixels(glX, glYFlipped, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    return pixels[3] < 10
  }

  /**
   * 获取模型在屏幕空间的包围盒（CSS像素坐标）
   */
  private getModelScreenBounds(): {
    left: number
    top: number
    right: number
    bottom: number
  } | null {
    if (!this.model) return null
    const bounds = this.model.getBounds()
    return {
      left: bounds.minX,
      top: bounds.minY,
      right: bounds.maxX,
      bottom: bounds.maxY
    }
  }

  /**
   * 判断 canvas 相对坐标是否位于模型头部区域（顶部 25%）
   */
  private isPositionOnModelHead(cssX: number, cssY: number): boolean {
    const bounds = this.getModelScreenBounds()
    if (!bounds) return false
    if (cssX < bounds.left || cssX > bounds.right || cssY < bounds.top || cssY > bounds.bottom) {
      return false
    }
    const relativeY = (cssY - bounds.top) / (bounds.bottom - bounds.top)
    return relativeY <= 0.25
  }

  /**
   * 根据 canvas 相对坐标映射到身体部位
   * 简单划分：顶部 15% 为头部，15%-25% 为脸部，25%-70% 为身体（左右 25% 为手），70%-底部为腿部
   * 这种划分是基于常见模型的比例设计的，实际效果可能因模型设计而异
   */
  private getBodyPartAtPosition(cssX: number, cssY: number): string | null {
    const bounds = this.getModelScreenBounds()
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

  /**
   * 处理模型点击事件——根据点击位置映射到身体部位并触发对应的 live2d.hit 事件
   */
  private handleModelClick(event: MouseEvent): void {
    if (!this.canvasElement) return
    // 二次确认：释放时像素仍在模型非透明区域
    if (this.isPixelTransparentFromEvent(event)) return

    const rect = this.canvasElement.getBoundingClientRect()
    const cssX = event.clientX - rect.left
    const cssY = event.clientY - rect.top
    const bodyPart = this.getBodyPartAtPosition(cssX, cssY)
    if (!bodyPart) return

    const eventMap: Record<string, string> = {
      head: 'live2d.hit.part.head',
      face: 'live2d.hit.part.face',
      body: 'live2d.hit.body',
      hand: 'live2d.hit.part.hand',
      leg: 'live2d.hit.part.leg'
    }
    const eventName = eventMap[bodyPart]
    if (eventName) {
      InteractionSystem.getInstance().triggerEvent(eventName)
    }
  }

  /**
   * 鼠标交互处理
   * 方法通过节流处理鼠标移动事件
   * 核心功能是根据像素透明度判断是否忽略鼠标事件
   * 控制鼠标与 Live2D 模型的交互状态
   */
  private updateMouseInteraction = throttle((event: MouseEvent) => {
    // 透明像素检测
    const shouldIgnore = this.isPixelTransparentFromEvent(event)
    // 是否忽略鼠标事件，当透明像素检测结果与当前状态不一致时，更新状态并通知 API
    if (shouldIgnore !== this.ignoreState) {
      // 更新状态
      this.ignoreState = shouldIgnore
      // 通知 API
      window.api.setIgnoreMouse(this.ignoreState)
      // 如果 forward 在某些环境不工作，启用回退恢复，防止长时间卡死
      if (this.ignoreState) {
        // 如果存在计时器，则取消
        if (this.restoreTimer) {
          window.clearTimeout(this.restoreTimer)
        }
        // 设置计时器
        this.restoreTimer = setTimeout(() => {
          this.ignoreState = false
          window.api.setIgnoreMouse(false)
          this.restoreTimer = null
        }, 1000) // 1000ms后强制回退
      } else {
        // 如果存在计时器，则取消
        if (this.restoreTimer) {
          window.clearTimeout(this.restoreTimer)
          this.restoreTimer = null
        }
      }
    }
  }, 200) // 每 200ms 检测一次

  /**
   * 将 CubismIdHandle / csmString 规范化为字符串 ID。
   */
  private normalizeCubismId(idHandle: unknown): string | null {
    // console.log('Normalizing Cubism ID handle:', idHandle)
    if (!idHandle) return null
    if (typeof idHandle === 'string') return idHandle

    // 常见形态：idHandle.getString().s
    if (
      typeof idHandle === 'object' &&
      idHandle !== null &&
      'getString' in idHandle &&
      typeof (idHandle as { getString?: unknown }).getString === 'function'
    ) {
      const raw = (idHandle as { getString: () => unknown }).getString()
      if (typeof raw === 'string') return raw
      if (
        raw &&
        typeof raw === 'object' &&
        's' in raw &&
        typeof (raw as { s?: unknown }).s === 'string'
      ) {
        return (raw as { s: string }).s
      }
    }

    const maybeToString = (idHandle as { toString?: unknown }).toString
    if (typeof maybeToString === 'function') {
      const value = maybeToString.call(idHandle)
      if (typeof value === 'string' && value !== '[object Object]') return value
    }

    return null
  }
}
