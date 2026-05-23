import { MotionPriority, type Live2DModel } from 'untitled-pixi-live2d-engine'
import { setModelParameterValue } from '../tools/parameterAccess'

/**
 * 负责语音播放、音量同步和基于音频频谱的口型驱动。
 */
export class Live2DSpeechController {
  private volume = 1.0
  private activeGainNode: GainNode | null = null
  private speaking = false
  private mouthOpenY = 0

  /**
   * 设置音量，并同步到正在播放的增益节点。
   * @param volume 目标音量，取值范围会被限制在 0 到 1。
   * @param audioContext 当前音频上下文，用于在播放中同步增益值。
   */
  setVolume(volume: number, audioContext: AudioContext | null): void {
    this.volume = Math.max(0, Math.min(1, volume))

    if (this.activeGainNode && audioContext) {
      this.activeGainNode.gain.setValueAtTime(this.volume, audioContext.currentTime)
    }
  }

  /**
   * 获取当前音量。
   * @returns 当前归一化音量，范围为 0 到 1。
   */
  getVolume(): number {
    return this.volume
  }

  /**
   * 当前是否正在播放语音。
   * @returns 是否处于语音播放状态。
   */
  isSpeaking(): boolean {
    return this.speaking
  }

  /**
   * 获取当前口型开合度。
   * @returns 当前 ParamMouthOpenY 目标值，范围通常为 0 到 1。
   */
  getMouthOpenY(): number {
    return this.mouthOpenY
  }

  /**
   * 停止语音和口型状态。
   * @param model 当前 Live2D 模型；存在时会调用模型自身的 stopSpeaking。
   */
  stopSpeaking(model: Live2DModel | null): void {
    this.speaking = false
    this.mouthOpenY = 0
    model?.stopSpeaking()
  }

  /**
   * 重置语音状态，通常在模型销毁或切换时调用。
   */
  reset(): void {
    this.speaking = false
    this.mouthOpenY = 0
    this.activeGainNode = null
  }

  /**
   * 播放音频并同步驱动口型参数。
   * @param audioData 音频二进制数据。
   * @param model 当前 Live2D 模型，用于播放 Speak 动作。
   * @param audioContext 当前音频上下文，用于解码和播放音频。
   * @param coreModel Live2D/Cubism 核心模型对象，用于写入口型参数。
   * @param disabled 当前模型是否禁用；禁用时直接跳过播放。
   * @param volume 本次播放音量，不传时使用控制器当前音量。
   * @returns 音频播放结束后 resolve 的 Promise。
   */
  async speak(
    audioData: ArrayBuffer,
    model: Live2DModel | null,
    audioContext: AudioContext | null,
    coreModel: unknown,
    disabled: boolean,
    volume: number = this.volume
  ): Promise<void> {
    if (disabled) return

    return new Promise((resolve, reject) => {
      try {
        if (!model || !audioContext) {
          resolve()
          return
        }

        this.speaking = true
        this.mouthOpenY = 0
        model.motion('Speak', 0, MotionPriority.NORMAL)

        audioContext
          .decodeAudioData(audioData)
          .then((audioBuffer) => {
            const source = audioContext.createBufferSource()
            const analyser = audioContext.createAnalyser()
            const gainNode = audioContext.createGain()

            gainNode.gain.value = Math.max(0, Math.min(1, volume))
            this.activeGainNode = gainNode

            source.buffer = audioBuffer
            source.connect(gainNode)
            gainNode.connect(analyser)
            analyser.connect(audioContext.destination)

            let requestId: number | null = null

            source.onended = () => {
              if (requestId !== null) {
                cancelAnimationFrame(requestId)
              }

              this.mouthOpenY = 0
              setModelParameterValue(coreModel, 'ParamMouthOpenY', 0)
              this.speaking = false
              this.activeGainNode = null
              resolve()
            }

            source.start(0)

            const updateMouth = (): void => {
              const dataArray = new Uint8Array(analyser.frequencyBinCount)
              analyser.getByteFrequencyData(dataArray)
              const volume = dataArray.reduce((a, b) => a + b) / dataArray.length
              const mouthOpenCoefficient = 1.2
              this.mouthOpenY = Math.min(1, (volume / 40) * mouthOpenCoefficient)

              requestId = requestAnimationFrame(updateMouth)
            }

            requestId = requestAnimationFrame(updateMouth)
          })
          .catch((error) => {
            this.reset()
            reject(error)
          })
      } catch (error) {
        this.reset()
        reject(error)
      }
    })
  }
}
