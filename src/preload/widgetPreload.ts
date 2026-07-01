/**
 * 小组件窗口预加载脚本
 * 为小组件独立窗口提供专用 API
 */

import { ipcRenderer, contextBridge } from 'electron'

interface LocationData {
  lat: number | null
  lon: number | null
  city?: string
  region?: string
  country?: string
}

function getBrowserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持地理定位'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        })
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000
      }
    )
  })
}

async function getSystemLocation(): Promise<{
  success: boolean
  data?: LocationData
  error?: string
}> {
  try {
    const point = await getBrowserLocation()
    return {
      success: true,
      data: {
        lat: point.lat,
        lon: point.lon
      }
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || '系统定位失败'
    }
  }
}

/** 小组件 API */
const widgetApi = {
  // 获取当前小组件实例数据
  getInstanceData: () => ipcRenderer.invoke('widget:instance:get-current'),

  // 更新小组件实例配置
  updateInstance: (instanceId: string, updates) =>
    ipcRenderer.invoke('widget:instance:update', { instanceId, updates }),

  // 关闭当前小组件窗口
  closeWindow: (instanceId: string) => ipcRenderer.invoke('widget:window:close', instanceId),

  // 删除小组件实例（关闭窗口并清除持久化数据）
  deleteInstance: (instanceId: string) => ipcRenderer.invoke('widget:instance:delete', instanceId),

  // 切换置顶状态
  togglePin: (instanceId: string, pinned: boolean) =>
    ipcRenderer.invoke('widget:window:toggle-pin', { instanceId, pinned }),

  // 发送数据到其他小组件
  sendData: (data) => ipcRenderer.invoke('widget:data:send', data),

  // 广播数据到所有小组件
  broadcastData: (data) => ipcRenderer.invoke('widget:data:broadcast', data),

  // 监听数据
  onData: (callback: (data) => void) => {
    const listener = (_event, data): void => callback(data)
    ipcRenderer.on('widget:data:received', listener)
    return () => ipcRenderer.removeListener('widget:data:received', listener)
  },

  // 监听实例数据更新
  onInstanceData: (callback: (data) => void) => {
    const listener = (_event, data): void => callback(data)
    ipcRenderer.on('widget:instance:data', listener)
    return () => ipcRenderer.removeListener('widget:instance:data', listener)
  },

  // 监听配置变更
  onConfigChanged: (callback: (config) => void) => {
    const listener = (_event, config): void => callback(config)
    ipcRenderer.on('widget:config:changed', listener)
    return () => ipcRenderer.removeListener('widget:config:changed', listener)
  },

  // 获取所有配置
  getAllConfigs: () => ipcRenderer.invoke('widget:config:get-all'),

  // 保存配置
  saveConfig: (config) => ipcRenderer.invoke('widget:config:save', config),

  // ── 天气相关 ──

  /**
   * 根据城市名称获取天气数据
   * @param location 城市名称或经纬度路径（例如 /-78.46,106.79）
   * @returns { success: boolean, data?: WeatherData, error?: string }
   */
  fetchWeather: (location: string) => ipcRenderer.invoke('weather:fetch', { location }),

  /**
   * 获取当前位置
   * 优先使用系统地理定位，失败时回退到IP定位
   */
  getLocation: async () => {
    const systemLocation = await getSystemLocation()
    if (systemLocation.success) {
      return systemLocation
    }

    const ipLocation = await ipcRenderer.invoke('location:get')
    if (ipLocation && ipLocation.success) {
      return ipLocation
    }

    return {
      success: false,
      error: systemLocation.error || ipLocation?.error || '无法获取位置'
    }
  },

  /**
   * 清除天气缓存
   */
  clearWeatherCache: () => ipcRenderer.invoke('weather:clear-cache')
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('widgetApi', widgetApi)

// 也暴露基础 API
const baseApi = {
  // 日志相关
  log: {
    debug: (message: string, args?) =>
      ipcRenderer.send('logger:log', { level: 'debug', message, args }),
    info: (message: string, args?) =>
      ipcRenderer.send('logger:log', { level: 'info', message, args }),
    warn: (message: string, args?) =>
      ipcRenderer.send('logger:log', { level: 'warning', message, args }),
    error: (message: string, args?) =>
      ipcRenderer.send('logger:log', { level: 'error', message, args })
  },

  // 配置相关
  config: {
    get: (key?: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value) => ipcRenderer.invoke('config:set', key, value),
    onChange: (callback: (config) => void) => {
      const listener = (_event, config): void => callback(config)
      ipcRenderer.on('config:changed', listener)
      return () => ipcRenderer.removeListener('config:changed', listener)
    }
  },

  // 通知
  notify: (data) => ipcRenderer.send('tool:notify', data),

  // IPC 通用
  ipcRenderer: {
    send: (channel: string, data) => ipcRenderer.send(channel, data),
    invoke: (channel: string, data?) => ipcRenderer.invoke(channel, data),
    on: (channel: string, listener) => {
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('api', baseApi)
