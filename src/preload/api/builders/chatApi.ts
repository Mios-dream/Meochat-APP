/**
 * @file chatApi.ts
 * @description 聊天服务 API 构建函数
 *
 * 构建符合 ChatApi 类型定义的 IPC 调用封装，
 * 可被 main / chatBox / assistant 等窗口复用。
 */

import { ipcRenderer } from 'electron'
import { ipc } from './ipc'
import { CHANNELS } from '@shared/ipc/channels'
import type { ChatApi } from '@shared/ipc/api/base/chat'

/** 构建统一的聊天服务 API 对象 */
export const chatApi: ChatApi = {
  // ─── 命令（单向 fire-and-forget） ───
  cancelMessage: (data) => {
    ipcRenderer.send(CHANNELS.CANCEL_MESSAGE, data)
  },
  wakewordDetected: (keyword) => {
    ipcRenderer.send(CHANNELS.WAKEWORD_DETECTED, keyword)
  },
  updateToolStatus: (data) => {
    ipcRenderer.send(CHANNELS.UPDATE_TOOL_STATUS, data)
  },
  sendInvokeResult: (data) => {
    ipcRenderer.send(CHANNELS.CHAT_INVOKE_RESULT, data)
  },

  // ─── 请求-响应（双向 invoke） ───
  invokeChat: (msg) => ipcRenderer.invoke(CHANNELS.CHAT_INVOKE, msg),
  getHistory: () => ipcRenderer.invoke(CHANNELS.GET_HISTORY),
  appendMessage: (message) => ipcRenderer.invoke(CHANNELS.APPEND_MESSAGE, message),
  popHistory: () => ipcRenderer.invoke(CHANNELS.POP_HISTORY),
  replaceHistory: (messages) => ipcRenderer.invoke(CHANNELS.REPLACE_HISTORY, messages),
  clearHistory: () => ipcRenderer.invoke(CHANNELS.CLEAR_HISTORY),

  // ─── 事件监听（main → renderer） ───
  onCancelMessage: (callback) => ipc.on(CHANNELS.CHATBOX_CANCEL_MESSAGE_EVENT, callback),
  onClearHistory: (callback) => ipc.on(CHANNELS.CLEAR_HISTORY, callback),
  onHistoryChanged: (callback) => ipc.on(CHANNELS.CHAT_HISTORY_CHANGED_EVENT, callback),
  onWakewordDetected: (callback) => ipc.on(CHANNELS.CHATBOX_WAKEWORD_DETECTED_EVENT, callback),
  onInvokeRequest: (callback) => ipc.on(CHANNELS.CHAT_INVOKE_REQUEST_EVENT, callback)
}
