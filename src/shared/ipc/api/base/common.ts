/**
 * 通用基础 API 类型（所有窗口共享）
 */

import type { AppConfig } from '@shared/types/appConfig'

/** 所有窗口通用的基础 API 接口 */
export interface CommonApi {
  ipcRenderer: {
    send: (channel: string, data?: unknown) => void
    invoke: <T = unknown>(channel: string, data?: unknown) => Promise<T>
    on: (channel: string, listener: (...args: unknown[]) => void) => () => void
    removeAllListeners: (channel: string) => void
  }
  log: {
    debug: (message: string, args?: unknown) => void
    info: (message: string, args?: unknown) => void
    warn: (message: string, args?: unknown) => void
    error: (message: string, args?: unknown) => void
  }
  config: {
    get: <K extends keyof AppConfig>(key?: K) => Promise<AppConfig[K] | AppConfig>
    set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => Promise<void>
    onChange: (callback: (config: AppConfig) => void) => void
  }
  dispatch: {
    sendTo: (target: string, action: string, payload?: unknown) => void
    invoke: (request: {
      action: string
      payload?: unknown
      target: string
    }) => Promise<{ success: boolean; data?: unknown; error?: string }>
    onAction: (callback: (data: { action: string; payload?: unknown }) => void) => () => void
    onInvoke: (
      callback: (data: {
        action: string
        payload?: unknown
        responseChannel: string
        actionId: string
      }) => void
    ) => () => void
    respond: (
      responseChannel: string,
      result: { success: boolean; data?: unknown; error?: string }
    ) => void
  }
  notify: (data: {
    title: string
    body: string
    icon?: string
    silent?: boolean
    subtitle?: string
    sound?: string
  }) => void
  startDrag: () => void
}
