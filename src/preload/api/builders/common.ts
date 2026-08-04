/**
 * 各窗口通用的 API 构建函数
 */

import { ipcRenderer } from 'electron'
import { ipc } from './ipc'
import { CHANNELS } from '@shared/ipc/channels'
import type { AppConfig } from '@shared/types/appConfig'
import { CommonApi } from '@shared/ipc/api/base/common'

/** 基础 API（所有窗口通用） */
export const commonApi: CommonApi = {
  readFileBase64: (filePath: string) =>
    ipcRenderer.invoke(CHANNELS.TOOL_READ_FILE_BASE64, filePath),
  log: {
    debug: (message: string, ...args: unknown[]) =>
      ipcRenderer.send(CHANNELS.LOGGER_LOG, { level: 'debug', message, args }),
    info: (message: string, ...args: unknown[]) =>
      ipcRenderer.send(CHANNELS.LOGGER_LOG, { level: 'info', message, args }),
    warn: (message: string, ...args: unknown[]) =>
      ipcRenderer.send(CHANNELS.LOGGER_LOG, { level: 'warning', message, args }),
    error: (message: string, ...args: unknown[]) =>
      ipcRenderer.send(CHANNELS.LOGGER_LOG, { level: 'error', message, args })
  },
  config: {
    get: (key?: string) => ipcRenderer.invoke(CHANNELS.CONFIG_GET, key),
    set: (key: string, value: unknown) => ipcRenderer.invoke(CHANNELS.CONFIG_SET, key, value),
    onChange: (callback: (config: AppConfig) => void) =>
      ipc.on(CHANNELS.CONFIG_CHANGED_EVENT, callback)
  },

  dispatch: {
    sendTo: (target: string, action: string, payload?: unknown) =>
      ipcRenderer.send(CHANNELS.DISPATCH_SEND_TO, { target, action, payload }),
    invoke: (request: { action: string; payload?: unknown; target: string }) =>
      ipcRenderer
        .invoke(CHANNELS.DISPATCH_INVOKE, {
          ...request,
          actionId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        })
        .then((res: unknown): { success: boolean; data?: unknown; error?: string } => {
          const result = (res as { result?: { success: boolean; data?: unknown; error?: string } })
            ?.result
          return result ?? { success: false, data: undefined, error: undefined }
        }),
    onAction: (callback: (data: { action: string; payload?: unknown }) => void) =>
      ipc.on(CHANNELS.DISPATCH_ACTION_EVENT, callback),
    onInvoke: (
      callback: (data: {
        action: string
        payload?: unknown
        responseChannel: string
        actionId: string
      }) => void
    ) => ipc.on(CHANNELS.DISPATCH_INVOKE_EVENT, callback),
    respond: (
      responseChannel: string,
      result: { success: boolean; data?: unknown; error?: string }
    ) => ipcRenderer.send(responseChannel, result)
  },
  notify: (data: {
    title: string
    body: string
    icon?: string
    silent?: boolean
    subtitle?: string
    sound?: string
  }) => ipcRenderer.send(CHANNELS.TOOL_NOTIFY, data),

  startDrag: () => ipcRenderer.send(CHANNELS.ASSISTANT_START_DRAG),
  endDrag: () => ipcRenderer.send(CHANNELS.ASSISTANT_DRAG_END)
}
