import { Live2DModel, config } from 'untitled-pixi-live2d-engine'
import { Application } from 'pixi.js'
import { setModelParameterValue as writeModelParameterValue } from './live2d/tools/parameterAccess'
import type { Live2DPartName, MotionFrameOptions, Live2DPointerPorts } from './live2d/types'
import { Live2DMotionOverlayController } from './live2d/controllers/Live2DMotionOverlayController'
import { Live2DSpeechController } from './live2d/controllers/Live2DSpeechController'
import { Live2DMotionHookController } from './live2d/controllers/Live2DMotionHookController'
import { Live2DTransformController } from './live2d/controllers/Live2DTransformController'
import { Live2DSleepController } from './live2d/controllers/Live2DSleepController'
import { Live2DPointerController } from './live2d/controllers/Live2DPointerController'

// 设置模型配置
config.motionFadingDuration = 500
config.idleMotionFadingDuration = 500
config.expressionFadingDuration = 500

export class Live2DManager {
  // 单例模式
  private static instance: Live2DManager
  // 是否禁用模型,用于错误状态，静止交互
  public disabled = false
  // 是否进入睡眠模式，睡眠模式下模型会进入类似睡梦中的状态，眼睛微闭，动作缓慢，并且注视会变为参数微调而不是直接对焦鼠标位置
  public get sleepModel(): boolean {
    return this.sleepController.isSleeping()
  }

  public set sleepModel(value: boolean) {
    if (value) {
      this.enterSleepMode()
    } else {
      this.exitSleepMode()
    }
  }
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
  // 外部注册的部位回调，Live2DManager 只负责识别具体部位/动作
  private partHandler: ((partName: Live2DPartName) => void) | null = null

  // 语音控制器负责音频播放、音量和口型驱动
  private readonly speechController = new Live2DSpeechController()
  // 动作覆盖控制器负责动作帧叠加、缓动和释放恢复
  private readonly motionOverlayController = new Live2DMotionOverlayController()
  // motionManager.update 钩子控制器负责在运行时动作更新后接管自定义参数写入
  private readonly motionHookController = new Live2DMotionHookController()
  // 变换控制器负责模型位置、缩放和锁定状态
  private readonly transformController = new Live2DTransformController()
  // 睡眠控制器负责睡眠模式和低频睡眠微动
  private readonly sleepController = new Live2DSleepController()
  // 指针控制器负责画布内鼠标、拖动、点击、抚摸和桌宠穿透
  private readonly pointerController = new Live2DPointerController()

  /**
   * 为指针控制器组装最小能力端口。
   * 这样控制器只依赖所需能力，不再依赖整个 Live2DManager 类。
   */
  private readonly pointerPorts: Live2DPointerPorts = {
    getLocked: () => this.getLocked(),
    getFocusEnabled: () => this.getFocusEnabled(),
    setFocusEnabled: (enabled: boolean) => this.setFocusEnabled(enabled),
    smoothDisableFocus: (duration?: number) => this.smoothDisableFocus(duration),
    getModelScale: () => this.getModelScale(),
    setModelScale: (scale: number) => this.setModelScale(scale),
    emitPart: (partName: Live2DPartName) => this.emitPart(partName),
    applyMotionFrame: (parameters: Record<string, number>, options?: MotionFrameOptions) =>
      this.applyMotionFrame(parameters, options),
    startMouseTracking: () => this.startMouseTracking(),
    isSleepModel: () => this.sleepModel
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

    this.pointerController.destroy()

    this.sleepController.reset()
    this.speechController.reset()
    this.motionOverlayController.reset()

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
   * 禁用模型
   * 返回是否成功禁用（需要模型存在）
   */
  public disabledModel(): boolean {
    if (!this.model || !this.model.internalModel) return false

    this.setMotionIdleEnabled(false)
    this.setEyeBlinkEnabled(false)
    this.setEyeOpenValue(0)
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
    if (this.disabled || !this.canvasElement) return

    // 移除上一次注册的所有 DOM 事件监听器
    if (this.listenerAbortController) {
      this.listenerAbortController.abort()
    }
    this.listenerAbortController = new AbortController()
    this.pointerController.bind(
      this.pointerPorts,
      this.canvasElement,
      this.model,
      this.app,
      this.listenerAbortController.signal,
      {
        isPetMode: options.isPetMode ?? false
      }
    )
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
    this.speechController.reset()
    this.motionOverlayController.reset()
    this.sleepController.reset()

    this.motionHookController.reset()
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
    this.transformController.resetModelTransform(this.model, this.app)
  }

  /**
   * 获取当前模型的缩放值
   */
  public getModelScale(): number {
    return this.transformController.getModelScale()
  }

  /**
   * 设置模型的缩放值
   * @param scale 缩放值
   */
  public setModelScale(scale: number): void {
    this.transformController.setModelScale(this.model, scale)
  }

  /**
   * 设置模型的位置
   * @param x X坐标
   * @param y Y坐标
   */
  public setModelPosition(x: number, y: number): void {
    this.transformController.setModelPosition(this.model, x, y)
  }

  /**
   * 获取模型的位置
   */
  public getModelPosition(): { x: number; y: number } {
    return this.transformController.getModelPosition(this.model)
  }

  /**
   * 切换锁定状态
   * 锁定时：模型注视鼠标，无法调整大小和位置
   * 未锁定时：可以拖动和滚轮缩放
   */
  public toggleLock(): void {
    this.transformController.toggleLock(() => {
      if (this.isFocusEnabled) this.smoothDisableFocus(500)
    })
  }

  /**
   * 设置锁定状态
   * @param locked 是否锁定
   */
  public setLocked(locked: boolean): void {
    this.transformController.setLocked(locked, () => {
      if (this.isFocusEnabled) this.smoothDisableFocus(500)
    })
  }

  /**
   * 获取锁定状态
   */
  public getLocked(): boolean {
    return this.transformController.getLocked()
  }

  /**
   * 获取当前是否启用了注视状态。
   */
  public getFocusEnabled(): boolean {
    return this.isFocusEnabled
  }

  /**
   * 设置当前是否启用了注视状态。
   */
  public setFocusEnabled(enabled: boolean): void {
    this.isFocusEnabled = enabled
  }

  /**
   * 触发部位回调。
   */
  public emitPart(partName: Live2DPartName): void {
    this.partHandler?.(partName)
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

    this.isFocusEnabled = false
  }

  /**
   * 设置音量
   * @param volume 音量值 (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.speechController.setVolume(volume, this.audioContext)
  }

  /**
   * 获取当前音量
   * @returns 当前音量值
   */
  public getVolume(): number {
    return this.speechController.getVolume()
  }

  /**
   * 注册部位回调。
   * Live2DManager 只负责识别点击部位/抚摸动作，具体业务由外部决定。
   */
  public onTap(handler: (partName: Live2DPartName) => void): void {
    this.partHandler = handler
  }

  private setModelParameterValue(paramId: string, value: number): boolean {
    if (!this.model || !this.model.internalModel) return false
    return writeModelParameterValue(this.model.internalModel.coreModel, paramId, value)
  }

  /*
   * 安装对 motionManager.update 的挂钩，以在动作更新后应用参数覆盖
   * 这允许我们在动作帧过渡期间持续覆盖参数（如口型），而不会被动作本身覆盖
   */
  private installMotionManagerHook(): void {
    this.motionHookController.install(this.model, () => this.handleAfterMotionUpdate())
  }

  private uninstallMotionManagerHook(): void {
    this.motionHookController.uninstall()
  }

  /**
   * Live2D 内置动作更新后的自定义参数写入。
   */
  private handleAfterMotionUpdate(): void {
    this.motionOverlayController.tick(performance.now(), this.model?.internalModel.coreModel)
    this.sleepController.flushSleepParameters()

    // 最后写入口型，确保语音驱动不被动作覆盖。
    if (this.speechController.isSpeaking()) {
      this.setModelParameterValue('ParamMouthOpenY', this.speechController.getMouthOpenY())
    }
  }

  /**
   * 应用动作帧参数
   * @param parameters Live2D 参数键值对
   */
  public applyMotionFrame(parameters: Record<string, number>, options?: MotionFrameOptions): void {
    if (!this.model) return
    this.motionOverlayController.applyMotionFrame(
      parameters,
      this.model.internalModel.coreModel,
      this.speechController.isSpeaking(),
      options
    )
  }

  /**
   * 清除当前的动作帧覆盖，平滑恢复模型参数到正常状态
   */
  public clearMotionFrame(): void {
    this.motionOverlayController.clearMotionFrame(Boolean(this.model))
  }

  public stopSpeaking(): void {
    this.speechController.stopSpeaking(this.model)
  }

  /**
   * 睡眠模式下对话开始时，让模型保持半睡半醒的眼神表现。
   */
  public startSleepTalkMotion(): void {
    this.sleepController.startDrowsyTalkEyeMotion()
  }

  /**
   * 睡眠模式下对话结束时，让模型重新闭眼回到睡眠待机表现。
   */
  public stopSleepTalkMotion(): void {
    this.sleepController.stopDrowsyTalkEyeMotion()
  }

  /**
   * 播放音频,并同步口型 (使用二进制音频数据)
   * @param audioData 音频二进制数据
   * @param volume 音量值 (0.0 to 1.0)
   */
  public async speak(audioData: ArrayBuffer, volume: number = this.getVolume()): Promise<void> {
    return this.speechController.speak(
      audioData,
      this.model,
      this.audioContext,
      this.model?.internalModel.coreModel,
      this.disabled,
      volume
    )
  }

  /**
   * 进入睡眠待机状态
   * 禁用模型自动动作、眨眼和注视，眼睛保持闭合
   */
  public enterSleepMode(): void {
    if (!this.model) return
    this.sleepController.enterSleepMode(
      (enabled) => this.setMotionIdleEnabled(enabled),
      (enabled) => this.setEyeBlinkEnabled(enabled),
      (value) => this.setEyeOpenValue(value),
      (parameters) => this.applySleepParameters(parameters)
    )
  }

  /**
   * 退出睡眠状态
   * 恢复模型自动动作
   */
  public exitSleepMode(): void {
    this.sleepController.exitSleepMode(
      (enabled) => this.setMotionIdleEnabled(enabled),
      () => this.clearMotionFrame()
    )
  }

  /**
   * 设置 idle 动画是否启用
   */
  private setMotionIdleEnabled(enabled: boolean): void {
    if (!this.model?.internalModel) return
    this.model.internalModel.motionManager.state.shouldRequestIdleMotion = () => enabled
  }

  /**
   * 设置眨眼是否启用
   */
  private setEyeBlinkEnabled(enabled: boolean): void {
    if (!this.model?.internalModel) return
    const eyeBlink = (
      this.model.internalModel as unknown as {
        eyeBlink?: { updateParameters?: (...args: unknown[]) => void }
      }
    ).eyeBlink
    if (eyeBlink) {
      eyeBlink.updateParameters = enabled ? undefined : () => {}
    }
  }

  /**
   * 设置眼睛开合度
   */
  private setEyeOpenValue(value: number): void {
    this.setModelParameterValue('ParamEyeLOpen', value)
    this.setModelParameterValue('ParamEyeROpen', value)
  }

  /**
   * 直接写入睡眠模式眼部参数，避免被动作覆盖层释放逻辑干扰。
   */
  private applySleepParameters(parameters: Record<string, number>): void {
    if (!this.model) return

    for (const [paramId, value] of Object.entries(parameters)) {
      this.setModelParameterValue(paramId, value)
    }
  }
}
