class MicrophoneManager {
  private audioStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private websocket: WebSocket | null = null
  private onRecognitionResult: ((text: string) => void) | null = null
  private targetSampleRate: number = 16000
  private workletNode: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null

  // 重连相关属性
  private reconnectInterval: number = 3000
  private reconnectTimer: NodeJS.Timeout | null = null
  private isManuallyClosed: boolean = false

  /**
   * 获取麦克风权限状态
   */
  public async getPermissionStatus(): Promise<boolean> {
    try {
      const permissionStatus = await navigator.permissions.query({
        name: 'microphone' as PermissionName
      })
      return permissionStatus.state === 'granted'
    } catch (error) {
      console.error('查询麦克风权限失败:', error)
      return false
    }
  }

  /**
   * 初始化 AudioWorklet
   */
  private async initAudioWorklet(context: AudioContext): Promise<void> {
    // AudioWorklet 处理器代码
    const processorCode = `
      class AudioCaptureProcessor extends AudioWorkletProcessor {
        constructor() {
          super()
        }

        process(inputs, outputs, parameters) {
          const input = inputs[0]
          if (input && input[0]) {
            // 发送音频数据到主线程
            this.port.postMessage({
              audioData: input[0]
            })
          }
          return true
        }
      }

      registerProcessor('audio-capture-processor', AudioCaptureProcessor)
    `

    // 创建 Blob URL
    const blob = new Blob([processorCode], { type: 'application/javascript' })
    const processorUrl = URL.createObjectURL(blob)

    try {
      await context.audioWorklet.addModule(processorUrl)
    } finally {
      URL.revokeObjectURL(processorUrl)
    }
  }

  /**
   * 开始录音
   */
  public async startRecording(): Promise<{
    stream: MediaStream
    source: MediaStreamAudioSourceNode
    workletNode: AudioWorkletNode
  }> {
    try {
      // 请求麦克风权限
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: this.targetSampleRate // 尝试直接请求目标采样率
        }
      })

      // 创建 AudioContext
      this.audioContext = new AudioContext({
        sampleRate: this.targetSampleRate
      })

      console.log(`AudioContext 采样率: ${this.audioContext.sampleRate}Hz`)

      // 初始化 AudioWorklet
      await this.initAudioWorklet(this.audioContext)

      // 创建音频源
      this.source = this.audioContext.createMediaStreamSource(this.audioStream)

      // 创建 AudioWorkletNode
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-capture-processor')

      // 监听来自 worklet 的消息
      this.workletNode.port.onmessage = (event) => {
        const audioData = event.data.audioData as Float32Array

        // 如果 AudioContext 采样率不是目标采样率，则进行重采样
        if (this.audioContext!.sampleRate !== this.targetSampleRate) {
          const resampled = this.resampleTo16kHz(audioData, this.audioContext!.sampleRate)
          this.sendAudioData(resampled)
        } else {
          this.sendAudioData(audioData)
        }
      }

      // 连接节点
      this.source.connect(this.workletNode)
      this.workletNode.connect(this.audioContext.destination)

      return {
        stream: this.audioStream,
        source: this.source,
        workletNode: this.workletNode
      }
    } catch (error) {
      console.error('获取麦克风失败:', error)
      throw error
    }
  }

  /**
   * 重采样音频数据到 16kHz
   * @param audioData 音频数据
   * @param sourceSampleRate 源采样率
   * @returns 重采样后的音频数据
   */
  private resampleTo16kHz(audioData: Float32Array, sourceSampleRate: number): Float32Array {
    if (sourceSampleRate === this.targetSampleRate) {
      return audioData
    }

    const sampleRateRatio = sourceSampleRate / this.targetSampleRate
    const newLength = Math.round(audioData.length / sampleRateRatio)
    const result = new Float32Array(newLength)

    // 线性插值重采样
    for (let i = 0; i < newLength; i++) {
      const position = i * sampleRateRatio
      const index = Math.floor(position)
      const fraction = position - index

      if (index + 1 < audioData.length) {
        result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction
      } else {
        result[i] = audioData[index]
      }
    }

    return result
  }

  /**
   * 设置识别结果回调函数
   * @param callback 回调函数
   */
  public setRecognitionCallback(callback: (text: string) => void): void {
    this.onRecognitionResult = callback
  }

  /**
   * 连接到 WebSocket 服务器
   * @param wsUrl WebSocket 服务器地址
   */
  public connectToServer(wsUrl: string): void {
    // 清除之前的重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // 重置手动关闭标志
    this.isManuallyClosed = false

    this.websocket = new WebSocket(wsUrl)

    this.websocket.onopen = () => {
      console.log('WebSocket 连接已建立')
    }

    this.websocket.onmessage = (event) => {
      const data = event.data
      if (this.onRecognitionResult) {
        this.onRecognitionResult(data)
      }
    }

    this.websocket.onerror = (error) => {
      console.error('WebSocket 错误:', error)
    }

    this.websocket.onclose = () => {
      console.log('WebSocket 连接已关闭')

      // 如果不是手动关闭，则尝试重连
      if (!this.isManuallyClosed) {
        console.log('尝试重连...')
        this.reconnectTimer = setTimeout(() => {
          this.connectToServer(wsUrl)
        }, this.reconnectInterval)
      }
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  public disconnect(): void {
    this.isManuallyClosed = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
  }

  /**
   * 发送音频数据到服务器
   * @param audioData 音频数据
   */
  private sendAudioData(audioData: Float32Array): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return
    }

    // 转换为 16-bit PCM
    const pcmData = this.floatTo16BitPCM(audioData)

    // 发送数据到服务器
    const message = {
      type: 'asr',
      data: this.arrayBufferToBase64(pcmData)
    }

    this.websocket.send(JSON.stringify(message))
  }

  /**
   * 将 Float32Array 转换为 16-bit PCM 数据
   * @param input 输入数据
   * @returns 16-bit PCM 数据
   */
  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      // 限制在 [-1, 1] 范围内
      const s = Math.max(-1, Math.min(1, input[i]))
      // 转换为 16-bit 整数
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return output.buffer
  }

  /**
   * 将 ArrayBuffer 转换为 Base64 字符串
   * @param buffer 输入数据
   * @returns Base64 字符串
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * 停止录音
   */
  public async stopRecording(): Promise<void> {
    // 断开节点连接
    if (this.workletNode) {
      this.workletNode.port.onmessage = null
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    // 停止音频流
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop())
      this.audioStream = null
    }

    // 关闭 AudioContext
    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }
  }

  /**
   * 获取当前连接状态
   */
  public getConnectionState(): {
    isRecording: boolean
    isConnected: boolean
  } {
    return {
      isRecording: this.audioStream !== null && this.audioContext !== null,
      isConnected: this.websocket !== null && this.websocket.readyState === WebSocket.OPEN
    }
  }
}

export { MicrophoneManager }
