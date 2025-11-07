export interface AppConfig {
  // 服务器地址
  baseUrl: string
  // 音量
  volume: number
  //是否开机启动
  autoStartOnBoot: boolean
  // 是否自动更新
  autoUpdate: boolean
  // 是否启动桌面助手的自动语音识别聊天
  autoChat: boolean
  // 是否开启调试模式，打开窗口时会显示控制台
  debugMode: boolean
  // 是否开启静默模式，启动时不会自动打开主窗口
  silentMode: boolean
  // 是否开启空闲事件，空闲时间超过 idleTime 毫秒时会触发事件
  idleEvent: boolean
  // 空闲时间阈值，单位毫秒
  idleTime: number
}

export interface ConfigApi {
  config: {
    get: <K extends keyof AppConfig>(key?: K) => Promise<AppConfig[K] | AppConfig>
    set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => Promise<void>
    onChange: (callback: (config: AppConfig) => void) => void
  }
}
