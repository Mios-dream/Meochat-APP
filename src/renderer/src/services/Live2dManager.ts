import { Live2DModel, MotionPriority, config } from 'pixi-live2d-display-lipsyncpatch'
import * as PIXI from 'pixi.js'
// import { ChatService } from '../utils/ChatService'
import throttle from '../utils/Throttle'

// 设置模型配置
config.motionFadingDuration = 500
config.idleMotionFadingDuration = 500
config.expressionFadingDuration = 500

export class Live2DManager {
  // 单例模式
  private static instance: Live2DManager
  // 画布元素
  private canvasElement: HTMLCanvasElement | null = null
  // 渲染器
  public app: PIXI.Application | null = null
  // 模型对象
  private model: Live2DModel | null = null
  // 音频上下文
  private audioContext: AudioContext | null = null
  // 是否聚焦鼠标，用于全局鼠标跟踪
  private isMouseTracking = false
  // 用于控制聚焦的状态
  private isFocusEnabled = false
  // 聚焦超时定时器
  private focusTimeout: NodeJS.Timeout | null = null
  // 聚焦超时,用于全局
  public focus_timeout_ms = 5000 // 5秒无点击后取消聚焦
  // 用于控制忽略状态
  private ignoreState = false
  // 恢复模型状态的定时器
  private restoreTimer: NodeJS.Timeout | null = null

  // 用于画布内鼠标跟踪
  // 鼠标点击和长按状态
  private isMousePressed = false
  // 鼠标按下的定时器
  private mousePressTimer: NodeJS.Timeout | null = null
  // 鼠标长按触发时间
  private longPressDuration = 100 // 长按触发时间（毫秒）

  private dragStartX = 0
  private dragStartY = 0

  // 缩放相关
  private currentScale = 1
  private minScale = 0.1
  private maxScale = 2
  private scaleStep = 0.05
  // 画步锁定相关
  private isLocked = false

  // 音量控制属性
  private volume: number = 1.0 // 0.0 to 1.0

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
   * 计算模型缩放比例
   * @param canvasWidth 画布宽度
   * @param canvasHeight 画布高度
   * @param modelWidth 模型宽度
   * @param modelHeight 模型高度
   * @returns 模型缩放比例
   */
  private calculateOptimalScale(
    canvasWidth: number,
    canvasHeight: number,
    modelWidth: number,
    modelHeight: number
  ): number {
    // 计算基于宽高的缩放比例，让模型尽可能大地填充画布
    const scaleX = canvasWidth / modelWidth
    const scaleY = canvasHeight / modelHeight

    // 选择较小的缩放比例以确保模型完整显示
    const scale = Math.min(scaleX, scaleY)

    console.log('Scale calculation:', {
      canvasWidth,
      canvasHeight,
      modelWidth,
      modelHeight,
      scaleX,
      scaleY,
      finalScale: scale
    })

    return scale
  }

  /**
   * 初始化Live2D模型
   * @param canvasId 画布ID
   * @param modelPath 模型路径
   * @returns Promise<Live2DModel> 模型对象
   */
  public async init(canvasId: string, modelPath: string): Promise<Live2DModel> {
    // 获取画布元素
    this.canvasElement = document.getElementById(canvasId) as HTMLCanvasElement
    // 创建渲染器
    this.app = new PIXI.Application({
      view: this.canvasElement,
      resizeTo: this.canvasElement,
      backgroundAlpha: 0,
      autoStart: true,
      // 允许保存画布,便于获取画布数据
      preserveDrawingBuffer: true,
      resolution: 2
    })

    // 加载模型
    this.model = await Live2DModel.from(modelPath, {
      ticker: PIXI.Ticker.shared,
      autoInteract: false
    })

    this.resetModelTransform()

    // 添加模型到舞台
    this.app.stage.addChild(this.model)
    // 初始化 AudioContext
    this.audioContext = new AudioContext()

    return this.model
  }

  /*
   * 设置画布内的监听器（鼠标跟踪）
   */
  public initBaseListeners(): void {
    // 鼠标按下事件
    this.canvasElement!.addEventListener('pointerdown', (e) => {
      this.isMousePressed = true
      this.dragStartX = e.clientX
      this.dragStartY = e.clientY

      // 设置长按定时器
      this.mousePressTimer = setTimeout(() => {
        // 长按触发，如果已锁定则启用注视
        if (this.isMousePressed && this.model && this.isLocked) {
          this.isFocusEnabled = true
          console.log('Long press detected, model starts gazing at mouse')
        }
      }, this.longPressDuration)
    })

    // 鼠标移动事件
    this.canvasElement!.addEventListener('pointermove', (e) => {
      // 长按期间持续更新模型视线（仅在锁定且启用注视时）
      if (this.isMousePressed && this.isFocusEnabled && this.model && this.app && this.isLocked) {
        const rect = this.canvasElement!.getBoundingClientRect()
        const relativeX = e.clientX - rect.left
        const relativeY = e.clientY - rect.top

        this.model.focus(relativeX, relativeY, false)
      }

      // 拖动模型（仅在未锁定时可用）
      if (this.isMousePressed && !this.isLocked && this.model) {
        const deltaX = e.clientX - this.dragStartX
        const deltaY = e.clientY - this.dragStartY

        this.model.x += deltaX
        this.model.y += deltaY

        this.dragStartX = e.clientX
        this.dragStartY = e.clientY
      }
    })

    // 鼠标抬起事件
    this.canvasElement!.addEventListener('pointerup', () => {
      this.isMousePressed = false

      // 清除长按定时器
      if (this.mousePressTimer) {
        clearTimeout(this.mousePressTimer)
        this.mousePressTimer = null
      }

      // 取消注视，平滑过渡回中心（仅在锁定模式下）
      if (this.isFocusEnabled && this.isLocked) {
        this.smoothDisableFocus(500)
      }

      // 如果未锁定，确保注视功能关闭
      if (!this.isLocked) {
        this.isFocusEnabled = false
      }
    })

    // 鼠标离开画布
    this.canvasElement!.addEventListener('pointerleave', () => {
      this.isMousePressed = false

      // 清除长按定时器
      if (this.mousePressTimer) {
        clearTimeout(this.mousePressTimer)
        this.mousePressTimer = null
      }

      // 取消注视（仅在锁定模式下）
      if (this.isFocusEnabled && this.isLocked) {
        this.smoothDisableFocus(500)
      }

      // 如果未锁定，确保注视功能关闭
      if (!this.isLocked) {
        this.isFocusEnabled = false
      }
    })

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
      { passive: false }
    )
  }

  /**
   * 重置模型到初始位置和缩放
   */
  public resetModelTransform(): void {
    if (!this.model || !this.app) return

    const displayWidth = this.app.renderer.width / this.app.renderer.resolution
    const displayHeight = this.app.renderer.height / this.app.renderer.resolution

    // 计算最优缩放
    const optimalScale = this.calculateOptimalScale(
      displayWidth,
      displayHeight,
      this.model.width,
      this.model.height
    )
    this.currentScale = optimalScale

    this.model.scale.set(optimalScale)

    // 设置模型锚点为中心
    this.model.anchor.set(0.5, 0.5)
    // 居中模型（使用显示尺寸的中心）
    this.model.x = displayWidth / 2
    this.model.y = displayHeight / 2
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

  /**
   * 初始化事件监听器
   */
  public initListeners(): void {
    // 开启鼠标跟踪
    this.startMouseTracking()

    // 监听来自主进程的鼠标位置更新
    window.api.ipcRenderer.on('assistant:mouse-position', (_event, data) => {
      // 检测鼠标点击状态
      if (data.isMouseDown) {
        this.handleMouseClick()
      }

      // 只有在启用聚焦时才更新模型视线
      if (this.isFocusEnabled) {
        this.updateModelFocus(data.screenX, data.screenY, data.windowX, data.windowY)
      }
    })

    // 鼠标移动时更新模型交互
    this.canvasElement!.addEventListener('mousemove', this.updateMouseInteraction)

    // 鼠标离开时取消穿透状态
    this.canvasElement!.addEventListener('mouseleave', () => {
      this.ignoreState = false
      window.api.setIgnoreMouse(false)
      if (this.restoreTimer) {
        clearTimeout(this.restoreTimer)
        this.restoreTimer = null
      }
    })

    // 监听鼠标点击事件，触发模型的hit
    this.canvasElement!.addEventListener('pointerdown', (e) =>
      this.model!.tap(e.clientX, e.clientY)
    )

    // 监听模型点击事件
    this.model!.on('hit', (hitAreaNames) => {
      console.log('Hit:', hitAreaNames)
      // chatService.showTempMessage('点击了' + hitAreaNames.join(', '), 2000, 10)
    })
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
   * 开始鼠标跟踪（模型注视鼠标）
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
  }

  /**
   * 获取当前音量
   * @returns 当前音量值
   */
  public getVolume(): number {
    return this.volume
  }

  /**
   * 播放音频,并同步口型 (使用二进制音频数据)
   * @param audioData 音频二进制数据
   * @param volume 音量值 (0.0 to 1.0)
   */
  public async speak(audioData: ArrayBuffer, volume: number = this.volume): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.model!.motion('Speak', 0, MotionPriority.NORMAL)
        // this.model!.internalModel.motionManager.state.shouldRequestIdleMotion = () => false // 取消idle 动作

        this.audioContext!.decodeAudioData(audioData).then((audioBuffer) => {
          const source = this.audioContext!.createBufferSource()
          const analyser = this.audioContext!.createAnalyser()
          const gainNode = this.audioContext!.createGain()
          // 设置音量
          gainNode.gain.value = Math.max(0, Math.min(1, volume))

          source.buffer = audioBuffer
          analyser.connect(this.audioContext!.destination)
          source.connect(analyser)
          gainNode.connect(this.audioContext!.destination)

          let requestId: number | null = null
          let originalUpdate: ((coreModel: object, now: number) => boolean) | null = null

          // 监听音频播放完毕
          source.onended = () => {
            if (requestId !== null) {
              cancelAnimationFrame(requestId)
            }
            // 恢复原始的 update 方法
            if (originalUpdate) {
              this.model!.internalModel.motionManager.update = originalUpdate
            }

            // @ts-expect-error 无法找到模型参数
            this.model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', 0, 1)

            resolve()
          }

          source.start(0)

          const updateMouth = (): void => {
            const dataArray = new Uint8Array(analyser.frequencyBinCount)
            analyser.getByteFrequencyData(dataArray)
            const volume = dataArray.reduce((a, b) => a + b) / dataArray.length
            const mouthOpenCoefficient = 1.2
            const mouthOpen = Math.min(1, (volume / 40) * mouthOpenCoefficient)
            // 只有在没有保存原始更新方法时才保存一次
            if (!originalUpdate) {
              originalUpdate = this.model!.internalModel.motionManager.update
            }
            // @ts-expect-error 无法找到模型参数
            this.model!.internalModel.motionManager.update = (coreModel, time) => {
              // 调用原始更新方法
              originalUpdate!.call(this.model!.internalModel.motionManager, coreModel, time)

              // 更新嘴巴参数
              // @ts-expect-error 无法找到模型参数
              this.model!.internalModel.coreModel.setParameterValueById(
                'ParamMouthOpenY',
                mouthOpen
              )
            }

            requestId = requestAnimationFrame(updateMouth)
          }

          requestId = requestAnimationFrame(updateMouth)
        })
      } catch (error) {
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

    const gl = (this.app.renderer as PIXI.Renderer).gl
    const canvas = this.app.view as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()

    // 计算相对于canvas的CSS坐标
    const cssX = event.clientX - rect.left
    const cssY = event.clientY - rect.top

    // 考虑分辨率差异，将CSS坐标转换为GL坐标
    const resolution = this.app.renderer.resolution || 1
    const glX = Math.floor(cssX * resolution)
    const glY = Math.floor(cssY * resolution)

    // 注意：WebGL坐标系Y轴方向与CSS相反
    const glYFlipped = this.app.renderer.height - glY

    // 边界检查
    if (
      glX < 0 ||
      glYFlipped < 0 ||
      glX >= this.app.renderer.width ||
      glYFlipped >= this.app.renderer.height
    ) {
      return true // 超出边界视为透明
    }

    const pixels = new Uint8Array(4)
    gl.readPixels(glX, glYFlipped, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    return pixels[3] < 10
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
   * 销毁方法
   */
  destroy(): void {
    // 清理监听器
    this.stopMouseTracking()

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
}
