/**
 * 天气IPC处理器
 * 负责注册与天气相关的IPC通道，桥接渲染进程与WeatherService服务
 *
 * IPC通道列表：
 * - weather:fetch - 根据位置获取天气数据（支持城市名或经纬度路径）
 * - weather:clearCache - 清除天气缓存
 */

import { CHANNELS } from '@shared/ipc/channels'
import { registerHandle } from '../utils/registerIpcHandler'
import { WeatherService, WeatherFetchResult } from '../services/weatherService'
import log from '../utils/logger'

/**
 * 设置天气相关的IPC处理器
 *
 * 在应用启动时调用，注册所有天气IPC通道的handler
 */
export function setupWeatherIPC(): void {
  const weatherService = WeatherService.getInstance()

  registerHandle(
    CHANNELS.WEATHER_FETCH,
    async (_event, params: { location?: string; city?: string }): Promise<WeatherFetchResult> => {
      const location = params?.location ?? params?.city
      if (!location || !location.trim()) {
        return { success: false, error: '位置不能为空' }
      }
      log.info(`[WeatherIPC] 收到天气查询请求: ${location}`)
      return await weatherService.fetchWeatherByCity(location)
    }
  )

  registerHandle(CHANNELS.WEATHER_CLEAR_CACHE, async () => {
    weatherService.clearCache()
    return { success: true }
  })
}
