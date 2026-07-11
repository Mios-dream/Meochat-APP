/**
 * 助手设置窗口 API 构建函数
 *
 * 组装各领域子模块，构建符合 AssistantSettingsWindowApi 类型的窗口 API 对象。
 */

import { ipcRenderer } from 'electron'
import { commonApi } from './builders/common'
import { assistantApi } from './builders/assistantApi'
import { CHANNELS } from '@shared/ipc/channels'
import type { AssistantSettingsWindowApi } from '@shared/ipc/api'

/** 构建助手设置窗口 API */
export function buildAssistantSettingsWindowApi(): AssistantSettingsWindowApi {
  return {
    ...commonApi,

    closeAssistantSettings: () => ipcRenderer.send(CHANNELS.ASSISTANT_SETTINGS_CLOSE),
    resizeAssistant: (width: number, height: number) =>
      ipcRenderer.send(CHANNELS.ASSISTANT_RESIZE, { width, height }),

    assistant: assistantApi
  }
}
