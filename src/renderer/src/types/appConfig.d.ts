import { PythonTask } from '@renderer/types/PythonService'

export interface AppConfig {
  // 服务器地址
  baseUrl: string
  // 音量
  volume: number
  // 是否启用动作生成（启用后使用 /api/chat_v3）
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
  // 是否开启空闲事件，空闲时间超过 idleTime 毫秒时会触发事件
  idleEvent: boolean
  // 是否开启桌宠安静模式，开启后不会自动发起聊天
  quietMode: boolean
  // 是否显示桌宠状态下的台词板
  desktopSpeechBoard: boolean
  // 是否显示助手空间内的台词板
  appSpeechBoard: boolean
  // 空闲时间阈值，单位毫秒
  idleTime: number
  // 鼠标静止多久后认定为离开（单位：分钟）
  mouseIdleMinutes: number
  // 自动事件全局冷却时间（单位：毫秒）
  autoEventCooldownMs: number
  // 同一应用持续使用多久后提醒休息（单位：分钟）
  appReminderMinutes: number
  // 低电量阈值（单位：百分比）
  lowBatteryThreshold: number
  // Live2D 抚摸速度阈值（单位：像素/秒）
  live2dStrokeSpeedThreshold: number
  // 助手是否开启
  assistantEnabled: boolean
  // 当前助手
  currentAssistant: string
  // 主题色
  themeColor: string
  // 聊天快捷键
  chatShortcut: string
  // Python服务配置
  pythonTasks: PythonTask[]

  performanceMode: 'high' | 'balanced' | 'low'

  assistantWindowBounds?: Electron.Rectangle
}
