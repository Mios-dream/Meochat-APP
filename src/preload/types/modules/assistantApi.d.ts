import { AssistantInfo } from '../types/assistant'

export interface AssistantApi {
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
  onAssistantSwitched: (
    callback: (data: AssistantInfo | null) => void
  ) => () => Electron.IpcRenderer
}
