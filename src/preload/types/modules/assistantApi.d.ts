import { AssistantInfo, AssistantAssets } from '@shared/types/assistantTypes'

export interface AssistantApi {
  getForegroundAppUsage: () => Promise<{
    processName: string
    windowTitle: string
    pid: number
    category: 'work' | 'social' | 'browser' | 'game' | 'media' | 'other'
    continuousMs: number
    sampledAt: number
  } | null>
  // 助手窗口
  openAssistant: () => void
  closeAssistant: () => void
  hideAssistant: () => void
  showAssistant: () => void
  startDrag: () => void
  setIgnoreMouse: (ignore: boolean) => void
  //获取助手开关状态
  getAssistantStatus: () => Promise<boolean>

  // 新增API
  getCurrentAssistant: () => Promise<{
    success: boolean
    data?: AssistantInfo | null
    error?: string
  }>
  getAssistantAssets: (
    assistantName: string
  ) => Promise<{ success: boolean; data?: AssistantAssets | null; error?: string }>
  /** 获取所有助手列表（从主进程内存直接读取） */
  getAllAssistants: () => Promise<{
    success: boolean
    data?: AssistantInfo[]
    error?: string
  }>
  onAssistantSwitched: (
    callback: (data: AssistantInfo | null) => void
  ) => () => Electron.IpcRenderer

  // Tips窗口相关API
  showTips: (message: string, avatarUrl?: string) => void
  updateTips: (message: string, avatarUrl?: string) => void
  hideTips: () => void
  isAssistantVisible: () => Promise<boolean>
}
