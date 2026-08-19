/**
 * 小组件宿主网关 · postMessage 桥接协议
 *
 * 背景：
 * 小组件子窗口由隐藏宿主通过同源 window.open 打开，与宿主共享同一渲染进程。
 * 由于 Electron 对复用渲染进程的 window.open 子窗口不再执行 preload 脚本，
 * 子窗口无法通过 contextBridge 暴露 window.api（详见 widgetWindowService 注释）。
 *
 * 因此设计「宿主网关」通信模型：
 * - 宿主 preload（唯一正常运行）充当小组件 IPC 的单一出口；
 * - 子窗口（无 preload）通过 window.opener.postMessage 向宿主发起请求，
 *   宿主在 window 'message' 事件中校验来源后执行对应 API 并回传结果；
 * - 宿主收到主进程推送的小组件事件后，按 instanceId/widgetId 转发给对应子窗口。
 *
 * 本文件定义该桥接协议的三种消息类型（请求 / 响应 / 事件推送）与类型守卫，
 * 供宿主 preload（src/preload/api/widget.ts）与子窗口垫片
 * （src/renderer/src/services/widgetBridge.ts）共同使用，保证两端契约一致。
 */

/** 桥接协议标识：所有 postMessage 消息的固定前缀，用于快速过滤无关消息 */
export const WIDGET_BRIDGE_PROTOCOL = 'moechat-widget'

/** 桥接协议版本号：宿主与子窗口须一致，用于兼容性校验与未来演进 */
export const WIDGET_BRIDGE_VERSION = 1

/** 子窗口 → 宿主：API 调用请求（RPC） */
export interface WidgetBridgeRequest {
  /** 协议标识，固定为 WIDGET_BRIDGE_PROTOCOL */
  protocol: typeof WIDGET_BRIDGE_PROTOCOL
  /** 协议版本号，固定为 WIDGET_BRIDGE_VERSION */
  v: typeof WIDGET_BRIDGE_VERSION
  /** 消息类型：请求 */
  type: 'request'
  /** 请求唯一标识，宿主响应时原样带回，用于子窗口关联 Promise */
  requestId: string
  /** 发起请求的子窗口所属实例 ID，宿主据此定位并校验来源 */
  instanceId: string
  /** 待调用的小组件 API 方法名（widgetApi 上的方法） */
  method: string
  /** 调用参数列表 */
  args: unknown[]
}

/** 宿主 → 子窗口：对请求的响应结果 */
export interface WidgetBridgeResponse {
  protocol: typeof WIDGET_BRIDGE_PROTOCOL
  v: typeof WIDGET_BRIDGE_VERSION
  type: 'response'
  /** 与请求一致的 requestId */
  requestId: string
  /** 成功时的返回值 */
  result?: unknown
  /** 失败时的错误信息 */
  error?: string
}

/** 宿主 → 子窗口：主进程事件推送的事件名 */
export type WidgetBridgeEventName = 'data' | 'configChanged' | 'instanceData' | 'action'

/** 宿主 → 子窗口：主进程事件推送 */
export interface WidgetBridgeEvent {
  protocol: typeof WIDGET_BRIDGE_PROTOCOL
  v: typeof WIDGET_BRIDGE_VERSION
  type: 'event'
  /** 事件类型：数据 / 配置变更 / 实例数据 / 动作指令 */
  event: WidgetBridgeEventName
  /** 目标子窗口所属实例 ID */
  instanceId: string
  /** 事件载荷（与各 IPC 通道的载荷结构一致） */
  payload: unknown
}

/** 子窗口 → 宿主：就绪握手（子窗口页面加载完成后上报，宿主据此回推初始实例数据） */
export interface WidgetBridgeReady {
  protocol: typeof WIDGET_BRIDGE_PROTOCOL
  v: typeof WIDGET_BRIDGE_VERSION
  type: 'ready'
  instanceId: string
}

/** 桥接协议消息的联合类型 */
export type WidgetBridgeMessage =
  | WidgetBridgeRequest
  | WidgetBridgeResponse
  | WidgetBridgeEvent
  | WidgetBridgeReady

/**
 * 判断任意消息是否为符合本协议的消息（含协议标识与版本号校验）。
 *
 * @param value 收到的消息
 * @returns 是否为合法桥接消息
 */
export function isWidgetBridgeMessage(value: unknown): value is WidgetBridgeMessage {
  if (typeof value !== 'object' || value === null) return false
  const msg = value as Record<string, unknown>
  return msg.protocol === WIDGET_BRIDGE_PROTOCOL && msg.v === WIDGET_BRIDGE_VERSION
}

/**
 * 判断消息是否为子窗口 → 宿主的 API 调用请求。
 *
 * @param value 收到的消息
 * @returns 是否为合法的请求消息
 */
export function isWidgetBridgeRequest(value: unknown): value is WidgetBridgeRequest {
  return isWidgetBridgeMessage(value) && value.type === 'request'
}

/**
 * 判断消息是否为子窗口 → 宿主的就绪握手。
 *
 * @param value 收到的消息
 * @returns 是否为合法的就绪握手
 */
export function isWidgetBridgeReady(value: unknown): value is WidgetBridgeReady {
  return isWidgetBridgeMessage(value) && value.type === 'ready'
}

/**
 * 判断消息是否为宿主 → 子窗口的响应或事件推送。
 *
 * @param value 收到的消息
 * @returns 是否为合法的响应 / 事件消息
 */
export function isWidgetBridgeResponseOrEvent(
  value: unknown
): value is WidgetBridgeResponse | WidgetBridgeEvent {
  return isWidgetBridgeMessage(value) && (value.type === 'response' || value.type === 'event')
}
