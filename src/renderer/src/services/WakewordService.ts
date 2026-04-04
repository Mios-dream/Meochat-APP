interface WakewordReadyMessage {
  type: 'ready'
  message: string
}

interface WakewordDetectedMessage {
  type: 'wakeword_detected'
  keyword: string
  timestamp_ms: number
}

interface WakewordErrorMessage {
  type: 'error'
  message: string
}

type WakewordServerMessage = WakewordReadyMessage | WakewordDetectedMessage | WakewordErrorMessage

interface WakewordCallbacks {
  onReady?: (message: WakewordReadyMessage) => void
  onDetected?: (message: WakewordDetectedMessage) => void
  onError?: (message: string) => void
}

function buildWakewordWsUrl(baseUrl: string): string {
  const normalized = baseUrl
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^wss?:\/\//, '')
  return `ws://${normalized}/api/wakeword/ws`
}

class WakewordService {
  private static instance: WakewordService | null = null

  private readonly targetSampleRate = 16000

  private audioStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private websocket: WebSocket | null = null

  private reconnectInterval = 10000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private manuallyStopped = false
  private wsUrl = ''
  private isStarting = false
  private callbacks: WakewordCallbacks = {}

  private constructor() {
    // Use getInstance() to access the shared service.
  }

  public static getInstance(): WakewordService {
    if (!WakewordService.instance) {
      WakewordService.instance = new WakewordService()
    }
    return WakewordService.instance
  }

  public setCallbacks(callbacks: WakewordCallbacks): void {
    this.callbacks = callbacks
  }

  public async restart(): Promise<void> {
    await this.stop()
    await this.start(this.wsUrl)
  }

  public async start(wsUrl: string): Promise<void> {
    if (this.isStarting) {
      return
    }

    const nextUrl = buildWakewordWsUrl(wsUrl).trim()

    if (
      this.wsUrl === nextUrl &&
      this.websocket &&
      (this.websocket.readyState === WebSocket.OPEN ||
        this.websocket.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    try {
      this.isStarting = true

      if (this.websocket) {
        try {
          this.websocket.close()
        } catch {
          // Ignore close errors during reconnect.
        }
        this.websocket = null
      }

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }

      this.wsUrl = nextUrl
      this.manuallyStopped = false

      await this.startCaptureIfNeeded()
      this.connectWebSocket()
    } finally {
      this.isStarting = false
    }
  }

  public async stop(): Promise<void> {
    this.manuallyStopped = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.websocket) {
      try {
        this.websocket.close()
      } catch {
        // Ignore close errors during shutdown.
      }
      this.websocket = null
    }

    await this.stopCapture()
  }

  private async startCaptureIfNeeded(): Promise<void> {
    if (this.audioContext && this.audioStream && this.source && this.workletNode) {
      return
    }

    this.audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: this.targetSampleRate
      }
    })

    this.audioContext = new AudioContext({
      sampleRate: this.targetSampleRate
    })

    await this.initAudioWorklet(this.audioContext)

    this.source = this.audioContext.createMediaStreamSource(this.audioStream)
    this.workletNode = new AudioWorkletNode(this.audioContext, 'wakeword-audio-capture-processor')

    this.workletNode.port.onmessage = (event) => {
      const audioData = event.data.audioData as Float32Array
      if (!this.audioContext) {
        return
      }

      const normalizedData =
        this.audioContext.sampleRate === this.targetSampleRate
          ? audioData
          : this.resampleTo16kHz(audioData, this.audioContext.sampleRate)

      this.sendPcmBinary(normalizedData)
    }

    this.source.connect(this.workletNode)
    this.workletNode.connect(this.audioContext.destination)
  }

  private async stopCapture(): Promise<void> {
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
      this.audioStream.getTracks().forEach((track) => track.stop())
      this.audioStream = null
    }

    if (this.audioContext) {
      const context = this.audioContext
      this.audioContext = null
      if (context.state !== 'closed') {
        try {
          await context.close()
        } catch {
          // Ignore close errors when context is already being torn down.
        }
      }
    }
  }

  private async initAudioWorklet(context: AudioContext): Promise<void> {
    const processorCode = `
      class WakewordAudioCaptureProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0]
          if (input && input[0]) {
            this.port.postMessage({ audioData: input[0] })
          }
          return true
        }
      }

      registerProcessor('wakeword-audio-capture-processor', WakewordAudioCaptureProcessor)
    `

    const blob = new Blob([processorCode], { type: 'application/javascript' })
    const processorUrl = URL.createObjectURL(blob)

    try {
      await context.audioWorklet.addModule(processorUrl)
    } finally {
      URL.revokeObjectURL(processorUrl)
    }
  }

  private connectWebSocket(): void {
    if (!this.wsUrl) {
      return
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.websocket = new WebSocket(this.wsUrl)
    this.websocket.binaryType = 'arraybuffer'

    this.websocket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return
      }

      try {
        const payload = JSON.parse(event.data) as WakewordServerMessage
        if (payload.type === 'ready') {
          this.callbacks.onReady?.(payload)
          return
        }

        if (payload.type === 'wakeword_detected') {
          this.callbacks.onDetected?.(payload)
          return
        }

        if (payload.type === 'error') {
          this.callbacks.onError?.(payload.message)
        }
      } catch (error) {
        this.callbacks.onError?.(`解析唤醒服务消息失败: ${(error as Error).message}`)
      }
    }

    this.websocket.onerror = () => {
      this.callbacks.onError?.('唤醒词 WebSocket 连接异常')
    }

    this.websocket.onclose = () => {
      this.websocket = null

      if (!this.manuallyStopped) {
        this.reconnectTimer = setTimeout(() => {
          this.connectWebSocket()
        }, this.reconnectInterval)
      }
    }
  }

  private sendPcmBinary(audioData: Float32Array): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return
    }

    const pcmBuffer = this.floatTo16BitPCM(audioData)
    this.websocket.send(pcmBuffer)
  }

  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]))
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }
    return output.buffer
  }

  private resampleTo16kHz(audioData: Float32Array, sourceSampleRate: number): Float32Array {
    if (sourceSampleRate === this.targetSampleRate) {
      return audioData
    }

    const sampleRateRatio = sourceSampleRate / this.targetSampleRate
    const newLength = Math.round(audioData.length / sampleRateRatio)
    const result = new Float32Array(newLength)

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
}

export { WakewordService }
