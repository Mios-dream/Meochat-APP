import { Live2DModel, config } from 'untitled-pixi-live2d-engine'
import { Application } from 'pixi.js'
import {
  getModelParameterValue,
  hasModelParameter,
  setModelParameterValue as writeModelParameterValue
} from './live2d/tools/parameterAccess'
import type { Live2DPartName, MotionFrameOptions, Live2DPointerPorts } from './live2d/types'
import { Live2DMotionOverlayController } from './live2d/controllers/Live2DMotionOverlayController'
import { Live2DSpeechController } from './live2d/controllers/Live2DSpeechController'
import { Live2DMotionHookController } from './live2d/controllers/Live2DMotionHookController'
import { Live2DTransformController } from './live2d/controllers/Live2DTransformController'
import { Live2DSleepController } from './live2d/controllers/Live2DSleepController'
import { Live2DPointerController } from './live2d/controllers/Live2DPointerController'

interface ExpressionParameter {
  Id: string
  Value: number
  Blend: string
}

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
  // 设置默认帧率为 60，避免过高帧率导致性能问题
  private fps = 60
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
  // 表情文件名 → 完整 URL 的映射（由扫描 live2d 目录构建）
  private expressionMap: Map<string, { parameters: ExpressionParameter[] }> = new Map()

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

  // 保存的原始眨眼 updateParameters 方法引用，用于恢复
  private originalEyeBlinkUpdate: ((...args: unknown[]) => void) | null = null

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
      resolution: window.devicePixelRatio,
      powerPreference: 'high-performance'
    })

    // 加载模型
    this.model = await Live2DModel.from(modelPath, {
      autoFocus: false,
      autoHitTest: true,
      autoUpdate: true
    })

    this.setFPS(this.fps)

    this.installMotionManagerHook()

    // 先添加模型到舞台，再重置变换，确保 getLocalBounds 等测量值准确
    this.app.stage.addChild(this.model)

    this.resetModelTransform()
    // 初始化 AudioContext
    this.audioContext = new AudioContext()

    // 扫描 live2d 目录构建表情文件映射
    void this.initExpressionMap()
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

  public setFPS(fps: number): void {
    this.fps = fps
    if (this.app) {
      this.app.ticker.maxFPS = fps
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
    this.setMotionIdleEnabled(true)
    this.setEyeBlinkEnabled(true)
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
    this.originalEyeBlinkUpdate = null

    this.motionHookController.reset()
    this.installMotionManagerHook()
    // 添加新模型到舞台
    this.app!.stage.addChild(this.model)

    // 重置模型变换
    this.resetModelTransform()

    void this.initExpressionMap()
  }

  /**
   * 扫描 live2d 目录构建表情文件构建表情与参数映射
   */
  private async initExpressionMap(): Promise<void> {
    this.expressionMap = await window.api.scanLive2dExpressions()

    console.log(`[Live2DManager] 表情文件扫描完成: ${this.expressionMap.size} 个文件, `)
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
   * 应用表情。
   *
   * 如果模型有 ExpressionManager（即 model3.json 定义了 Expressions），
   * 使用原生表情系统播放对应名称的表情；
   * 否则（VTube Studio 等模型），读取同目录下的 {name}.exp3.json 文件，
   * 解析其中的参数定义并直接写入模型。
   * @param expressionName 表情名称，对应 exp3.json 文件名（如"shy"）。
   */
  public applyExpression(expressionName: string): void {
    if (!this.model?.internalModel) return

    // if (this.model.internalModel.motionManager.expressionManager) {
    //   void this.model.expression(expressionName)
    //   return
    // }

    const expression = this.expressionMap.get(expressionName)
    if (!expression) {
      console.warn(`[Live2DManager] 未找到表情文件: ${expressionName}`)
      return
    }

    const coreModel = this.model.internalModel.coreModel
    const expressionFrame = this.buildExpressionFrame(coreModel, expression.parameters)

    console.log(`[Live2DManager] 应用表情: ${expressionName}, 参数帧:`, expressionFrame)
    if (!expressionFrame) {
      console.warn(`[Live2DManager] 表情文件无有效参数: ${expressionName}`)
      return
    }

    this.motionOverlayController.applyExpressionFrame(expressionFrame, coreModel, {
      transitionMs: 220,
      holdMs: 2000
    })
  }

  /**
   * 应用多个表情，合并成同一帧叠加写入。
   * @param expressionNames 表情名称列表，对应 exp3.json 文件名（如"shy"）。
   */
  public applyExpressions(expressionNames: string[]): void {
    if (!this.model?.internalModel || !this.expressionMap || expressionNames.length === 0) return

    const expressions = expressionNames
      .map((name) => ({ name, expression: this.expressionMap.get(name) }))
      .filter(
        (item): item is { name: string; expression: { parameters: ExpressionParameter[] } } => {
          if (!item.expression) {
            console.warn(`[Live2DManager] 未找到表情文件: ${item.name}`)
            return false
          }
          return true
        }
      )

    if (expressions.length === 0) {
      return
    }

    const coreModel = this.model.internalModel.coreModel
    const expressionFrame = this.buildCombinedExpressionFrame(
      coreModel,
      expressions.map((item) => item.expression.parameters)
    )

    // console.log(
    //   `[Live2DManager] 应用组合表情: ${expressions.map((item) => item.name).join(', ')}, 参数帧:`,
    //   expressionFrame
    // )
    if (!expressionFrame) {
      console.warn('[Live2DManager] 组合表情无有效参数')
      return
    }

    this.motionOverlayController.applyExpressionFrame(expressionFrame, coreModel, {
      transitionMs: 220,
      holdMs: 2000
    })
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
   * 先停止所有原生动画（包括当前空闲动画），再清除动作帧覆盖，
   * 然后禁用模型自动动作、眨眼和注视，眼睛保持闭合
   */
  public enterSleepMode(): void {
    if (!this.model?.internalModel) return

    // 清空覆盖层
    this.clearMotionFrame()
    // // 禁用待机动画
    this.setMotionIdleEnabled(false)

    this.model.internalModel.motionManager.stopAllMotions()

    this.applyMotionFrame(
      {
        ParamEyeLOpen: 0,
        ParamEyeROpen: 0,
        ParamAngleX: 0,
        ParamAngleY: 0,
        ParamAngleZ: 0,
        ParamBodyAngleX: 0,
        ParamBodyAngleY: 0,
        ParamBodyAngleZ: 0,
        ParamBrowLForm: 0,
        ParamBrowRForm: 0,
        ParamEyeLSmile: 0,
        ParamEyeRSmile: 0,
        ParamMouthOpenY: 0,
        ParamMouthForm: 0
      },
      {
        transitionMs: 1000
      }
    )

    // 进入睡眠模式，禁用空闲动画和眨眼
    this.sleepController.enterSleepMode(
      (enabled) => this.setMotionIdleEnabled(enabled),
      (enabled) => this.setEyeBlinkEnabled(enabled),
      (parameters) => this.applySleepParameters(parameters)
    )
  }

  /**
   * 退出睡眠状态
   * 恢复模型自动动作
   */
  public exitSleepMode(): void {
    if (!this.model?.internalModel) return

    this.sleepController.exitSleepMode(
      (enabled) => this.setMotionIdleEnabled(enabled),
      (enabled) => this.setEyeBlinkEnabled(enabled),
      () => this.clearMotionFrame()
    )

    // 恢复眼睛到睁开状态，使用缓慢过渡
    this.applyMotionFrame(
      {
        ParamEyeLOpen: 1,
        ParamEyeROpen: 1
      },
      {
        transitionMs: 1500
      }
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
   * 设置眨眼是否启用。
   * 动作帧播放时如需控制眼部参数，可临时禁用原生眨眼，播放完毕后恢复。
   */
  public setEyeBlinkEnabled(enabled: boolean): void {
    if (!this.model?.internalModel) {
      console.warn('[Live2D] setEyeBlinkEnabled: model 或 internalModel 不存在')
      return
    }

    const internalModel = this.model.internalModel as unknown as Record<string, unknown>

    const eyeBlink = internalModel.eyeBlink as
      | { updateParameters?: (...args: unknown[]) => void }
      | undefined

    if (!eyeBlink) {
      console.warn('[Live2D] eyeBlink 对象不存在，无法控制眨眼')
      return
    }

    if (enabled) {
      if (this.originalEyeBlinkUpdate) {
        eyeBlink.updateParameters = this.originalEyeBlinkUpdate
        this.originalEyeBlinkUpdate = null
        console.log('[Live2D] 眨眼已恢复，原始方法已还原')
      } else {
        console.log('[Live2D] 眨眼启用：无保存的原始方法，跳过恢复')
      }
    } else {
      if (eyeBlink.updateParameters && !this.originalEyeBlinkUpdate) {
        this.originalEyeBlinkUpdate = eyeBlink.updateParameters.bind(eyeBlink)
        console.log('[Live2D] 原始眨眼方法已保存')
      }
      eyeBlink.updateParameters = () => {}
      console.log('[Live2D] 眨眼已禁用，updateParameters 替换为空函数')
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

  /**
   * 将表情定义转换成可直接重写到模型上的固定参数帧。
   */
  private buildExpressionFrame(
    coreModel: unknown,
    parameters: ExpressionParameter[]
  ): Record<string, number> | null {
    if (!coreModel || !Array.isArray(parameters) || parameters.length === 0) return null

    const frame: Record<string, number> = {}

    for (const parameter of parameters) {
      const paramId = parameter?.Id
      const rawValue = parameter?.Value
      if (!paramId || typeof rawValue !== 'number' || Number.isNaN(rawValue)) continue
      if (!hasModelParameter(coreModel, paramId)) continue

      const currentValue = getModelParameterValue(coreModel, paramId)
      if (currentValue === null) continue

      frame[paramId] = this.blendExpressionValue(currentValue, rawValue, parameter.Blend)
    }

    return Object.keys(frame).length > 0 ? frame : null
  }

  /**
   * 将多个表情参数按顺序叠加成同一帧参数。
   */
  private buildCombinedExpressionFrame(
    coreModel: unknown,
    expressionParameterSets: ExpressionParameter[][]
  ): Record<string, number> | null {
    if (!coreModel || expressionParameterSets.length === 0) return null

    const frame: Record<string, number> = {}

    for (const parameters of expressionParameterSets) {
      if (!Array.isArray(parameters) || parameters.length === 0) continue

      for (const parameter of parameters) {
        const paramId = parameter?.Id
        const rawValue = parameter?.Value
        if (!paramId || typeof rawValue !== 'number' || Number.isNaN(rawValue)) continue
        if (!hasModelParameter(coreModel, paramId)) continue

        const baseValue =
          paramId in frame ? frame[paramId] : getModelParameterValue(coreModel, paramId)

        if (baseValue === null || baseValue === undefined) continue

        frame[paramId] = this.blendExpressionValue(baseValue, rawValue, parameter.Blend)
      }
    }

    return Object.keys(frame).length > 0 ? frame : null
  }

  /**
   * 根据 Blend 类型计算表情参数的最终写入值。
   */
  private blendExpressionValue(currentValue: number, value: number, blend: string): number {
    const normalizedBlend = blend.trim().toLowerCase()

    if (normalizedBlend === 'add') {
      return currentValue + value
    }

    if (normalizedBlend === 'multiply') {
      return currentValue * value
    }

    return value
  }
}
