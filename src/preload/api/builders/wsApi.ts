/**
 * WebSocket API 构建函数
 *
 * 构建符合 ws 类型定义的 IPC 调用封装，
 * 用于与后端 WebSocket 服务器通信。
 */

import { ipcRenderer } from 'electron'
import { ipc } from './ipc'
import { CHANNELS } from '@shared/ipc/channels'
import type { ws } from '@shared/ipc/api/base/ws'

/** 构建统一的 WebSocket API 对象 */
export const wsApi: ws = {
  send: (msg: unknown) => ipcRenderer.invoke(CHANNELS.WS_SEND, msg),
  connect: () => ipcRenderer.invoke(CHANNELS.WS_CONNECT),
  disconnect: () => ipcRenderer.invoke(CHANNELS.WS_DISCONNECT),
  getStatus: () => ipcRenderer.invoke(CHANNELS.WS_STATUS),
  onMessage: (callback: (msg: unknown) => void) => ipc.on(CHANNELS.WS_MESSAGE_EVENT, callback),
  onStatusChange: (callback: (connected: boolean) => void) =>
    ipc.on(CHANNELS.WS_STATUS_CHANGE_EVENT, callback)
}
