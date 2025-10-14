import { Live2DModel, config } from 'pixi-live2d-display-lipsyncpatch'
import * as PIXI from 'pixi.js'
// import { ChatService } from '../utils/ChatService'
import throttle from './Throttle'

config.motionFadingDuration = 500
config.idleMotionFadingDuration = 500
config.expressionFadingDuration = 500

// const chatService = ChatService.getInstance()

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
  // 是否聚焦鼠标
  private isMouseTracking = false

  // 用于控制聚焦的状态
  private isFocusEnabled = false
  // 聚焦超时定时器
  private focusTimeout: number | null = null
  private readonly FOCUS_TIMEOUT_MS = 5000 // 5秒无点击后取消聚焦
  // 用于控制忽略状态
  private ignoreState = false
  // 恢复模型状态的定时器
  private restoreTimer: number | null = null

  private constructor() {}

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
  public async init(canvasId: string, modelPath: string): Promise<Live2DModel> {
    // 获取画布元素
    this.canvasElement = document.getElementById(canvasId) as HTMLCanvasElement

    // 获取画布尺寸
    let canvasHeight = this.canvasElement.height
    let canvasWidth = this.canvasElement.width
    // 创建渲染器
    this.app = new PIXI.Application({
      view: this.canvasElement,
      resizeTo: this.canvasElement,
      backgroundAlpha: 0,
      autoStart: true,
      // 允许保存画布,便于获取画布数据
      preserveDrawingBuffer: true,
      resolution: 2,
    })

    // 加载模型
    this.model = await Live2DModel.from(modelPath, {
      ticker: PIXI.Ticker.shared,
      autoInteract: false,
    })

    // 适配移动设备
    const xs = window.matchMedia('screen and (max-width: 768px)')
    xs.addEventListener('change', (e) => {
      if (e.matches) this.model.scale.set(0.1)
    })

    // 设置模型位置
    this.model.anchor.set(0.5, 0.5)
    this.model.scale.set(0.13)
    this.model.x = canvasWidth / 2
    this.model.y = canvasHeight + 100
    // 添加模型到舞台
    this.app.stage.addChild(this.model)
    this.initListeners()
    // 初始化 AudioContext
    this.audioContext = new AudioContext()

    return this.model
  }

  /**
   * 初始化事件监听器
   */
  public initListeners(): void {
    // 开启鼠标跟踪
    this.startMouseTracking()

    // 监听来自主进程的鼠标位置更新
    window.assistantAPI.ipcRenderer.on('assistant:mouse-position', (event, data) => {
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
    this.canvasElement.addEventListener('mousemove', this.updateMouseInteraction)

    // 鼠标离开时取消穿透状态
    this.canvasElement.addEventListener('mouseleave', () => {
      this.ignoreState = false
      window.assistantAPI.setIgnoreMouse(false)
      if (this.restoreTimer) {
        clearTimeout(this.restoreTimer)
        this.restoreTimer = null
      }
    })

    // 监听鼠标点击事件，触发模型的hit
    this.canvasElement.addEventListener('pointerdown', (e) => this.model.tap(e.clientX, e.clientY))

    // 监听模型点击事件
    this.model.on('hit', (hitAreaNames) => {
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
    }, this.FOCUS_TIMEOUT_MS)
  }

  /**
   * 取消聚焦状态
   */
  private disableFocus(): void {
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
  private smoothDisableFocus(duration: number = 1000): void {
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
      const animate = (currentTime: number) => {
        // 计算经过的时间
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // 使用缓动函数（easeOutCubic）
        const easeProgress = 1 - Math.pow(1 - progress, 3)

        // 计算当前帧的位置
        const currentX = startX + (endX - startX) * easeProgress
        const currentY = startY + (endY - startY) * easeProgress

        // 更新模型焦点
        this.model.internalModel.focusController.focus(currentX, currentY, false)

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
    windowY: number,
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
  public startMouseTracking() {
    if (!this.isMouseTracking) {
      window.assistantAPI.ipcRenderer.send('assistant:start-mouse-tracking', null)
      this.isMouseTracking = true
    }
  }

  /**
   * 停止鼠标跟踪（模型恢复初始状态）
   */
  public stopMouseTracking() {
    if (this.isMouseTracking) {
      window.assistantAPI.ipcRenderer.send('assistant:stop-mouse-tracking', null)
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
   * 播放音频,并同步口型
   * @param audioFile 音频文件路径
   */
  public async speak(audioFile: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(audioFile)
        const audioData = await response.arrayBuffer()
        const audioBuffer = await this.audioContext.decodeAudioData(audioData)
        const source = this.audioContext.createBufferSource()
        const analyser = this.audioContext.createAnalyser()

        source.buffer = audioBuffer
        analyser.connect(this.audioContext.destination)
        source.connect(analyser)

        let requestId: number | null = null

        // 监听音频播放完毕
        source.onended = () => {
          if (requestId !== null) {
            cancelAnimationFrame(requestId)
          }
          if (this.model) {
            this.model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', 0)
          }
          resolve() // 在这里 resolve Promise
        }

        source.start(0)

        const updateMouth = () => {
          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          analyser.getByteFrequencyData(dataArray)
          const volume = dataArray.reduce((a, b) => a + b) / dataArray.length
          const mouthOpen = Math.min(1, volume / 50)

          this.model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', mouthOpen)
          requestId = requestAnimationFrame(updateMouth)
        }

        requestId = requestAnimationFrame(updateMouth)
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
  private isPixelTransparentFromEvent(event: MouseEvent) {
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
      window.assistantAPI.setIgnoreMouse(this.ignoreState)
      // 如果 forward 在某些环境不工作，启用回退恢复，防止长时间卡死
      if (this.ignoreState) {
        // 如果存在计时器，则取消
        if (this.restoreTimer) {
          window.clearTimeout(this.restoreTimer)
        }
        // 设置计时器
        this.restoreTimer = window.setTimeout(() => {
          this.ignoreState = false
          window.assistantAPI.setIgnoreMouse(false)
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
