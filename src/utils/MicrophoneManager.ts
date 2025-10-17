class MicrophoneManager {
  private audioStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private websocket: WebSocket | null = null
  private onRecognitionResult: ((text: string) => void) | null = null
  private targetSampleRate: number = 16000 // 目标采样率

  // 添加重连相关属性
  private reconnectInterval: number = 3000 // 3秒
  private reconnectTimer: number | null = null
  private isManuallyClosed: boolean = false // 区分手动关闭和意外断开

  /*
   *获取麦克风权限状态
   */
  public async getPermissionStatus() {
    let permissionStatus = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    })

    if (permissionStatus.state === 'granted') {
      return true
    } else {
      return false
    }
  }

  /*
   *开始录音
   */
  public async startRecording() {
    try {
      // 请求麦克风权限
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })

      // 创建 AudioContext，注意：这里会使用系统默认采样率
      this.audioContext = new AudioContext()
      console.log(`AudioContext 采样率: ${this.audioContext.sampleRate}Hz`)

      const source = this.audioContext.createMediaStreamSource(this.audioStream)

      // 创建处理器用于获取音频数据
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      // 连接节点
      source.connect(processor)
      processor.connect(this.audioContext.destination)

      // 处理音频数据
      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        // 重采样到 16kHz
        const resampled = this.resampleTo16kHz(inputData, this.audioContext!.sampleRate)
        this.sendAudioData(resampled)
      }

      return {
        stream: this.audioStream,
        source: source,
        processor: processor,
      }
    } catch (error) {
      console.error('获取麦克风失败:', error)
      throw error
    }
  }

  /**
   * 重采样音频数据
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
  public setRecognitionCallback(callback: (text: string) => void) {
    this.onRecognitionResult = callback
  }

  /**
   * 连接到 WebSocket 服务器
   * @param wsUrl WebSocket 服务器地址
   */
  public connectToServer(wsUrl: string) {
    // 清除之前的重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

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
        console.log(`尝试重连...`)

        this.reconnectTimer = setTimeout(() => {
          this.connectToServer(wsUrl)
        }, this.reconnectInterval)
      }
    }
  }

  /**
   * 断开 WebSocket 连接
   */
  public disconnect() {
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
  private sendAudioData(audioData: Float32Array) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return
    }

    // 转换为 16-bit PCM
    const pcmData = this.floatTo16BitPCM(audioData)

    // 发送数据到服务器
    const message = {
      type: 'asr',
      data: this.arrayBufferToBase64(pcmData),
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
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * 停止录音
   */
  public stopRecording() {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop())
      this.audioStream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    // 使用新的 disconnect 方法替代直接关闭
    this.disconnect()
  }
}

export { MicrophoneManager }
