/**
 * 桌宠助手悬浮设置窗口 —— preload 脚本
 *
 * 基于 sharePreload 扩展，额外提供：
 * - dispatch 通道（统一调度中心）
 * - 设置窗口关闭控制
 * - 助手数据加载
 */
import { contextBridge, ipcRenderer } from 'electron'
import globalAPI from './sharePreload'

contextBridge.exposeInMainWorld('api', {
  ...globalAPI,

  // ===== 统一调度中心 API =====
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
     * 通过 DispatchCenter 执行一个动作，可获取回执
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
     * @param callback 回调函数，接收 { action, payload } 格式的消息
     * @returns 取消监听函数
     */
    onAction: (callback: (data: { action: string; payload?: unknown }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { action: string; payload?: unknown }
      ): void => {
        callback(data)
      }
      ipcRenderer.on('dispatch:action', handler)
      return () => ipcRenderer.removeListener('dispatch:action', handler)
    },

    /**
     * 监听来自 DispatchCenter 的 invoke 请求
     * @param callback 回调函数，接收 { action, payload, responseChannel, actionId }
     * @returns 取消监听函数
     */
    onInvoke: (
      callback: (data: {
        action: string
        payload?: unknown
        responseChannel: string
        actionId: string
      }) => void
    ) => {
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
     * 向 DispatchCenter 回执响应
     * @param responseChannel 从 invoke 请求中获取的响应通道名
     * @param result 执行结果
     */
    respond: (
      responseChannel: string,
      result: { success: boolean; data?: unknown; error?: string }
    ) => ipcRenderer.send(responseChannel, result)
  },

  // ===== 设置窗口控制 =====
  /** 关闭设置窗口 */
  closeAssistantSettings: () => ipcRenderer.send('assistantSettings:close'),

  // ===== 助手窗口操作 =====
  /** 调整桌宠助手窗口尺寸 */
  resizeAssistant: (width: number, height: number) =>
    ipcRenderer.send('assistant:resize', { width, height }),

  // ===== 助手数据 =====
  /** 加载助手列表数据（触发初始同步） */
  loadAssistantData: () => ipcRenderer.invoke('assistant:load-data'),

  /** 获取所有助手列表（直接从内存返回，不触发同步） */
  getAllAssistants: () => ipcRenderer.invoke('assistant:get-all'),

  /** 获取当前助手信息 */
  getCurrentAssistant: () => ipcRenderer.invoke('assistant:get-current'),

  /** 切换助手 */
  switchAssistant: (name: string) => ipcRenderer.invoke('assistant:switch', name)
})
