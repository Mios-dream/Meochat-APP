import { app } from 'electron'
import path from 'path'

/**
 * 获取渲染进程页面地址（开发 / 生产 统一）
 */
function getAppUrl() {
  if (!app.isPackaged) {
    // 开发环境 → 加载 Vite 本地服务
    return 'http://localhost:5173/'
  } else {
    // 生产环境 → 从打包后的资源加载
    return path.join(app.getAppPath(), 'dist', 'index.html')
  }
}

/**
 * 获取 preload.js 路径（兼容开发 / 打包）
 */
function getPreloadPath(preloadName) {
  return path.join(app.getAppPath(), 'electron', 'preload', preloadName)
}

/**
 * 是否是开发环境
 */
function isDevelopment() {
  if ((process.env.NODE_ENV || '').trim() === 'development') {
    return true
  } else {
    return false
  }
}

export { getAppUrl, getPreloadPath, isDevelopment }
