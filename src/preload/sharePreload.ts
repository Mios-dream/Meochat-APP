import { ipcRenderer } from 'electron'

/**
 * 全局共享 API（所有窗口通用）
 *
 * 包含以下功能模块：
 * - 窗口控制：最小化、最大化、隐藏、退出
 * - 助手窗口：打开、关闭、显示、隐藏
 * - 聊天窗口：打开、关闭、显示、隐藏
 * - 统一调度中心：跨窗口定向消息分发
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

  // ===== 统一调度中心 =====
  dispatch: {
    /**
     * 向指定类型窗口发送单向消息
     * @param target 目标窗口类型（如 'assistant'、'main'、'all'）
     * @param action 动作名称
     * @param payload 附带数据
     */
    sendTo: (target: string, action: string, payload?: unknown) =>
      ipcRenderer.send('dispatch:send-to', { target, action, payload }),

    /**
     * 通过 DispatchCenter 执行一个动作并获取回执
     * @param request 包含 action、payload、target 的请求对象
     * @returns 调度响应结果
     */
    invoke: (request: { action: string; payload?: unknown; target: string }) =>
      new Promise((resolve) => {
        const actionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        ipcRenderer
          .invoke('dispatch:invoke', { ...request, actionId })
          .then((res: any) => {
            resolve(res?.result ?? null)
          })
          .catch((err) => {
            resolve({ success: false, error: String(err) })
          })
      }),

    /**
     * 监听来自 DispatchCenter 分发的动作
     * @param callback 回调函数，接收 { action, payload }
     * @returns 取消监听函数
     */
    onAction: (callback: (data: { action: string; payload?: unknown }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { action: string; payload?: unknown }): void => {
        callback(data)
      }
      ipcRenderer.on('dispatch:action', handler)
      return () => ipcRenderer.removeListener('dispatch:action', handler)
    },

    /**
     * 监听来自 DispatchCenter 的 invoke 请求
     * @param callback 回调函数
     * @returns 取消监听函数
     */
    onInvoke: (callback: (data: {
      action: string
      payload?: unknown
      responseChannel: string
      actionId: string
    }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: {
          action: string
          payload?: unknown
          responseChannel: string
          actionId: string
        }
      ): void => {
        callback(data)
      }
      ipcRenderer.on('dispatch:invoke', handler)
      return () => ipcRenderer.removeListener('dispatch:invoke', handler)
    },

    /**
     * 向 DispatchCenter 回执 invoke 响应
     * @param responseChannel 从 invoke 请求中获取的响应通道名
     * @param result 执行结果
     */
    respond: (responseChannel: string, result: { success: boolean; data?: unknown; error?: string }) =>
      ipcRenderer.send(responseChannel, result)
  },

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
  // ===== WebSocket API（主进程 WS 桥接） =====
  ws: {
    /** 向服务端发送消息 */
    send: (msg) => ipcRenderer.invoke('ws:send', msg),
    /** 请求建立 WS 连接 */
    connect: () => ipcRenderer.invoke('ws:connect'),
    /** 请求断开 WS 连接 */
    disconnect: () => ipcRenderer.invoke('ws:disconnect'),
    /** 查询当前连接状态 */
    getStatus: () => ipcRenderer.invoke('ws:status'),
    /** 监听服务端推送消息 */
    onMessage: (callback) => {
      const listener = (_event, msg): void => callback(msg)
      ipcRenderer.on('ws:message', listener)
      return () => ipcRenderer.removeListener('ws:message', listener)
    },
    /** 监听连接状态变更 */
    onStatusChange: (callback) => {
      const listener = (_event, connected): void => callback(connected)
      ipcRenderer.on('ws:status-change', listener)
      return () => ipcRenderer.removeListener('ws:status-change', listener)
    }
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
