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

  onAssistantSwitched: (callback: (data: AssistantInfo | null) => void) => () => void
  onDownloadProgress: (
    callback: (data: { status: string; assistantName?: string; progress?: number }) => void
  ) => () => void

  tipsApi: {
    showTips: (message: string, avatarUrl?: string) => void
    updateTips: (message: string, avatarUrl?: string) => void
    hideTips: () => void
  }

  assistant: AssistantApi
  chat: ChatApi
  system: SystemApi
  ws: ws
}
