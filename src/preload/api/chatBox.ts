/**
 * 聊天框窗口 API 构建函数
 *
 * 构建符合 ChatBoxWindowApi 类型的窗口 API 对象。
 */

import { ipcRenderer } from 'electron'
import { commonApi } from './builders/common'
import { chatApi } from './builders/chatApi'
import { CHANNELS } from '@shared/ipc/channels'
import type { ChatBoxWindowApi } from '@shared/ipc/api'
import { assistantApi } from './builders/assistantApi'

/** 构建聊天框窗口 API */
export function buildChatBoxWindowApi(): ChatBoxWindowApi {
  return {
    ...commonApi,
    togglePin: () => ipcRenderer.invoke(CHANNELS.CHATBOX_TOGGLE_PIN),
    getPinStatus: () => ipcRenderer.invoke(CHANNELS.CHATBOX_GET_PIN_STATUS),
    hideChatBox: () => ipcRenderer.send(CHANNELS.CHATBOX_HIDE),
    showChatBox: () => ipcRenderer.send(CHANNELS.CHATBOX_SHOW),
    openChatBox: () => ipcRenderer.send(CHANNELS.CHATBOX_CREATE),
    closeChatBox: () => ipcRenderer.send(CHANNELS.CHATBOX_CLOSE),
    assistant: assistantApi,
    chat: chatApi
  }
}
