import { Live2DModel } from 'pixi-live2d-display-lipsyncpatch'
import * as PIXI from 'pixi.js'
import { ChatService } from '../utils/ChatService'
import throttle from './Throttle'

const chatService = ChatService.getInstance()

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

    // 监听鼠标点击事件，触发模型的hit
    this.canvasElement.addEventListener('pointerdown', (event) =>
      this.model.tap(event.clientX, event.clientY),
    )

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

    // 监听模型点击事件
    this.model.on('hit', (hitAreaNames) => {
      console.log('Hit:', hitAreaNames)
      chatService.showTempMessage('点击了' + hitAreaNames.join(', '), 2000, 10)
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
      this.disableFocus()
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
   * 获取模型对象
   * @returns 模型对象
   */
  public getModel(): Live2DModel | null {
    return this.model
  }

  /**
   * 播放音频,并同步口型
   * @param audioFile 音频文件路径
   */
  public async speak(audioFile: string) {
    // 请求加载一个音频文件
    const response = await fetch(audioFile)
    // 将音频读取为原始的二进制数据缓冲区（ArrayBuffer）。音频本身是二进制格式，要先将其加载为 ArrayBuffer 才能进一步处理
    const audioData = await response.arrayBuffer()
    // 将 ArrayBuffer 格式的音频数据解码成 AudioBuffer 对象，可以直接用于播放或处理音频数据。
    const audioBuffer = await this.audioContext.decodeAudioData(audioData)
    // 创建一个音频源节点（AudioBufferSourceNode），该节点用于播放音频数据
    const source = this.audioContext.createBufferSource()
    // 创建一个音频分析节点。这个节点用于实时分析音频数据，提供诸如频谱分析、波形分析等功能
    const analyser = this.audioContext.createAnalyser()
    // 将之前解码得到的 audioBuffer（即音频数据）赋值给 source 节点的 buffer 属性。这样就将加载的音频文件与 source 节点绑定，准备播放。
    source.buffer = audioBuffer
    //  将 音频分析节点 连接到音频上下文的最终目标（即扬声器）
    analyser.connect(this.audioContext.destination)
    // 音频分析节点 将能够分析通过音频源流动的音频数据，并提供频谱或其他音频信息。
    source.connect(analyser)

    // 监听音频播放完毕
    let requestId: number | null = null
    source.onended = () => {
      if (requestId !== null) {
        cancelAnimationFrame(requestId) // 清除请求动画帧
      }
      if (this.model) {
        this.model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', 0) // 闭上嘴巴
      }
    }
    /**
     * 启动音频源的播放，从头开始（这样的话，页面就能够听到声音了）
     * 接下来需要让人物嘴巴更新动弹，即有声音的同时，且能够说话
     * 即为：updateMouth函数
     * */
    source.start(0)

    /**
     * 这个 updateMouth 函数通过从 analyser 获取音频数据并计算音量，动态地更新一个模型的嘴巴张开程度。它的实现方式是每帧都更新一次，
     * 通过音频的音量强度来决定嘴巴的开合程度，从而实现与音频的实时互动。
     * */
    const updateMouth = () => {
      // analyser.frequencyBinCount 表示音频频谱的 bin（频率段）的数量。它是一个整数，表示从频率数据中可以获取多少个频率段的值
      // 使用 analyser 对象的 getByteFrequencyData 方法填充 dataArray 数组。
      // getByteFrequencyData 将音频的频率数据转化为 0-255 范围内的字节值，并存储在 dataArray 中。这个数据表示了音频信号在不同频率范围内的强度。
      // 该方法会将频谱分析的结果填充到 dataArray 数组中，每个元素代表一个频率段的音量强度。
      // 使用 reduce 方法计算 dataArray 数组的所有值的总和，并通过除以数组长度来求得平均值。这个平均值表示音频信号的总体"强度"或"音量"。
      // 这里的 a + b 累加所有音频频段的强度值，最终计算出一个平均值。
      // dataArray.length 是频率数据的总数，通常它等于 analyser.frequencyBinCount。
      // 将计算出的 volume 除以 50，以缩放它到一个合适的范围，得到一个表示"嘴巴张开程度"的值。volume 越大，mouthOpen 越大。
      // 使用 Math.min(1, volume / 50) 保证 mouthOpen 的值不会超过 1，也就是说嘴巴张开程度的最大值是 1。
      // 这意味着，如果音量足够大，mouthOpen 会接近 1，表示嘴巴完全张开；如果音量较小，mouthOpen 会接近 0，表示嘴巴几乎没张开。
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(dataArray)
      const volume = dataArray.reduce((a, b) => a + b) / dataArray.length
      const mouthOpen = Math.min(1, volume / 50)

      // 通过调用 setParameterValueById 方法，将 mouthOpen 的值传递给 model 的内部模型（控制嘴巴大小张开幅度）
      this.model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', mouthOpen)
      requestId = requestAnimationFrame(updateMouth)
    }

    requestId = requestAnimationFrame(updateMouth)
  }

  /**
   * 工具函数
   * 从点击的位置判断像素是否透明
   * @param event 鼠标点击事件对象
   */
  private isPixelTransparentFromEvent(event: MouseEvent) {
    const gl = (this.app.renderer as PIXI.Renderer).gl
    const canvas = this.app.view as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const pixels = new Uint8Array(4)
    gl.readPixels(x, this.app.renderer.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    return pixels[3] < 10
    /**
    方案二
    const app = live2DManager.app
    if (!app || !app.renderer || !app.view) return false
    const rect = app.view.getBoundingClientRect()
    const scaleX = app.renderer.width / rect.width
    const scaleY = app.renderer.height / rect.height

    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top
    if (cssX < 0 || cssY < 0 || cssX > rect.width || cssY > rect.height) return true

    const glX = Math.floor(cssX * scaleX)
    const glY = Math.floor(app.renderer.height - cssY * scaleY) // flip Y

    const gl = app.renderer.gl as WebGLRenderingContext
    if (!gl) return false

    // bounds guard
    if (glX < 0 || glY < 0 || glX >= app.renderer.width || glY >= app.renderer.height) return true

    const pixels = new Uint8Array(4)
    gl.readPixels(glX, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    const alpha = pixels[3]
    return alpha < 10 // 透明阈值
    */
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
