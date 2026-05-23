export interface AppConfig {
  // 服务器地址
  baseUrl: string
  // 音量
  volume: number
  // 是否启用动作生成
  generateMotion: boolean
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
  // 是否开启空闲事件
  idleEvent: boolean
  // 是否开启桌宠安静模式，开启后不会自动发起聊天
  quietMode: boolean
  // 是否显示桌宠状态下的台词板
  desktopSpeechBoard: boolean
  // 是否显示助手空间内的台词板
  appSpeechBoard: boolean
  // 助手是否开启
  assistantEnabled: boolean
  // 当前助手
  currentAssistant: string
  // 主题色
  themeColor: string
  // 聊天快捷键
  chatShortcut: string
  // 桌宠助手窗口位置
  assistantWindowBounds?: Electron.Rectangle
}
