/**
 * Widget 窗口 API 构建函数
 *
 * 返回符合 WidgetWindowApi 类型的 API 对象，
 * 由 unifiedPreload.ts 统一完成 contextBridge 暴露。
 */

import { ipcRenderer } from 'electron'
import { commonApi } from './builders/common'
import { ipc } from './builders/ipc'
import { CHANNELS } from '@shared/ipc/channels'
import type { WidgetWindowApi } from '@shared/ipc/api'
import type {
  WidgetDataMessage,
  WidgetConfigFile,
  InstanceDataUpdate,
  WidgetActionRequest
} from '@shared/types/widget'

/** 构建 Widget 窗口 API */
export function buildWidgetWindowApi(): WidgetWindowApi {
  return {
    ...commonApi,
    widgetApi: {
      getAllConfigs: () => ipcRenderer.invoke(CHANNELS.WIDGET_CONFIG_GET_ALL),
      saveConfig: (config: unknown) => ipcRenderer.invoke(CHANNELS.WIDGET_CONFIG_SAVE, config),

      getInstanceData: () => ipcRenderer.invoke(CHANNELS.WIDGET_INSTANCE_GET_CURRENT),
      updateInstance: (instanceId: string, updates: unknown) =>
        ipcRenderer.invoke(CHANNELS.WIDGET_INSTANCE_UPDATE, { instanceId, updates }),
      deleteInstance: (instanceId: string) =>
        ipcRenderer.invoke(CHANNELS.WIDGET_INSTANCE_DELETE, instanceId),

      closeWindow: (instanceId: string) =>
        ipcRenderer.invoke(CHANNELS.WIDGET_WINDOW_CLOSE, instanceId),
      togglePin: (instanceId: string, pinned: boolean) =>
        ipcRenderer.invoke(CHANNELS.WIDGET_WINDOW_TOGGLE_PIN, { instanceId, pinned }),

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
      sendActionResult: (result: unknown) => ipcRenderer.send(CHANNELS.WIDGET_ACTION_RESULT, result)
    }
  }
}
