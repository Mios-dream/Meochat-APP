/**
 * 窗口 URL 解析器
 * 统一处理开发环境和生产环境的 URL 构建
 *
 * 核心职责：
 * 1. 根据环境自动选择加载方式（loadURL / loadFile）
 * 2. 统一处理 hash 路由和查询参数
 * 3. 支持多入口 HTML 文件
 */

import { app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import type { WindowConfig, QueryParams } from './types'

/** 开发环境 Vite 开发服务器地址 */
const DEV_SERVER_URL = 'http://localhost:5173'

/**
 * 是否为开发环境
 */
function isDevelopment(): boolean {
  return !app.isPackaged
}

/**
 * 获取生产环境 HTML 文件路径
 * @param htmlFile HTML 文件名
 * @returns 完整的文件路径
 */
function getProductionPath(htmlFile: string): string {
  return path.join(app.getAppPath(), 'out', 'renderer', htmlFile)
}

/**
 * 构建查询参数字符串
 * @param params 查询参数对象
 * @returns URL 查询参数字符串（不含 ?）
 */
function buildQueryString(params?: QueryParams): string {
  if (!params || Object.keys(params).length === 0) {
    return ''
  }

  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null
  )

  return entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

/**
 * 构建完整的 hash 路由
 * @param route 路由路径
 * @param query 查询参数
 * @returns 完整的 hash 路由字符串
 */
function buildHashRoute(route?: string, query?: QueryParams): string {
  const queryString = buildQueryString(query)

  if (!route && !queryString) {
    return ''
  }

  const hashPath = route || ''
  const hashQuery = queryString ? `?${queryString}` : ''

  return `#${hashPath}${hashQuery}`
}

/**
 * 解析开发环境 URL
 * 格式：http://localhost:5173/{htmlFile}?{query}#{route}
 *
 * @param config 窗口配置
 * @param query 动态查询参数
 * @returns 完整的开发环境 URL
 */
function resolveDevUrl(config: WindowConfig, query?: QueryParams): string {
  const base = `${DEV_SERVER_URL}/${config.htmlFile}`
  const mergedQuery = { ...config.defaultQuery, ...query }
  const queryString = buildQueryString(mergedQuery)
  const hashRoute = config.route ? `#${config.route}` : ''

  // 查询参数放在 URL 查询字符串中，hash 路由放在最后
  const urlQuery = queryString ? `?${queryString}` : ''
  return `${base}${urlQuery}${hashRoute}`
}

/**
 * 解析生产环境文件路径
 *
 * @param config 窗口配置
 * @returns 生产环境 HTML 文件路径
 */
function resolveProdPath(config: WindowConfig): string {
  return getProductionPath(config.htmlFile)
}

/**
 * 解析生产环境加载选项
 * 用于 loadFile 的 options 参数
 *
 * @param config 窗口配置
 * @param query 动态查询参数
 * @returns loadFile 选项
 */
function resolveProdLoadOptions(
  config: WindowConfig,
  query?: QueryParams
): Electron.LoadFileOptions {
  const mergedQuery = { ...config.defaultQuery, ...query }
  const queryString = buildQueryString(mergedQuery)
  const hashRoute = config.route ? `#${config.route}` : ''

  // 查询参数放在 search 中，hash 路由放在 hash 中
  return {
    search: queryString ? `?${queryString}` : undefined,
    hash: hashRoute || undefined
  }
}

/**
 * 加载窗口内容
 * 根据环境自动选择 loadURL 或 loadFile
 *
 * @param window BrowserWindow 实例
 * @param config 窗口配置
 * @param query 动态查询参数
 */
export async function loadWindowContent(
  window: Electron.BrowserWindow,
  config: WindowConfig,
  query?: QueryParams
): Promise<void> {
  if (isDevelopment()) {
    const url = resolveDevUrl(config, query)
    await window.loadURL(url)
  } else {
    const filePath = resolveProdPath(config)
    const options = resolveProdLoadOptions(config, query)
    await window.loadFile(filePath, options)
  }
}

/**
 * 获取窗口 URL（用于调试或日志）
 *
 * @param config 窗口配置
 * @param query 动态查询参数
 * @returns 窗口 URL 或文件路径
 */
export function getWindowUrl(config: WindowConfig, query?: QueryParams): string {
  if (isDevelopment()) {
    return resolveDevUrl(config, query)
  }
  return resolveProdPath(config)
}

/**
 * 获取 preload 脚本路径
 * 兼容开发环境和打包环境
 *
 * @param preloadName preload 脚本名称（不含扩展名）
 * @returns preload 脚本完整路径
 */
export function getPreloadPath(preloadName: string): string {
  // 使用 fileURLToPath 将 URL 转换为正确的文件路径
  return fileURLToPath(new URL(`../preload/${preloadName}.mjs`, import.meta.url))
}

export { isDevelopment, buildQueryString, buildHashRoute }
