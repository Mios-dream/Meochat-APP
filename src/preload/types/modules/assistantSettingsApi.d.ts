/**
 * 桌宠助手悬浮设置窗口 API 类型声明
 */
import { AssistantInfo } from '@shared/types/assistantTypes'

export interface AssistantSettingsApi {
  /** 打开桌宠助手悬浮设置窗口 */
  openAssistantSettings: () => void
  /** 关闭桌宠助手悬浮设置窗口 */
  closeAssistantSettings: () => void
  /** 触发助手数据初始化加载 */
  loadAssistantData: () => Promise<{ success: boolean; error?: string }>
  /** 获取所有助手列表（从主进程内存直接读取） */
  getAllAssistants: () => Promise<{ success: boolean; data?: AssistantInfo[]; error?: string }>
  /** 获取当前助手信息 */
  getCurrentAssistant: () => Promise<{
    success: boolean
    data?: AssistantInfo | null
    error?: string
  }>
  /** 切换助手 */
  switchAssistant: (name: string) => Promise<{ success: boolean; error?: string }>
}
