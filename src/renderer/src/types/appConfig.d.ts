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
  // 空闲时间阈值，单位毫秒
  idleTime: number
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
}
