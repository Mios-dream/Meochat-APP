/**
 * 聊天框窗口预加载脚本
 * 为聊天框独立窗口提供专用 API
 */

import { contextBridge, ipcRenderer } from 'electron'
import globalAPI from './sharePreload'

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,

  // 隐藏聊天框窗口
  hideChatBox: () => ipcRenderer.send('chat-box:hide'),

  // 显示聊天框窗口
  showChatBox: () => ipcRenderer.send('chat-box:show'),

  // 聊天框窗口拖拽
  startDrag: () => ipcRenderer.send('chat-box:start-drag'),

  // 发送消息
  sendMessage: (message: string) => ipcRenderer.invoke('chat-box:send-message', message),

  // 获取聊天历史
  getChatHistory: () => ipcRenderer.invoke('chat-box:get-history'),

  // 清空聊天历史
  clearChatHistory: () => ipcRenderer.invoke('chat-box:clear-history')
})
