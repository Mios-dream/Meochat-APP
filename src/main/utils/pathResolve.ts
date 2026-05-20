import { app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

/**
 * 获取渲染进程页面地址（开发 / 生产 统一）
 */
function getAppUrl(): string {
  if (!app.isPackaged) {
    // 开发环境 → 加载 Vite 本地服务
    return 'http://localhost:5173/'
  } else {
    // 生产环境 → 从打包后的资源加载
    return path.join(app.getAppPath(), 'out', 'renderer', 'index.html')
  }
}

/**
 * 获取 preload.js 路径（兼容开发 / 打包）
 */
function getPreloadPath(preloadName: string): string {
  // return path.join(app.getAppPath(), 'preload', preloadName)
  return fileURLToPath(new URL(`../preload/${preloadName}.mjs`, import.meta.url))
}

/**
 * 是否是开发环境
 */
function isDevelopment(): boolean {
  if ((process.env.NODE_ENV || '').trim() === 'development') {
    return true
  } else {
    return false
  }
}

/**
 * 解析应用数据目录。
 *
 * - 开发模式：使用 Electron 标准的 userData 目录（%APPDATA%/MoeChat-APP 等）
 *   避免因 exe 位于 node_modules/ 内部导致 appData 被创建到错误位置。
 * - 生产模式（便携版）：优先使用 exe 同级目录下的 appData/，
 *   不可写时回退到 userData。
 */
function resolveAppDataDir(): string {
  const appDataDir = path.join(path.dirname(app.getPath('exe')), 'appData')

  try {
    fs.mkdirSync(appDataDir, { recursive: true })
    fs.accessSync(appDataDir, fs.constants.W_OK)
    return appDataDir
  } catch {
    return app.getPath('userData')
  }
}

/**
 * 解析日志目录。
 * 优先使用 exe 同级目录下的 log/，不可写时回退到 userData 下的 logs/
 */
function resolveLogDir(): string {
  const preferredLogDir = path.join(resolveAppDataDir(), 'logs')
  fs.mkdirSync(preferredLogDir, { recursive: true })
  return preferredLogDir
}

export { getAppUrl, getPreloadPath, isDevelopment, resolveAppDataDir, resolveLogDir }
