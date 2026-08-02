/**
 * 主窗口 API 构建函数
 */

import { ipcRenderer } from 'electron'
import { commonApi } from './builders/common'
import { ipc } from './builders/ipc'
import { assistantApi } from './builders/assistantApi'
import { chatApi } from './builders/chatApi'
import { systemApi } from './builders/systemApi'
import { wsApi } from './builders/wsApi'
import { petApi } from './builders/petApi'
import { CHANNELS } from '@shared/ipc/channels'
import type { MainWindowApi } from '@shared/ipc/api'
import { kernelApi } from './builders/kernelApi'

/** 构建主窗口 API */
export function buildMainWindowApi(): MainWindowApi {
  return {
    ...commonApi,
    ...petApi,
    minimizeApp: () => ipcRenderer.send(CHANNELS.APP_MINIMIZE),
    hideApp: () => ipcRenderer.send(CHANNELS.APP_HIDE),
    quitApp: () => ipcRenderer.send(CHANNELS.APP_QUIT),
    maximizeApp: () => ipcRenderer.send(CHANNELS.APP_MAXIMIZE),
    setAutoStartOnBoot: (enable: boolean) => ipcRenderer.invoke(CHANNELS.CONFIG_AUTO_START, enable),
    openExternal: (url: string) => ipcRenderer.send(CHANNELS.TOOL_OPEN_EXTERNAL, url),

    chatBox: {
      openChatBox: () => ipcRenderer.send(CHANNELS.CHATBOX_CREATE),
      closeChatBox: () => ipcRenderer.send(CHANNELS.CHATBOX_CLOSE),
      hideChatBox: () => ipcRenderer.send(CHANNELS.CHATBOX_HIDE),
      showChatBox: () => ipcRenderer.send(CHANNELS.CHATBOX_SHOW)
    },

    appUpdate: {
      getCurrentVersion: () => ipcRenderer.invoke(CHANNELS.UPDATER_GET_CURRENT_VERSION),
      checkForUpdate: () => ipcRenderer.invoke(CHANNELS.UPDATER_CHECK_FOR_UPDATE),
      confirmUpdate: () => ipcRenderer.invoke(CHANNELS.UPDATER_CONFIRM_UPDATE),
      onStatus: (callback: (msg: string) => void) =>
        ipc.on(CHANNELS.UPDATER_UPDATE_STATUS_EVENT, callback),
      onProgress: (callback: (percent: number) => void) =>
        ipc.on(CHANNELS.UPDATER_UPDATE_PROGRESS_EVENT, callback),
      checkCloudVersion: () => ipcRenderer.invoke(CHANNELS.UPDATER_CHECK_CLOUD_VERSION)
    },

    onboarding: {
      getState: () => ipcRenderer.invoke(CHANNELS.ONBOARDING_GET_STATE),
      saveProfile: (profile: unknown) =>
        ipcRenderer.invoke(CHANNELS.ONBOARDING_SAVE_PROFILE, profile),
      markCompleted: () => ipcRenderer.invoke(CHANNELS.ONBOARDING_MARK_COMPLETED),
      reset: () => ipcRenderer.invoke(CHANNELS.ONBOARDING_RESET)
    },

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

    widgetManager: {
      getAllConfigs: () => ipcRenderer.invoke(CHANNELS.WIDGET_CONFIG_GET_ALL),
      saveConfig: (config) => ipcRenderer.invoke(CHANNELS.WIDGET_CONFIG_SAVE, config),
      addInstance: (instance) => ipcRenderer.invoke(CHANNELS.WIDGET_INSTANCE_ADD, instance),
      updateInstance: (instanceId, updates) =>
        ipcRenderer.invoke(CHANNELS.WIDGET_INSTANCE_UPDATE, { instanceId, updates }),
      deleteInstance: (instanceId) =>
        ipcRenderer.invoke(CHANNELS.WIDGET_INSTANCE_DELETE, instanceId),
      togglePin: (instanceId, pinned) =>
        ipcRenderer.invoke(CHANNELS.WIDGET_WINDOW_TOGGLE_PIN, { instanceId, pinned }),
      createWindow: (instanceId) => ipcRenderer.invoke(CHANNELS.WIDGET_WINDOW_CREATE, instanceId),
      closeWindow: (instanceId) => ipcRenderer.invoke(CHANNELS.WIDGET_WINDOW_CLOSE, instanceId),
      updateGlobalSettings: (settings) =>
        ipcRenderer.invoke(CHANNELS.WIDGET_SETTINGS_UPDATE, settings),
      onConfigChanged: (callback) => ipc.on(CHANNELS.WIDGET_CONFIG_CHANGED_EVENT, callback),
      sendData: (data) => ipcRenderer.invoke(CHANNELS.WIDGET_DATA_SEND, data),
      broadcastData: (data) => ipcRenderer.invoke(CHANNELS.WIDGET_DATA_BROADCAST, data)
    },
    kernel: kernelApi,
    assistant: assistantApi,
    chat: chatApi,
    system: systemApi,
    ws: wsApi
  }
}
