/**
 * 助手（桌宠）窗口 API 类型
 */

import type { CommonApi } from '../base/common'
import { ws } from '../base/ws'
import { SystemApi } from '../base/system'
import { AssistantApi } from '../base/assistant'
import { ChatApi } from '../base/chat'
import type { PetInteractionApi } from '../base/pet'
import type { AssistantInfo } from '@shared/types/assistantTypes'

/** 助手窗口暴露的 API 接口 */
export interface AssistantWindowApi extends CommonApi, PetInteractionApi {
  setIgnoreMouse: (ignore: boolean) => void
  openAssistantSettings: () => void
  closeAssistantSettings: () => void
  isAssistantVisible: () => Promise<boolean>
  /** 获取鼠标全局屏幕坐标（DIP），用于穿透自检等不依赖窗口鼠标事件的场景 */
  getCursorScreenPoint: () => Promise<{ x: number; y: number }>

  onAssistantSwitched: (callback: (data: AssistantInfo | null) => void) => () => void
  onDownloadProgress: (
    callback: (data: { status: string; assistantName?: string; progress?: number }) => void
  ) => () => void

  tipsApi: {
    showTips: (message: string, avatarUrl?: string) => void
    updateTips: (message: string, avatarUrl?: string) => void
    hideTips: () => void
  }

  /**
   * 小组件动作控制（LLM 客户端工具 → 遥控小组件窗口）。
   *
   * 助手窗口会接收并执行服务端下发的 tool:call（客户端工具），
   * 必须与主窗口一样具备 widgetAction 能力，否则 get_todos 等
   * 客户端小组件工具在聊天框发起对话时无法执行。
   */
  widgetAction: {
    exec: (
      widgetType: string,
      action: string,
      params: Record<string, unknown>,
      timeoutMs?: number
    ) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
  }

  assistant: AssistantApi
  chat: ChatApi
  system: SystemApi
  ws: ws
}
