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
import type { PetInteractionApi } from '../base/pet'

import type { OnboardingProfile, OnboardingState } from '@shared/types/onboarding'
import type {
  WidgetConfigFile,
  WidgetInstance,
  WidgetGlobalSettings,
  WidgetDataMessage,
  IpcResponse
} from '@shared/types/widget'

/** 主窗口暴露的 API 接口 */
export interface MainWindowApi extends CommonApi, PetInteractionApi {
  minimizeApp: () => void
  maximizeApp: () => void
  hideApp: () => void
  quitApp: () => void
  setAutoStartOnBoot: (status: boolean) => Promise<void>
  openExternal: (url: string) => void

  onboarding: {
    getState: () => Promise<OnboardingState>
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

  /** 小组件管理 API（仅供主窗口管理面板使用） */
  widgetManager: {
    getAllConfigs: () => Promise<IpcResponse<WidgetConfigFile>>
    saveConfig: (config: WidgetConfigFile) => Promise<IpcResponse>
    addInstance: (instance: WidgetInstance) => Promise<IpcResponse>
    updateInstance: (instanceId: string, updates: Partial<WidgetInstance>) => Promise<IpcResponse>
    deleteInstance: (instanceId: string) => Promise<IpcResponse>
    togglePin: (instanceId: string, pinned: boolean) => Promise<IpcResponse>
    createWindow: (instanceId: string) => Promise<IpcResponse>
    closeWindow: (instanceId: string) => Promise<IpcResponse>
    updateGlobalSettings: (settings: Partial<WidgetGlobalSettings>) => Promise<IpcResponse>
    onConfigChanged: (callback: (config: WidgetConfigFile) => void) => () => void
    sendData: (data: WidgetDataMessage) => Promise<IpcResponse>
    broadcastData: (data: Omit<WidgetDataMessage, 'toId'>) => Promise<IpcResponse>
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
