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

/** 小组件窗口 API（通过 contextBridge 暴露给 widget 窗口） */
export interface WidgetApi {
  /** 获取所有小组件配置 */
  getAllConfigs: () => Promise<IpcResponse<WidgetConfigFile>>
  /** 保存所有小组件配置 */
  saveConfig: (config: WidgetConfigFile) => Promise<IpcResponse>

  /** 获取当前小组件实例数据 */
  getInstanceData: () => Promise<IpcResponse<WidgetInstance>>
  /** 更新小组件实例 */
  updateInstance: (instanceId: string, updates: Partial<WidgetInstance>) => Promise<IpcResponse>
  /** 删除小组件实例 */
  deleteInstance: (instanceId: string) => Promise<IpcResponse>

  /** 关闭小组件窗口 */
  closeWindow: (instanceId: string) => Promise<IpcResponse>
  /** 切换窗口置顶 */
  togglePin: (instanceId: string, pinned: boolean) => Promise<IpcResponse>

  /** 发送数据到指定小组件 */
  sendData: (data: WidgetDataMessage) => Promise<IpcResponse>
  /** 广播数据到所有小组件 */
  broadcastData: (data: Omit<WidgetDataMessage, 'toId'>) => Promise<IpcResponse>

  /** 根据城市名获取天气 */
  fetchWeather: (location: string) => Promise<IpcResponse<WeatherData>>
  /** 获取地理位置 */
  getLocation: () => Promise<IpcResponse<LocationData>>
  /** 清除天气缓存 */
  clearWeatherCache: () => Promise<IpcResponse>

  /** 监听其他小组件发来的数据 */
  onData: (callback: (data: WidgetDataMessage) => void) => () => void
  /** 监听小组件配置变更 */
  onConfigChanged: (callback: (config: WidgetConfigFile) => void) => () => void
  /** 监听当前实例数据更新 */
  onInstanceData: (callback: (data: InstanceDataUpdate) => void) => () => void

  /** 监听来自 LLM 工具调用的动作指令。返回取消监听函数。 */
  onAction: (callback: (request: WidgetActionRequest) => void) => () => void
  /** 向主进程回传小组件动作的执行结果。 */
  sendActionResult: (result: WidgetActionResult) => void
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
