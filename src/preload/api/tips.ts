/**
 * Tips 窗口 API 构建函数
 *
 * 返回符合 TipsWindowApi 类型的 API 对象，
 * 由 unifiedPreload.ts 统一完成 contextBridge 暴露。
 */

import { ipcRenderer } from 'electron'
import { commonApi } from './builders/common'
import { ipc } from './builders/ipc'
import { CHANNELS } from '@shared/ipc/channels'
import type { TipsWindowApi } from '@shared/ipc/api'

/** 构建 Tips 窗口 API */
export function buildTipsWindowApi(): TipsWindowApi {
  return {
    ...commonApi,
    tipsApi: {
      onShow: (callback: (data?: { message?: string; avatarUrl?: string }) => void) =>
        ipc.on(CHANNELS.TIPS_SHOW_EVENT, callback),
      onHide: (callback: () => void) => {
        const handler = (): void => callback()
        ipcRenderer.on(CHANNELS.TIPS_HIDE_EVENT, handler)
        return () => {
          ipcRenderer.removeListener(CHANNELS.TIPS_HIDE_EVENT, handler)
        }
      },
      onMessage: (callback: (data: { message: string; avatarUrl?: string }) => void) =>
        ipc.on(CHANNELS.TIPS_MESSAGE_EVENT, callback)
    }
  }
}
