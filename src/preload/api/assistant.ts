/**
 * 助手窗口 API 构建函数
 *
 * 组装各领域子模块，构建符合 AssistantWindowApi 类型的窗口 API 对象。
 */

import { ipcRenderer } from 'electron'
import { commonApi } from './builders/common'
import { chatApi } from './builders/chatApi'
import { ipc } from './builders/ipc'
import { assistantApi } from './builders/assistantApi'
import { systemApi } from './builders/systemApi'
import { wsApi } from './builders/wsApi'
import { petApi } from './builders/petApi'
import { CHANNELS } from '@shared/ipc/channels'
import type { AssistantWindowApi } from '@shared/ipc/api'
import type { AssistantInfo } from '@shared/types/assistantTypes'

/** 构建助手窗口 API */
export function buildAssistantWindowApi(): AssistantWindowApi {
  return {
    ...commonApi,
    ...petApi,
    setIgnoreMouse: (ignore: boolean) =>
      ipcRenderer.send(CHANNELS.ASSISTANT_SET_IGNORE_MOUSE, ignore),
    openAssistantSettings: () => ipcRenderer.send(CHANNELS.ASSISTANT_SETTINGS_OPEN),
    closeAssistantSettings: () => ipcRenderer.send(CHANNELS.ASSISTANT_SETTINGS_CLOSE),
    isAssistantVisible: () => ipcRenderer.invoke(CHANNELS.ASSISTANT_CHECK_VISIBLE),
    getCursorScreenPoint: () => ipcRenderer.invoke(CHANNELS.ASSISTANT_GET_CURSOR_SCREEN_POINT),

    onAssistantSwitched: (callback: (data: AssistantInfo | null) => void) =>
      ipc.on(CHANNELS.ASSISTANT_SWITCHED_EVENT, callback),
    onDownloadProgress: (
      callback: (data: { status: string; assistantName?: string; progress?: number }) => void
    ) => ipc.on(CHANNELS.ASSISTANT_DOWNLOAD_PROGRESS_EVENT, callback),

    tipsApi: {
      showTips: (message: string, avatarUrl?: string) =>
        ipcRenderer.send(CHANNELS.TIPS_SHOW, { message, avatarUrl }),
      updateTips: (message: string, avatarUrl?: string) =>
        ipcRenderer.send(CHANNELS.TIPS_UPDATE, { message, avatarUrl }),
      hideTips: () => ipcRenderer.send(CHANNELS.TIPS_HIDE)
    },

    // 小组件动作控制：与主窗口一致，用于执行服务端下发的客户端小组件工具（如 get_todos）
    widgetAction: {
      exec: (
        widgetType: string,
        action: string,
        params: Record<string, unknown>,
        timeoutMs?: number
      ) =>
        ipcRenderer.invoke(CHANNELS.WIDGET_ACTION_EXEC, {
          widget_type: widgetType,
          action,
          params,
          timeout_ms: timeoutMs
        })
    },

    assistant: assistantApi,
    chat: chatApi,
    system: systemApi,
    ws: wsApi
  }
}
