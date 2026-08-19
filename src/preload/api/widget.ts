/**
 * Widget 窗口 API 构建函数
 *
 * 返回符合 WidgetWindowApi 类型的 API 对象，
 * 由 unifiedPreload.ts 统一完成 contextBridge 暴露。
 *
 * 宿主网关模型（共享渲染进程下的小组件通信方案）：
 * 小组件子窗口由宿主 window.open 同源打开、共享宿主渲染进程，
 * Electron 对复用进程的子窗口不再执行 preload，因此子窗口无法自行暴露 window.api。
 * 本 preload 因此承担「宿主网关」职责：
 *   1. 开窗桥接：响应主进程 WIDGET_HOST_OPEN_REQUEST，调用 window.open 打开子窗口，
 *      并登记 instanceId → 子窗口 Window 引用（供事件回推与来源校验）；
 *   2. 请求转发：监听 window 'message'，校验来源是已登记的子窗口后，
 *      执行对应的 widgetApi 方法并把结果 postMessage 回传；
 *   3. 事件扇出：直接监听主进程推送的小组件事件（数据 / 配置 / 实例数据 / 动作），
 *      按 instanceId / widgetId 转发给对应子窗口；
 *   4. 就绪握手：子窗口加载完成后上报 ready，网关回推一次当前实例数据，
 *      避免「主进程事件先于子窗口监听就绪」导致初始数据丢失。
 *
 * 桥接协议定义见 @shared/types/widgetBridge。
 */

import { ipcRenderer } from 'electron'
import { commonApi } from './builders/common'
import { ipc } from './builders/ipc'
import { CHANNELS } from '@shared/ipc/channels'
import {
  WIDGET_BRIDGE_PROTOCOL,
  WIDGET_BRIDGE_VERSION,
  isWidgetBridgeRequest,
  isWidgetBridgeReady
} from '@shared/types/widgetBridge'
import type { WidgetWindowApi } from '@shared/ipc/api'
import type {
  WidgetDataMessage,
  WidgetConfigFile,
  InstanceDataUpdate,
  WidgetActionRequest,
  WidgetHostOpenRequest,
  WidgetHostOpenResult,
  WidgetInstance
} from '@shared/types/widget'
import type { WidgetBridgeEventName } from '@shared/types/widgetBridge'

/** 网关登记的子窗口引用 */
interface ChildWindowRef {
  /** 子窗口 Window 对象（window.open 返回值），用于 postMessage 与来源校验 */
  window: Window
  /** 子窗口所属实例 ID */
  instanceId: string
  /** 子窗口渲染的小组件类型 ID（来自开窗 URL 查询参数） */
  widgetId: string
}

/** 已登记的子窗口引用表：instanceId → 引用 */
const childWindows = new Map<string, ChildWindowRef>()

/** 网关消息监听是否已注册（preload 单例加载，仅需一次） */
let gatewayRegistered = false

/**
 * 从开窗 URL 查询参数中解析子窗口身份信息（widgetId / instanceId）。
 *
 * @param url 开窗 URL（widget.html?widgetId=xxx&instanceId=xxx）
 * @returns 解析出的身份信息
 */
function parseChildIdentity(url: string): { widgetId: string; instanceId: string } {
  try {
    const params = new URL(url).searchParams
    return {
      widgetId: params.get('widgetId') ?? '',
      instanceId: params.get('instanceId') ?? ''
    }
  } catch {
    return { widgetId: '', instanceId: '' }
  }
}

/**
 * 向指定子窗口 postMessage 推送事件。
 *
 * @param target 目标子窗口 Window
 * @param event 事件名
 * @param instanceId 目标实例 ID
 * @param payload 事件载荷
 */
function postEventToChild(
  target: Window,
  event: WidgetBridgeEventName,
  instanceId: string,
  payload: unknown
): void {
  try {
    target.postMessage(
      {
        protocol: WIDGET_BRIDGE_PROTOCOL,
        v: WIDGET_BRIDGE_VERSION,
        type: 'event',
        event,
        instanceId,
        payload
      },
      '*'
    )
  } catch (error) {
    console.error('[WidgetGateway] 事件推送失败:', error)
  }
}

/**
 * 向指定子窗口 postMessage 回传响应。
 *
 * @param target 目标子窗口 Window
 * @param requestId 关联的请求 ID
 * @param result 成功返回值
 * @param error 失败信息
 */
function postResponseToChild(
  target: Window,
  requestId: string,
  result?: unknown,
  error?: string
): void {
  try {
    target.postMessage(
      {
        protocol: WIDGET_BRIDGE_PROTOCOL,
        v: WIDGET_BRIDGE_VERSION,
        type: 'response',
        requestId,
        result,
        error
      },
      '*'
    )
  } catch (err) {
    console.error('[WidgetGateway] 响应回传失败:', err)
  }
}

/**
 * 注册开窗桥接：监听主进程的开窗请求，执行 window.open 并回传布尔结果。
 *
 * window.open 返回的 Window 引用同步登记进 childWindows，
 * 作为后续请求来源校验与事件回推的目标。
 */
function setupHostOpenBridge(): void {
  ipcRenderer.on(CHANNELS.WIDGET_HOST_OPEN_REQUEST, (_event, payload: WidgetHostOpenRequest) => {
    let opened = false
    try {
      const child = window.open(payload.url, payload.frameName)
      if (child) {
        const { widgetId, instanceId } = parseChildIdentity(payload.url)
        if (instanceId) {
          childWindows.set(instanceId, { window: child, instanceId, widgetId })
        }
        opened = true
      }
    } catch (error) {
      console.error('[WidgetGateway] window.open 执行异常:', error)
      opened = false
    }

    const result: WidgetHostOpenResult = { requestId: payload.requestId, opened }
    ipcRenderer.send(CHANNELS.WIDGET_HOST_OPEN_RESULT, result)
  })
}

/**
 * 执行子窗口发起的 widgetApi 方法调用并回传结果。
 *
 * 方法执行可能返回 Promise（ipcRenderer.invoke），统一 await 后回传。
 * 未知方法 / 执行异常统一以 error 响应，避免子窗口 Promise 悬挂。
 *
 * @param source 发起请求的子窗口（已通过白名单校验）
 * @param request 请求消息
 * @param api 宿主侧 widgetApi 对象
 */
async function handleChildRequest(
  source: Window,
  request: { requestId: string; method: string; args: unknown[] },
  api: Record<string, (...args: unknown[]) => unknown>
): Promise<void> {
  const method = api[request.method]
  if (typeof method !== 'function') {
    postResponseToChild(source, request.requestId, undefined, `未知方法: ${request.method}`)
    return
  }

  try {
    const result = await method(...request.args)
    postResponseToChild(source, request.requestId, result, undefined)
  } catch (error) {
    postResponseToChild(source, request.requestId, undefined, String(error))
  }
}

/**
 * 子窗口就绪握手：回推一次当前实例数据。
 *
 * 子窗口页面加载完成并建立监听后上报 ready，此处主动推送一次实例数据，
 * 保证即使主进程的事件在子窗口监听就绪前已发出，初始配置也不会丢失。
 *
 * @param ref 就绪的子窗口引用
 * @param api 宿主侧 widgetApi 对象
 */
function handleChildReady(
  ref: ChildWindowRef,
  api: Record<string, (...args: unknown[]) => unknown>
): void {
  const getInstanceData = api['getInstanceData']
  if (typeof getInstanceData !== 'function') return

  Promise.resolve(getInstanceData(ref.instanceId))
    .then((response: unknown) => {
      const typed = response as { success?: boolean; data?: WidgetInstance } | undefined
      if (typed?.success && typed.data) {
        const data: InstanceDataUpdate = {
          config: typed.data.config,
          pinned: typed.data.pinned
        }
        postEventToChild(ref.window, 'instanceData', ref.instanceId, data)
      }
    })
    .catch((error) => {
      console.error('[WidgetGateway] 就绪回推实例数据失败:', error)
    })
}

/**
 * 注册宿主网关：
 *   1. 监听 window 'message'，校验来源后分发请求 / 就绪握手；
 *   2. 直接监听主进程推送的小组件事件（数据 / 配置 / 实例数据 / 动作），
 *      按 instanceId / widgetId 转发给对应子窗口；
 *   3. 监听子窗口关闭通知，清理引用表。
 *
 * 事件转发直接监听 IPC 通道，而非复用「面向页面的 API 订阅方法」，
 * 使网关代理层与暴露给页面的 API 层解耦。
 *
 * @param widgetApi 宿主侧 widgetApi 方法集：子窗口请求据此代发，
 *   是子窗口执行真实 IPC（ipcRenderer）的唯一出口
 */
function setupHostGateway(widgetApi: WidgetWindowApi['widgetApi']): void {
  if (gatewayRegistered) return
  gatewayRegistered = true

  const apiMethods = widgetApi as unknown as Record<string, (...args: unknown[]) => unknown>

  // 接收子窗口消息：校验协议 + 来源白名单后分发
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data
    if (isWidgetBridgeReady(message)) {
      const ref = childWindows.get(message.instanceId)
      if (ref && ref.window === event.source) {
        handleChildReady(ref, apiMethods)
      }
      return
    }
    if (!isWidgetBridgeRequest(message)) return

    const ref = childWindows.get(message.instanceId)
    if (!ref || ref.window !== event.source) {
      // 来源不在白名单：忽略，防止任意同源页面注入调用
      return
    }
    void handleChildRequest(ref.window, message, apiMethods)
  })

  // 实例数据更新 → 转发给对应实例的子窗口（直接监听通道，不经过 API 订阅方法）
  ipc.on(CHANNELS.WIDGET_INSTANCE_DATA_EVENT, (data: InstanceDataUpdate) => {
    const instanceId = data.instanceId
    if (!instanceId) return
    const ref = childWindows.get(instanceId)
    if (ref) {
      postEventToChild(ref.window, 'instanceData', ref.instanceId, data)
    }
  })

  // 配置变更 → 广播给所有子窗口
  ipc.on(CHANNELS.WIDGET_CONFIG_CHANGED_EVENT, (config: WidgetConfigFile) => {
    for (const ref of childWindows.values()) {
      postEventToChild(ref.window, 'configChanged', ref.instanceId, config)
    }
  })

  // 数据消息 → 按 toId 定向或广播
  ipc.on(CHANNELS.WIDGET_DATA_RECEIVED_EVENT, (data: WidgetDataMessage) => {
    if (data.toId) {
      const ref = childWindows.get(data.toId)
      if (ref) {
        postEventToChild(ref.window, 'data', ref.instanceId, data)
      }
    } else {
      for (const ref of childWindows.values()) {
        postEventToChild(ref.window, 'data', ref.instanceId, data)
      }
    }
  })

  // 动作指令 → 按 widget_type 广播给对应类型的子窗口
  ipc.on(CHANNELS.WIDGET_ACTION_RECEIVED_EVENT, (request: WidgetActionRequest) => {
    for (const ref of childWindows.values()) {
      if (ref.widgetId === request.widget_type) {
        postEventToChild(ref.window, 'action', ref.instanceId, request)
      }
    }
  })

  // 子窗口关闭 → 清理引用表
  ipc.on(CHANNELS.WIDGET_HOST_CHILD_CLOSED, (instanceId: string) => {
    childWindows.delete(instanceId)
  })
}

/** 构建 Widget 窗口 API */
export function buildWidgetWindowApi(): WidgetWindowApi {
  // 开窗桥接：宿主依赖此通道完成 window.open 并登记子窗口引用
  setupHostOpenBridge()

  const widgetApi: WidgetWindowApi['widgetApi'] = {
    getAllConfigs: () => ipcRenderer.invoke(CHANNELS.WIDGET_CONFIG_GET_ALL),
    saveConfig: (config: unknown) => ipcRenderer.invoke(CHANNELS.WIDGET_CONFIG_SAVE, config),

    // 共享进程下由宿主网关代发请求，instanceId 由网关显式传入（对应 WIDGET_INSTANCE_GET_CURRENT 的载荷）
    getInstanceData: (instanceId?: string) =>
      ipcRenderer.invoke(CHANNELS.WIDGET_INSTANCE_GET_CURRENT, { instanceId }),
    updateInstance: (instanceId: string, updates: unknown) =>
      ipcRenderer.invoke(CHANNELS.WIDGET_INSTANCE_UPDATE, { instanceId, updates }),
    deleteInstance: (instanceId: string) =>
      ipcRenderer.invoke(CHANNELS.WIDGET_INSTANCE_DELETE, instanceId),

    closeWindow: (instanceId: string) =>
      ipcRenderer.invoke(CHANNELS.WIDGET_WINDOW_CLOSE, instanceId),
    togglePin: (instanceId: string, pinned: boolean) =>
      ipcRenderer.invoke(CHANNELS.WIDGET_WINDOW_TOGGLE_PIN, { instanceId, pinned }),

    // 拖拽指令：子窗口经 bridge 垫片代理到此，携带 instanceId 由主进程定位真实子窗口
    startDrag: (instanceId: string) =>
      ipcRenderer.send(CHANNELS.WIDGET_WINDOW_START_DRAG, instanceId),
    endDrag: (instanceId: string) => ipcRenderer.send(CHANNELS.WIDGET_WINDOW_END_DRAG, instanceId),
    sendData: (data: unknown) => ipcRenderer.invoke(CHANNELS.WIDGET_DATA_SEND, data),
    broadcastData: (data: unknown) => ipcRenderer.invoke(CHANNELS.WIDGET_DATA_BROADCAST, data),

    fetchWeather: (location: string) => ipcRenderer.invoke(CHANNELS.WEATHER_FETCH, { location }),
    getLocation: async () => {
      try {
        const location = await new Promise<{ lat: number; lon: number }>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 5 * 60 * 1000 }
          )
        })
        return { success: true, data: location }
      } catch {
        const ipLocation = await ipcRenderer.invoke(CHANNELS.LOCATION_GET)
        return ipLocation ?? { success: false, error: '无法获取位置' }
      }
    },
    clearWeatherCache: () => ipcRenderer.invoke(CHANNELS.WEATHER_CLEAR_CACHE),

    onData: (callback: (data: WidgetDataMessage) => void) =>
      ipc.on(CHANNELS.WIDGET_DATA_RECEIVED_EVENT, callback),
    onConfigChanged: (callback: (config: WidgetConfigFile) => void) =>
      ipc.on(CHANNELS.WIDGET_CONFIG_CHANGED_EVENT, callback),
    onInstanceData: (callback: (data: InstanceDataUpdate) => void) =>
      ipc.on(CHANNELS.WIDGET_INSTANCE_DATA_EVENT, callback),

    onAction: (callback: (request: WidgetActionRequest) => void) =>
      ipc.on(CHANNELS.WIDGET_ACTION_RECEIVED_EVENT, callback),
    sendActionResult: (result: unknown) => ipcRenderer.send(CHANNELS.WIDGET_ACTION_RESULT, result),

    // 日志转发：子窗口无完整 preload，经宿主网关转发到主进程 electron-log
    log: (level: string, message: string) =>
      ipcRenderer.send(CHANNELS.LOGGER_LOG, { level, message })
  }

  // 宿主网关：子窗口请求转发 + 事件扇出（依赖 widgetApi 方法集本身）
  setupHostGateway(widgetApi)

  return {
    ...commonApi,
    widgetApi
  }
}
