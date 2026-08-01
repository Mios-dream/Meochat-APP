/**
 * 统一音频采集管线
 *
 * 创建一条 getUserMedia → AudioWorklet → WebSocket 的音频采集链路。
 * 采集到的 Float32Array 转为 base64 Int16 发送至后端 /api/voice/ws。
 *
 * 后端完成 VAD + ASR + 过滤后返回 asr_result，前端直接回复。
 * 后端 VAD 事件（speech_start / speech_end）用于 barge-in 打断。
 */
import { ChatManager } from '@renderer/chat/ChatManager'

export class VoicePipelineService {
  private static instance: VoicePipelineService | null = null
  // 音频采集相关
  private audioStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  // 采样率，后端要求 16kHz
  private readonly TARGET_SAMPLE_RATE = 16000
  // 采集状态
  private _isCapturing = false
  private _isSessionActive = false

  // Voice WebSocket
  private voiceWS: WebSocket | null = null
  private voiceReconnectTimer: ReturnType<typeof setTimeout> | null = null
  private voiceUrl = ''
  private manuallyStopped = false
  // 一次性语音转写（conversation 模式）, 用于处理对话模式的 ASR 结果
  private _transcribeResolve: ((text: string) => void) | null = null
  // 语音转写超时
  private _transcribeTimeout: ReturnType<typeof setTimeout> | null = null
  // VAD 分段的合并缓存
  private _transcribeBuffer: string[] = []
  // VAD 分段的防抖定时器
  private _transcribeFlushTimer: ReturnType<typeof setTimeout> | null = null

  static getInstance(): VoicePipelineService {
    if (!VoicePipelineService.instance) {
      VoicePipelineService.instance = new VoicePipelineService()
    }
    return VoicePipelineService.instance
  }

  get isCapturing(): boolean {
    return this._isCapturing
  }
  get isSessionActive(): boolean {
    return this._isSessionActive
  }

  /** 启动麦克风采集 */
  async startCapture(): Promise<void> {
    if (this._isCapturing) return
    try {
      this.manuallyStopped = false
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: this.TARGET_SAMPLE_RATE
        }
      })
      this.audioContext = new AudioContext({ sampleRate: this.TARGET_SAMPLE_RATE })
      await this.initAudioWorklet(this.audioContext)
      this.source = this.audioContext.createMediaStreamSource(this.audioStream)
      this.workletNode = new AudioWorkletNode(this.audioContext, 'voice-pipeline-processor')
      this.workletNode.port.onmessage = (event) => {
        const f32 = event.data.audioData as Float32Array
        this.dispatchAudioFrame(f32)
      }
      this.source.connect(this.workletNode)
      this.workletNode.connect(this.audioContext.destination)
      this._isCapturing = true
    } catch (error) {
      console.error('[VoicePipeline] 启动麦克风采集失败:', error)
      throw error
    }
  }

  /** 停止麦克风采集 */
  async stopCapture(): Promise<void> {
    this.manuallyStopped = true
    this._isCapturing = false
    this._isSessionActive = false
    if (this.workletNode) {
      this.workletNode.port.onmessage = null
      this.workletNode.disconnect()
      this.workletNode = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((t) => t.stop())
      this.audioStream = null
    }
    if (this.audioContext) {
      const ctx = this.audioContext
      this.audioContext = null
      if (ctx.state !== 'closed') {
        try {
          await ctx.close()
        } catch {
          /* ignore */
        }
      }
    }
    this.disconnectAll()
  }

  /** 连接语音 WebSocket */
  connectVoiceWS(baseUrl: string): void {
    const url = this.buildWSURL(baseUrl, '/api/voice/ws')
    if (!url) return
    this.voiceUrl = url
    if (
      this.voiceWS?.url === url &&
      (this.voiceWS.readyState === WebSocket.OPEN ||
        this.voiceWS.readyState === WebSocket.CONNECTING)
    )
      return
    this.closeVoiceWS()
    this.connectVoiceWSInternal()
  }

  disconnectAll(): void {
    this.closeVoiceWS()
  }

  /** 开始语音会话（对话模式：VAD + 连续 ASR） */
  startVoiceSession(): void {
    this._isSessionActive = true
    this.sendVoiceControl({ type: 'session_control', action: 'start', mode: 'conversation' })
  }

  /** 结束语音会话 */
  stopVoiceSession(): void {
    this._isSessionActive = false
    this.sendVoiceControl({ type: 'session_control', action: 'end' })
  }

  /** 进行一次语音识别（conversation 模式），返回识别文本 */
  async transcribeOnce(
    baseUrl: string,
    timeoutMs = 10000,
    onSegment?: (text: string) => void
  ): Promise<string> {
    if (this._transcribeResolve) {
      throw new Error('已有进行中的语音识别')
    }

    // 确保麦克风已启动
    if (!this._isCapturing) {
      await this.startCapture()
    }

    // 确保 WS 已连接
    this.connectVoiceWS(baseUrl)

    // 等待 WS 就绪
    await this.waitForOpenWS()

    return new Promise((resolve, reject) => {
      this._transcribeBuffer = []
      this._transcribeResolve = (text: string) => {
        // VAD 可能将一句话拆成多段：实时回调 + 防抖合并
        this._transcribeBuffer.push(text)
        onSegment?.(text)
        if (this._transcribeFlushTimer) clearTimeout(this._transcribeFlushTimer)
        this._transcribeFlushTimer = setTimeout(() => {
          const combined = this._transcribeBuffer.join('')
          this._transcribeBuffer = []
          resolve(combined)
          this._cleanupTranscribe()
        }, 600)
      }

      this._transcribeTimeout = setTimeout(() => {
        this._cleanupTranscribe()
        reject(new Error('语音识别超时'))
      }, timeoutMs)

      this.sendVoiceControl({ type: 'session_control', action: 'start', mode: 'conversation' })
    })
  }

  private waitForOpenWS(timeoutMs = 5000): Promise<void> {
    if (this.voiceWS?.readyState === WebSocket.OPEN) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket 连接超时')), timeoutMs)
      const check = setInterval(() => {
        if (this.voiceWS?.readyState === WebSocket.OPEN) {
          clearInterval(check)
          clearTimeout(timer)
          resolve()
        }
        if (
          this.voiceWS?.readyState === WebSocket.CLOSED ||
          this.voiceWS?.readyState === WebSocket.CLOSING
        ) {
          clearInterval(check)
          clearTimeout(timer)
          reject(new Error('WebSocket 连接失败'))
        }
      }, 100)
    })
  }

  private _cleanupTranscribe(): void {
    this._transcribeResolve = null
    if (this._transcribeTimeout) {
      clearTimeout(this._transcribeTimeout)
      this._transcribeTimeout = null
    }
    if (this._transcribeFlushTimer) {
      clearTimeout(this._transcribeFlushTimer)
      this._transcribeFlushTimer = null
    }
    this._transcribeBuffer = []
    this.sendVoiceControl({ type: 'session_control', action: 'start', mode: 'background' })
  }

  /** 发送音频帧到语音 WebSocket */
  private dispatchAudioFrame(f32: Float32Array): void {
    if (!this._isSessionActive) return
    const int16 = this.float32ToInt16(f32)
    const b64 = this.int16ArrayToBase64(int16)
    if (this.voiceWS?.readyState === WebSocket.OPEN) {
      this.voiceWS.send(
        JSON.stringify({ type: 'audio', data: b64, sample_rate: this.TARGET_SAMPLE_RATE })
      )
    }
  }

  /** 初始化音频工作节点 */
  private async initAudioWorklet(context: AudioContext): Promise<void> {
    const code = `class VoicePipelineProcessor extends AudioWorkletProcessor {
      process(inputs) {
        const input = inputs[0]
        if (input && input[0]) this.port.postMessage({ audioData: input[0] })
        return true
      }
    }
    registerProcessor('voice-pipeline-processor', VoicePipelineProcessor)`
    const blob = new Blob([code], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    try {
      await context.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  private buildWSURL(baseUrl: string, path: string): string {
    const n = baseUrl
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^wss?:\/\//, '')
    return n ? `ws://${n}${path}` : ''
  }

  private connectVoiceWSInternal(): void {
    if (this.voiceReconnectTimer) {
      clearTimeout(this.voiceReconnectTimer)
      this.voiceReconnectTimer = null
    }
    this.voiceWS = new WebSocket(this.voiceUrl)
    this.voiceWS.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'asr_result':
            // 对话模式返回的 asr_result 无 category 字段，背景模式有
            // 转写期间只接受对话模式的 ASR 结果，忽略背景 KWS 的误触发
            if (this._transcribeResolve && msg.text && !msg.category) {
              console.log('[VoicePipeline] 语音转写结果:', msg.text)
              this._transcribeResolve(msg.text)
            } else if (msg.text) {
              console.log('[VoicePipeline] 语音识别结果:', msg)
              ChatManager.getInstance().chat(msg.text)
            }
            break
          case 'error':
            console.error('[VoicePipeline] 语音 WS 错误:', msg.message)
            break
        }
      } catch {
        /* ignore */
      }
    }
    this.voiceWS.onopen = () => {
      this._isSessionActive = true
      this.sendVoiceControl({ type: 'session_control', action: 'start', mode: 'background' })
    }
    this.voiceWS.onclose = () => {
      this._isSessionActive = false
      this.voiceWS = null
      if (!this.manuallyStopped) {
        this.voiceReconnectTimer = setTimeout(() => this.connectVoiceWSInternal(), 30_000)
      }
    }
    this.voiceWS.onerror = () => {
      console.error('[VoicePipeline] 语音 WS 连接异常')
    }
  }

  /** 发送语音控制消息 */
  private sendVoiceControl(msg: object): void {
    if (this.voiceWS?.readyState === WebSocket.OPEN) {
      this.voiceWS.send(JSON.stringify(msg))
    }
  }

  /** 关闭语音 WebSocket 连接 */
  private closeVoiceWS(): void {
    if (this.voiceReconnectTimer) {
      clearTimeout(this.voiceReconnectTimer)
      this.voiceReconnectTimer = null
    }
    if (this.voiceWS) {
      this._isSessionActive = false
      this.sendVoiceControl({ type: 'session_control', action: 'end' })
      try {
        this.voiceWS.close()
      } catch {
        /* ignore */
      }
      this.voiceWS = null
    }
  }

  /** 将 Float32Array 转换为 Int16Array */
  private float32ToInt16(f32: Float32Array): Int16Array {
    const int16 = new Int16Array(f32.length)
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16
  }

  /** 将 Int16Array 转换为 Base64 字符串 */
  private int16ArrayToBase64(int16: Int16Array): string {
    const uint8 = new Uint8Array(int16.buffer)
    let binary = ''
    for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i])
    return btoa(binary)
  }
}
