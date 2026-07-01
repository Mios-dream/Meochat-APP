/**
 * 小组件 API 类型声明
 * 为小组件窗口提供类型定义
 */

/** 小组件位置 */
interface WidgetPosition {
  x: number
  y: number
}

/** 小组件尺寸 */
interface WidgetSize {
  width: number
  height: number
}

/** 小组件实例配置 */
interface WidgetInstance {
  id: string
  widgetId: string
  position: WidgetPosition
  size: WidgetSize
  enabled: boolean
  pinned?: boolean
  config?: Record<string, any>
}

/** 小组件全局设置 */
interface WidgetGlobalSettings {
  snapToGrid: boolean
  gridSize: number
  showOnDesktop: boolean
}

/** 小组件配置文件结构 */
interface WidgetConfigFile {
  instances: WidgetInstance[]
  globalSettings: WidgetGlobalSettings
}

/** 小组件数据消息 */
interface WidgetDataMessage {
  fromId: string
  toId?: string
  type: string
  payload: any
}

/** 天气数据 */
interface WeatherData {
  /** 城市名称 */
  location: string
  /** 天气状况描述 */
  condition: string
  /** 当前温度（摄氏度） */
  temperature: number
}

/** 天气获取结果 */
interface WeatherFetchResult {
  /** 是否成功 */
  success: boolean
  /** 天气数据（成功时存在） */
  data?: WeatherData
  /** 错误信息（失败时存在） */
  error?: string
}

/** 位置数据 */
interface LocationData {
  lat: number | null
  lon: number | null
  city?: string
  region?: string
  country?: string
}

/** 位置获取结果 */
interface LocationFetchResult {
  success: boolean
  data?: LocationData
  error?: string
}

/** 小组件 API 接口 */
interface WidgetApi {
  /** 获取当前小组件实例数据 */
  getInstanceData: () => Promise<{ success: boolean; data?: WidgetInstance; error?: string }>

  /** 更新小组件实例配置 */
  updateInstance: (
    instanceId: string,
    updates: Partial<WidgetInstance>
  ) => Promise<{ success: boolean; error?: string }>

  /** 关闭当前小组件窗口 */
  closeWindow: (instanceId: string) => Promise<{ success: boolean; error?: string }>

  /** 删除小组件实例（关闭窗口并清除持久化数据） */
  deleteInstance: (instanceId: string) => Promise<{ success: boolean; error?: string }>

  /** 切换置顶状态 */
  togglePin: (instanceId: string, pinned: boolean) => Promise<{ success: boolean; error?: string }>

  /** 发送数据到其他小组件 */
  sendData: (data: WidgetDataMessage) => Promise<{ success: boolean; error?: string }>

  /** 广播数据到所有小组件 */
  broadcastData: (
    data: Omit<WidgetDataMessage, 'toId'>
  ) => Promise<{ success: boolean; error?: string }>

  /** 监听数据 */
  onData: (callback: (data: WidgetDataMessage) => void) => () => void

  /** 监听实例数据更新 */
  onInstanceData: (callback: (data: WidgetInstance) => void) => () => void

  /** 监听配置变更 */
  onConfigChanged: (callback: (config: WidgetConfigFile) => void) => () => void

  /** 获取所有配置 */
  getAllConfigs: () => Promise<{ success: boolean; data?: WidgetConfigFile; error?: string }>

  /** 保存配置 */
  saveConfig: (config: WidgetConfigFile) => Promise<{ success: boolean; error?: string }>

  /** 根据位置获取天气数据 */
  fetchWeather: (location: string) => Promise<WeatherFetchResult>

  /** 清除天气缓存 */
  clearWeatherCache: () => Promise<{ success: boolean }>

  /** 获取位置信息，优先系统地理定位，失败时回退到IP定位 */
  getLocation: () => Promise<LocationFetchResult>
}

/** 基础 API 接口 */
interface BaseApi {
  /** 日志相关 */
  log: {
    debug: (message: string, args?: any) => void
    info: (message: string, args?: any) => void
    warn: (message: string, args?: any) => void
    error: (message: string, args?: any) => void
  }

  /** 配置相关 */
  config: {
    get: (key?: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
    onChange: (callback: (config: any) => void) => () => void
  }

  /** 通知 */
  notify: (data: any) => void

  /** IPC 通用 */
  ipcRenderer: {
    send: (channel: string, data: any) => void
    invoke: (channel: string, data?: any) => Promise<any>
    on: (channel: string, listener: any) => () => void
    removeAllListeners: (channel: string) => void
  }
}

declare global {
  interface Window {
    widgetApi: WidgetApi
    api: BaseApi
  }
}

export {}
