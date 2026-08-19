/**
 * 小组件窗口 API 类型
 */

import type { CommonApi } from '../base/common'
import type {
  WidgetActionRequest,
  WidgetActionResult,
  WidgetConfigFile,
  WidgetInstance,
  WidgetDataMessage,
  InstanceDataUpdate,
  IpcResponse,
  LocationData,
  WeatherData
} from '@shared/types/widget'

/** 小组件窗口暴露的 API 接口 */
export interface WidgetWindowApi extends CommonApi {
  /** 小组件专用 API（window.widgetApi） */
  widgetApi: {
    getAllConfigs: () => Promise<IpcResponse<WidgetConfigFile>>
    saveConfig: (config: WidgetConfigFile) => Promise<IpcResponse>
    getInstanceData: (instanceId?: string) => Promise<IpcResponse<WidgetInstance>>
    updateInstance: (instanceId: string, updates: Partial<WidgetInstance>) => Promise<IpcResponse>
    deleteInstance: (instanceId: string) => Promise<IpcResponse>
    closeWindow: (instanceId: string) => Promise<IpcResponse>
    togglePin: (instanceId: string, pinned: boolean) => Promise<IpcResponse>
    sendData: (data: WidgetDataMessage) => Promise<IpcResponse>
    broadcastData: (data: Omit<WidgetDataMessage, 'toId'>) => Promise<IpcResponse>
    fetchWeather: (location: string) => Promise<IpcResponse<WeatherData>>
    getLocation: () => Promise<IpcResponse<LocationData>>
    clearWeatherCache: () => Promise<IpcResponse>
    /** 日志转发（小组件子窗口无完整 preload，经宿主网关代为转发到主进程） */
    log: (level: string, message: string) => void
    onData: (callback: (data: WidgetDataMessage) => void) => () => void
    onConfigChanged: (callback: (config: WidgetConfigFile) => void) => () => void
    onInstanceData: (callback: (data: InstanceDataUpdate) => void) => () => void
    onAction: (callback: (request: WidgetActionRequest) => void) => () => void
    sendActionResult: (result: WidgetActionResult) => void
  }
}
