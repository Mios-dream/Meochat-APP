/**
 * 主窗口 API 类型
 */

import type { CommonApi } from '../base/common'
import type { ws } from '../base/ws'
import type { AppUpdate } from '../base/appUpdate'
import type { KernelApi } from '../base/kernel'
import type { AssistantApi } from '../base/assistant'
import type { ChatApi } from '../base/chat'
import type { SystemApi } from '../base/system'

import type { OnboardingMode, OnboardingProfile, OnboardingState } from '@shared/types/onboarding'

/** 主窗口暴露的 API 接口 */
export interface MainWindowApi extends CommonApi {
  minimizeApp: () => void
  maximizeApp: () => void
  hideApp: () => void
  quitApp: () => void
  setAutoStartOnBoot: (status: boolean) => Promise<void>
  openExternal: (url: string) => void

  onboarding: {
    getState: () => Promise<OnboardingState>
    setMode: (mode: OnboardingMode) => Promise<OnboardingState>
    saveProfile: (profile: OnboardingProfile) => Promise<OnboardingState>
    markCompleted: () => Promise<OnboardingState>
    reset: () => Promise<OnboardingState>
  }

  widgetAction: {
    exec: (
      widgetType: string,
      action: string,
      params: Record<string, unknown>,
      timeoutMs?: number
    ) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>
  }
  chatBox: {
    openChatBox: () => void
    closeChatBox: () => void
    hideChatBox: () => void
    showChatBox: () => void
  }

  ws: ws
  appUpdate: AppUpdate
  kernel: KernelApi
  assistant: AssistantApi
  chat: ChatApi
  system: SystemApi
}
