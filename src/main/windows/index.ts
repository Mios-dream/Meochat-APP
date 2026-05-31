/**
 * 窗口管理系统入口
 * 统一导出所有窗口管理相关模块
 *
 * 使用示例：
 * ```typescript
 * import { createWindow, windowRegistry, mainWindowConfig } from './windows'
 *
 * // 创建主窗口
 * await createWindow(mainWindowConfig, { showImmediately: true })
 *
 * // 获取窗口
 * const mainWindow = windowRegistry.getWindowByType('main')
 * ```
 */

// 类型定义
export type {
  WindowType,
  WindowState,
  QueryParams,
  WindowConfig,
  WindowMeta,
  CreateWindowOptions,
  WindowEventCallbacks
} from './types'

// 核心模块
export { windowRegistry } from './registry'
export { createWindow, createSingletonWindow, createMultiInstanceWindow } from './factory'
export { loadWindowContent, getWindowUrl, getPreloadPath, isDevelopment } from './urlResolver'

// 窗口配置
export {
  windowConfigs,
  getWindowConfig,
  mainWindowConfig,
  widgetWindowConfig,
  assistantWindowConfig,
  chatBoxWindowConfig,
  tipsWindowConfig,
  createWidgetOptions
} from './configs'
