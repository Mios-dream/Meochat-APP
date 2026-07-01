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
}
