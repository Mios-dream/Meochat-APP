/**
 * 子窗口 widgetApi 垫片（无 preload 环境的 API 桥）
 *
 * 背景：
 * 小组件子窗口由宿主 window.open 同源打开、与宿主共享渲染进程，
 * Electron 对复用进程的子窗口不执行 preload，因此子窗口没有 contextBridge 暴露的 window.api。
 *
 * 本模块为子窗口提供与宿主 preload widgetApi「同形状」的 API 实现：
 * 所有方法通过 window.opener.postMessage 发送到宿主网关（src/preload/api/widget.ts），
 * 由宿主代为执行 IPC 并回传结果，业务组件（WidgetView / 内置小组件）无需任何改动。
 *
 * 通信模型（协议定义见 @shared/types/widgetBridge）：
 * - 请求 / 响应：requestId 关联 Promise，带超时防悬挂；
 * - 事件推送：宿主按 instanceId / widgetId 定向转发，本地按事件名分发回调；
 * - 就绪握手：加载完成后上报 ready，宿主回推一次当前实例数据。
 *
 * 安全校验：只处理 event.source === window.opener 的消息，拒绝第三方同源页面注入。
 */

import type {
  WidgetDataMessage,
  WidgetConfigFile,
  InstanceDataUpdate,
  WidgetActionRequest,
  WidgetActionResult
} from '@shared/types/widget'
import {
  WIDGET_BRIDGE_PROTOCOL,
  WIDGET_BRIDGE_VERSION,
  isWidgetBridgeResponseOrEvent
} from '@shared/types/widgetBridge'
import type { WidgetBridgeEvent, WidgetBridgeEventName } from '@shared/types/widgetBridge'
import type { WidgetWindowApi } from '@shared/ipc/api'

/** 单个请求的超时时间（ms），超时后拒绝 Promise 并清理 pending 条目，防止悬挂 */
const REQUEST_TIMEOUT_MS = 15000

/** 事件回调类型：宿主推送的事件载荷 */
type EventCallback<T = unknown> = (payload: T) => void

/**
 * 创建子窗口 widgetApi 的代理。
 *
 * @param instanceId 子窗口所属小组件实例 ID（来自 URL 查询参数），
 *   随请求发送用于宿主定位实例与校验来源，就绪握手时回推初始数据。
 * @returns 与 WidgetWindowApi.widgetApi 同形状的 API 对象
 */
export function createWidgetBridgeApi(instanceId: string): WidgetWindowApi['widgetApi'] {
  /** 进行中的请求：requestId → 回调（resolve/reject + 超时清理） */
  const pending = new Map<
    string,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()

  /** 事件监听器：事件名 → 回调集合 */
  const eventListeners: Record<WidgetBridgeEventName, Set<EventCallback>> = {
    data: new Set(),
    configChanged: new Set(),
    instanceData: new Set(),
    action: new Set()
  }

  // 接收宿主消息：校验来源与协议后分发（响应关联 Promise，事件触发回调）
  window.addEventListener('message', (event: MessageEvent) => {
    // 只信任 opener（宿主窗口）发来的消息，防止任意同源页面注入
    if (event.source !== window.opener) return
    const message = event.data
    if (!isWidgetBridgeResponseOrEvent(message)) return

    if (message.type === 'response') {
      const entry = pending.get(message.requestId)
      if (!entry) return
      pending.delete(message.requestId)
      clearTimeout(entry.timer)
      if (message.error) {
        entry.reject(new Error(message.error))
      } else {
        entry.resolve(message.result)
      }
      return
    }

    if (message.type === 'event') {
      const bridgeEvent = message as WidgetBridgeEvent
      const callbacks = eventListeners[bridgeEvent.event]
      callbacks.forEach((callback) => {
        try {
          callback(bridgeEvent.payload)
        } catch (error) {
          console.error(`[WidgetBridge] ${bridgeEvent.event} 回调执行失败:`, error)
        }
      })
    }
  })

  /**
   * 向宿主网关发送请求并等待响应（RPC）。
   *
   * @param method 宿主 widgetApi 方法名
   * @param args 调用参数
   * @returns 宿主执行结果的 Promise
   */
  function request<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const target = window.opener
      if (!target) {
        reject(new Error('宿主窗口不可用，小组件无法工作'))
        return
      }

      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const timer = setTimeout(() => {
        pending.delete(requestId)
        reject(new Error(`小组件请求超时: ${method}`))
      }, REQUEST_TIMEOUT_MS)

      pending.set(requestId, {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value as T)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
        timer
      })

      target.postMessage(
        {
          protocol: WIDGET_BRIDGE_PROTOCOL,
          v: WIDGET_BRIDGE_VERSION,
          type: 'request',
          requestId,
          instanceId,
          method,
          args
        },
        '*'
      )
    })
  }

  /**
   * 订阅宿主推送的事件。
   *
   * @param event 事件名
   * @param callback 回调（载荷类型由调用方声明）
   * @returns 取消订阅函数
   */
  function subscribe<T = unknown>(
    event: WidgetBridgeEventName,
    callback: EventCallback<T>
  ): () => void {
    const callbacks = eventListeners[event]
    const wrapper = callback as EventCallback
    callbacks.add(wrapper)
    return () => {
      callbacks.delete(wrapper)
    }
  }

  // 就绪握手：告知宿主子窗口已建立监听，宿主将回推一次当前实例数据
  const opener = window.opener
  if (opener) {
    try {
      opener.postMessage(
        { protocol: WIDGET_BRIDGE_PROTOCOL, v: WIDGET_BRIDGE_VERSION, type: 'ready', instanceId },
        '*'
      )
    } catch {
      // 宿主不可达时静默失败，后续请求会给出明确错误
    }
  }

  return {
    getAllConfigs: () => request('getAllConfigs'),
    saveConfig: (config: unknown) => request('saveConfig', config),

    // 实例数据查询：instanceId 由本垫片隐式补齐（宿主侧 getInstanceData 接收该参数）
    getInstanceData: () => request('getInstanceData', instanceId),
    updateInstance: (id: string, updates: unknown) => request('updateInstance', id, updates),
    deleteInstance: (id: string) => request('deleteInstance', id),

    closeWindow: (id: string) => request('closeWindow', id),
    togglePin: (id: string, pinned: boolean) => request('togglePin', id, pinned),

    sendData: (data: WidgetDataMessage) => request('sendData', data),
    broadcastData: (data: Omit<WidgetDataMessage, 'toId'>) => request('broadcastData', data),

    fetchWeather: (location: string) => request('fetchWeather', location),
    getLocation: () => request('getLocation'),
    clearWeatherCache: () => request('clearWeatherCache'),

    onData: (callback: (data: WidgetDataMessage) => void) => subscribe('data', callback),
    onConfigChanged: (callback: (config: WidgetConfigFile) => void) =>
      subscribe('configChanged', callback),
    onInstanceData: (callback: (data: InstanceDataUpdate) => void) =>
      subscribe('instanceData', callback),

    onAction: (callback: (request: WidgetActionRequest) => void) => subscribe('action', callback),
    sendActionResult: (result: WidgetActionResult) => {
      // 单向通知：不等待宿主响应
      void request('sendActionResult', result)
    },

    // 日志转发：经宿主网关代为发送到主进程（失败时静默丢弃，避免触发未处理拒绝）
    log: (level: string, message: string) => {
      void request('log', level, message).catch(() => {})
    }
  }
}
