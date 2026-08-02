/**
 * 通用基础 API 类型（所有窗口共享）
 */

import type { AppConfig } from '@shared/types/appConfig'

/** 读取文件为 Base64 的返回结构 */
export interface ReadFileBase64Result {
  success: boolean
  /** 文件名 */
  name?: string
  /** Base64 编码的文件内容 */
  content?: string
  /** MIME 类型 */
  mimeType?: string
  error?: string
}

/** 所有窗口通用的基础 API 接口 */
export interface CommonApi {
  /** 读取文件并返回 Base64 编码内容 */
  readFileBase64: (filePath: string) => Promise<ReadFileBase64Result>
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
