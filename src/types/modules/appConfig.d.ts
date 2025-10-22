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
}

export interface ConfigApi {
  config: {
    get: <K extends keyof AppConfig>(key?: K) => Promise<AppConfig[K] | AppConfig>
    set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => Promise<void>
    onChange: (callback: (config: AppConfig) => void) => void
  }
}
