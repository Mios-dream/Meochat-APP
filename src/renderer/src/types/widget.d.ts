import type { Component } from 'vue'

/** 小组件清单定义 */
export interface WidgetManifest {
  /** 唯一标识，如 'clock', 'daily-quote' */
  id: string
  /** 显示名称 */
  name: string
  /** FontAwesome 图标 */
  icon: string
  /** 描述文字 */
  description: string
  /** 版本号 */
  version: string
  /** Vue 组件 */
  component: Component
  /** 默认尺寸 */
  defaultSize: { width: number; height: number }
  /** 最小尺寸 */
  minSize?: { width: number; height: number }
  /** 最大尺寸 */
  maxSize?: { width: number; height: number }
  /** 是否支持用户配置 */
  configurable?: boolean
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

/** 小组件实例配置 */
export interface WidgetInstance {
  /** 实例唯一 ID */
  id: string
  /** 小组件类型 ID */
  widgetId: string
  /** 位置 */
  position: WidgetPosition
  /** 尺寸 */
  size: WidgetSize
  /** 是否启用（桌面显示） */
  enabled: boolean
  /** 是否置顶 */
  pinned?: boolean
  /** 用户自定义配置 */
  config?: Record<string, any>
}

/** 插件清单定义 */
export interface PluginManifest {
  /** 唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** FontAwesome 图标 */
  icon: string
  /** 描述文字 */
  description: string
  /** 版本号 */
  version: string
  /** 作者 */
  author: string
  /** 是否启用（默认 false） */
  enabled: boolean
  /** 插件组件（可选） */
  component?: Component
}

/** 小组件全局设置 */
export interface WidgetGlobalSettings {
  /** 网格对齐 */
  snapToGrid: boolean
  /** 网格大小 */
  gridSize: number
  /** 是否在桌面显示小组件 */
  showOnDesktop: boolean
}

/** 小组件配置文件结构 */
export interface WidgetConfigFile {
  /** 小组件实例列表 */
  instances: WidgetInstance[]
  /** 全局设置 */
  globalSettings: WidgetGlobalSettings
}

/** 小组件数据消息 */
export interface WidgetDataMessage {
  /** 来源实例 ID */
  fromId: string
  /** 目标实例 ID */
  toId?: string
  /** 消息类型 */
  type: string
  /** 消息数据 */
  payload: any
}

/** 小组件 API 接口 */
export interface WidgetApi {
  /** 获取所有小组件配置 */
  getAllConfigs: () => Promise<WidgetConfigFile>
  /** 保存小组件配置 */
  saveConfig: (config: WidgetConfigFile) => Promise<boolean>
  /** 创建小组件独立窗口 */
  createWidgetWindow: (instanceId: string) => Promise<boolean>
  /** 关闭小组件独立窗口 */
  closeWidgetWindow: (instanceId: string) => Promise<boolean>
  /** 切换窗口置顶状态 */
  toggleWidgetPin: (instanceId: string, pinned: boolean) => Promise<boolean>
  /** 发送数据到指定小组件 */
  sendData: (data: WidgetDataMessage) => Promise<boolean>
  /** 广播数据到所有小组件 */
  broadcastData: (data: Omit<WidgetDataMessage, 'toId'>) => Promise<boolean>
  /** 监听数据 */
  onData: (callback: (data: WidgetDataMessage) => void) => () => void
  /** 监听配置变更 */
  onConfigChanged: (callback: (config: WidgetConfigFile) => void) => () => void
}
