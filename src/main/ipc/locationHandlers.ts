import { ipcMain } from 'electron'
import axios from 'axios'
import log from '../utils/logger'

/**
 * 设置位置相关IPC处理器
 * 提供基于IP的位置信息，以便在不依赖系统定位权限的情况下获取城市名
 */
export function setupLocationIPC(): void {
  ipcMain.handle('location:get', async () => {
    try {
      log.info('[LocationIPC] 收到位置请求，使用 IP 定位')
      // 使用免费 IP 定位服务 ip-api.com，返回 city, regionName, country, lat, lon
      const resp = await axios.get('http://ip-api.com/json/', {
        params: { fields: 'status,message,country,regionName,city,lat,lon' },
        timeout: 8000
      })

      const data = resp.data
      if (!data || data.status !== 'success') {
        const msg = data && data.message ? data.message : '定位失败'
        log.warn('[LocationIPC] IP 定位失败: ' + msg)
        return { success: false, error: msg }
      }

      const result = {
        city: data.city || '',
        region: data.regionName || '',
        country: data.country || '',
        lat: data.lat || null,
        lon: data.lon || null
      }

      log.info('[LocationIPC] IP 定位结果: ' + JSON.stringify(result))
      return { success: true, data: result }
    } catch (error) {
      const msg = (error as Error).message || '定位异常'
      log.error('[LocationIPC] 定位异常:', error)
      return { success: false, error: msg }
    }
  })

  log.info('[LocationIPC] 位置IPC处理器已注册')
}
