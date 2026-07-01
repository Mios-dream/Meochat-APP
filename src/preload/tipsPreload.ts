/**
 * 提示窗口预加载脚本
 * 为提示窗口提供专用 API
 */

import { contextBridge, ipcRenderer } from 'electron'

/** 提示窗口 API */
const tipsApi = {
  // 监听显示提示事件
  onShow: (callback: (data?: { message?: string; avatarUrl?: string }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data?: { message?: string; avatarUrl?: string }
    ): void => callback(data)
    ipcRenderer.on('tips:show', listener)
    return () => ipcRenderer.removeListener('tips:show', listener)
  },

  // 监听隐藏提示事件
  onHide: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('tips:hide', listener)
    return () => ipcRenderer.removeListener('tips:hide', listener)
  },

  // 监听消息更新事件
  onMessage: (callback: (data: { message: string; avatarUrl?: string }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { message: string; avatarUrl?: string }
    ): void => callback(data)
    ipcRenderer.on('tips:message', listener)
    return () => ipcRenderer.removeListener('tips:message', listener)
  },

  // 通知主进程提示窗口已准备好
  ready: () => ipcRenderer.send('tips:ready'),

  // 通知主进程提示窗口动画完成
  animationComplete: () => ipcRenderer.send('tips:animation-complete')
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('tipsApi', tipsApi)

// 也暴露基础 API
const baseApi = {
  // 日志相关
  log: {
    debug: (message: string, args?) =>
      ipcRenderer.send('logger:log', { level: 'debug', message, args }),
    info: (message: string, args?) =>
      ipcRenderer.send('logger:log', { level: 'info', message, args }),
    warn: (message: string, args?) =>
      ipcRenderer.send('logger:log', { level: 'warning', message, args }),
    error: (message: string, args?) =>
      ipcRenderer.send('logger:log', { level: 'error', message, args })
  },

  // IPC 通用
  ipcRenderer: {
    send: (channel: string, data) => ipcRenderer.send(channel, data),
    invoke: (channel: string, data?) => ipcRenderer.invoke(channel, data),
    on: (channel: string, listener) => {
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('api', baseApi)
