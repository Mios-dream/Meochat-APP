import { ipcRenderer } from 'electron'

/**
 * 全局共享 API（所有窗口通用）
 *
 * 包含以下功能模块：
 * - 窗口控制：最小化、最大化、隐藏、退出
 * - 助手窗口：打开、关闭、显示、隐藏
 * - 聊天窗口：打开、关闭、显示、隐藏
 * - 事件监听：助手切换、助手数据更新
 * - 日志、配置等通用功能
 */
const globalAPI = {
  // ===== 窗口控制 =====
  minimizeApp: () => ipcRenderer.send('app:minimize'),
  maximizeApp: () => ipcRenderer.send('app:maximize'),
  hideApp: () => ipcRenderer.send('app:hide'),
  quitApp: () => ipcRenderer.send('app:quit'),

  // ===== 通知 =====
  notify: (data) => ipcRenderer.send('tool:notify', data),

  // ===== 助手窗口控制 =====
  openAssistant: () => ipcRenderer.send('assistant:create'),
  closeAssistant: () => ipcRenderer.send('assistant:close'),
  hideAssistant: () => ipcRenderer.send('assistant:hide'),
  showAssistant: () => ipcRenderer.send('assistant:show'),
  getScreenSize: () => ipcRenderer.invoke('assistant:get-screen-size'),
  getForegroundAppUsage: () => ipcRenderer.invoke('assistant:get-foreground-app-usage'),

  // ===== 聊天窗口控制 =====
  hideChatBox: () => ipcRenderer.send('chat-box:hide'),
  showChatBox: () => ipcRenderer.send('chat-box:show'),
  openChatBox: () => ipcRenderer.send('chat-box:create'),
  closeChatBox: () => ipcRenderer.send('chat-box:close'),

  // ===== 外部链接 =====
  openExternal: (url) => ipcRenderer.send('tool:open-external', url),

  // ===== 事件监听 =====

  /** 监听助手切换事件 */
  onAssistantSwitched: (callback) => {
    const listener = (_event, data): void => callback(data)
    ipcRenderer.on('assistant:switched', listener)
    return () => ipcRenderer.removeListener('assistant:switched', listener)
  },

  /** 监听助手数据更新事件 */
  onAssistantUpdate: (callback) => {
    const listener = (_event, data): void => callback(data)
    ipcRenderer.on('assistant:update', listener)
    return () => ipcRenderer.removeListener('assistant:update', listener)
  },

  /** 监听助手列表数据更新事件（后台云端同步完成后触发） */
  onAssistantDataUpdated: (callback) => {
    const listener = (_event, data): void => callback(data)
    ipcRenderer.on('assistant:data-updated', listener)
    return () => ipcRenderer.removeListener('assistant:data-updated', listener)
  },

  // ===== 日志 =====
  log: {
    openLogDir: () => ipcRenderer.send('logger:open-log-dir'),
    debug: (message: string, args) =>
      ipcRenderer.send('logger:log', { level: 'debug', message, args }),
    info: (message: string, args) =>
      ipcRenderer.send('logger:log', { level: 'info', message, args }),
    warn: (message: string, args) =>
      ipcRenderer.send('logger:log', { level: 'warning', message, args }),
    error: (message: string, args) =>
      ipcRenderer.send('logger:log', { level: 'error', message, args })
  },

  // ===== 配置 =====
  config: {
    get: (key) => ipcRenderer.invoke('config:get', key),
    set: (key, value) => ipcRenderer.invoke('config:set', key, value),
    onChange: (callback) => ipcRenderer.on('config:changed', (_, config) => callback(config))
  },

  // ===== 通用 IPC 通道（用于特殊场景） =====
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  }
}

export default globalAPI
