import type { Component } from 'vue'

/** 通用 IPC 响应包装 */
export interface IpcResponse<T = void> {
  success: boolean
  data?: T
  error?: string
}

/** 天气数据 */
export interface WeatherData {
  location: string
  condition: string
  temperature: number
}

/** 位置数据 */
export interface LocationData {
  lat: number | null
  lon: number | null
  city?: string
  region?: string
  country?: string
}

/** 小组件位置 */
export interface WidgetPosition {
  x: number
  y: number
}

/** 小组件尺寸 */
export interface WidgetSize {
  width: number
  height: number
}

/** 小组件实例 */
export interface WidgetInstance {
  id: string
  widgetId: string
  position: WidgetPosition
  size: WidgetSize
  enabled: boolean
  pinned?: boolean
  config?: Record<string, unknown>
}

/** 小组件全局设置 */
export interface WidgetGlobalSettings {
  snapToGrid: boolean
  gridSize: number
  showOnDesktop: boolean
}

/** 小组件配置文件结构 */
export interface WidgetConfigFile {
  instances: WidgetInstance[]
  globalSettings: WidgetGlobalSettings
}

/** 小组件消息通信 */
export interface WidgetDataMessage {
  fromId: string
  toId?: string
  type: string
  payload: unknown
}

/** 实例数据更新事件负载 */
export interface InstanceDataUpdate {
  /** 目标实例 ID（主进程推送时携带，宿主网关据此路由） */
  instanceId?: string
  config?: Record<string, unknown>
  pinned?: boolean
}

/** 小组件清单（用于注册） */
export interface WidgetManifest {
  id: string
  name: string
  icon: string
  description: string
  version: string
  component: Component
  defaultSize: WidgetSize
  minSize?: WidgetSize
  maxSize?: WidgetSize
  configurable?: boolean
}

/** 插件清单 */
export interface PluginManifest {
  id: string
  name: string
  icon: string
  description: string
  version: string
  author: string
  enabled: boolean
  component?: Component
}

// ═══════════════════════════════════════════════════════════════════════════
// 小组件动作协议 · 用于 LLM 工具调用时遥控小组件
// ═══════════════════════════════════════════════════════════════════════════

/** 单个小组件动作请求载荷。 */
export interface WidgetActionRequest {
  /** 动作唯一标识，用于匹配请求与响应。 */
  action_id: string
  /** 目标小组件类型 ID（weather / todo / note / clock / daily-quote）。 */
  widget_type: string
  /** 动作名称（set_location / add_item / clear_all 等）。 */
  action: string
  /** 动作参数对象。 */
  params: Record<string, unknown>
}

/** 小组件动作执行结果。 */
export interface WidgetActionResult {
  /** 匹配的 action_id，用于关联请求。 */
  action_id: string
  /** 动作是否执行成功。 */
  success: boolean
  /** 执行结果对象（成功时）。 */
  result?: Record<string, unknown>
  /** 错误描述文本（失败时）。 */
  error?: string
  /** 目标实例 ID，用于主进程路由回传。 */
  instance_id?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// 宿主开窗桥接协议 · 主进程 ↔ 宿主窗口 preload（window.open 桥接）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 宿主开窗请求载荷（main → 宿主 renderer）。
 *
 * 主进程通过 WIDGET_HOST_OPEN_REQUEST 事件下发到宿主 preload，
 * 由宿主 preload 直接调用 window.open 打开子窗口（共享渲染进程），
 * 从而避免 executeJavaScript 字符串注入与 Window 序列化问题。
 */
export interface WidgetHostOpenRequest {
  /** 请求唯一标识，用于关联请求与结果回传 */
  requestId: string
  /** 待打开的子窗口完整 URL（widget.html + widgetId/instanceId 查询参数） */
  url: string
  /** window.open 的窗口名（widget-<instanceId>），用于 did-create-window 身份匹配 */
  frameName: string
}

/**
 * 宿主开窗结果载荷（宿主 renderer → main）。
 *
 * window.open 返回 Window | null，无法跨进程序列化，
 * 故宿主 preload 将其归一化为布尔值回传主进程。
 */
export interface WidgetHostOpenResult {
  /** 与请求一致的 requestId */
  requestId: string
  /** window.open 是否返回非空 Window（false 表示被 setWindowOpenHandler 拒绝或打开失败） */
  opened: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// 客户端工具协商协议 · 连接建立后上报可用工具列表给服务端
// ═══════════════════════════════════════════════════════════════════════════

/** 单条工具的参数项定义（JSON Schema 风格，可序列化）。 */
export interface ToolParamSchema {
  type: 'string' | 'number' | 'boolean'
  description: string
  enum?: string[]
  default?: unknown
}

/** 单条工具的完整 JSON Schema 定义（可序列化，不含执行逻辑）。 */
export interface ToolSchemaItem {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParamSchema>
    required?: string[]
  }
}

/**
 * 组件工具定义 — 上报给服务端的单个组件工具清单。
 *
 * 服务端通过 tool:query 查询，客户端回复 tool:definitions 时使用此结构。
 * 服务端收到后逐条校验（name + required + properties keys），
 * 校验通过的写入会话工具表，组件维度隔离。
 */
export interface ComponentToolDefinition {
  /** 组件类型 ID（weather / todo / note / clock / daily-quote）。 */
  component: string
  /** 语义化版本号，用于服务端协商校验。例如 "2.0.0"。 */
  version: string
  /** 该组件注册的所有工具 JSON Schema 定义。 */
  tools: ToolSchemaItem[]
}
