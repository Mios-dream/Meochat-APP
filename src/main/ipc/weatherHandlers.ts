/**
 * 天气IPC处理器
 * 负责注册与天气相关的IPC通道，桥接渲染进程与WeatherService服务
 *
 * IPC通道列表：
 * - weather:fetch - 根据位置获取天气数据（支持城市名或经纬度路径）
 * - weather:clearCache - 清除天气缓存
 */

import { ipcMain } from 'electron'
import { WeatherService, WeatherFetchResult } from '../services/weatherService'
import log from '../utils/logger'

/**
 * 设置天气相关的IPC处理器
 *
 * 在应用启动时调用，注册所有天气IPC通道的handler
 */
export function setupWeatherIPC(): void {
  const weatherService = WeatherService.getInstance()

  /**
   * 获取天气数据
   *
   * 通道: weather:fetch
   * 参数: { location: string } - 城市名称或经纬度路径
   * 返回: WeatherFetchResult - { success, data?, error? }
   */
  ipcMain.handle(
    'weather:fetch',
    async (_event, params: { location?: string; city?: string }): Promise<WeatherFetchResult> => {
      const location = params?.location ?? params?.city
      if (!location || !location.trim()) {
        return { success: false, error: '位置不能为空' }
      }
      log.info(`[WeatherIPC] 收到天气查询请求: ${location}`)
      return await weatherService.fetchWeatherByCity(location)
    }
  )

  /**
   * 清除天气缓存
   *
   * 通道: weather:clear-cache
   * 无参数
   * 返回: { success: boolean }
   */
  ipcMain.handle('weather:clear-cache', async () => {
    weatherService.clearCache()
    return { success: true }
  })

  log.info('[WeatherIPC] 天气IPC处理器已注册')
}
