export interface AppConfig {
  // 基础Url配置
  baseUrl: string
  // 音量
  volume: number
  // 是否启用助手语音唤醒服务
  autoStartOnBoot: boolean
  // 是否自动更新
  autoUpdate: boolean
  // 是否启用调试模式
  debugMode: boolean
  // 是否启用静默模式
  silentMode: boolean
  // 是否启用空闲事件
  idleEvent: boolean
  // 是否启用静默模式
  quietMode: boolean
  // 是否启用桌面台词板
  desktopSpeechBoard: boolean
  // 是否启用应用内台词板
  appSpeechBoard: boolean
  // 桌宠模式是否开启
  assistantEnabled: boolean
  // 当前助手
  currentAssistant: string
  // 主题色
  themeColor: string
  // 聊天快捷键
  chatShortcut: string
  // 是否处于睡眠模式
  sleepMode: boolean
  // 内核启动模式
  kernelMode: 'local' | 'api'
  // 是否启用助手语音唤醒服务
  autoChat: boolean
  // 主动等级
  initiativeLevel: 'low' | 'medium' | 'high'
}
