/**
 * 小组件窗口配置
 */

import type { WindowConfig } from '../types'

/**
 * 小组件窗口基础配置
 *
 * 说明：
 * 自共享渲染进程改造后，小组件实例窗口改由 widgetWindowService 通过
 * 宿主 window.open 创建（参见 src/main/services/widgetWindowService.ts），
 * 本配置仅作为注册元数据与 IPC 类型定位使用。
 */
export const widgetWindowConfig: WindowConfig = {
  type: 'widget',
  htmlFile: 'widget.html',
  preload: 'unifiedPreload',
  singleton: false, // 小组件支持多实例
  boundsKey: 'widgetWindowBounds', // 小组件位置持久化
  // 不设置 route，小组件参数通过 URL 查询参数传递
  options: {
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    hasShadow: false
  }
}
