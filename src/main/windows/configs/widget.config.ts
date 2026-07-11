/**
 * 小组件窗口配置
 */

import type { WindowConfig, CreateWindowOptions } from '../types'

/**
 * 小组件窗口基础配置
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

/**
 * 创建小组件窗口的选项工厂
 * @param instanceId 实例 ID
 * @param widgetId 小组件 ID
 * @param position 位置（可选，如果不传则由 boundsStore 恢复）
 * @param size 尺寸
 * @returns 创建选项
 */
export function createWidgetOptions(
  instanceId: string,
  widgetId: string,
  position?: { x: number; y: number },
  size?: { width: number; height: number }
): CreateWindowOptions {
  const overrides: Partial<Electron.BrowserWindowConstructorOptions> = {
    width: size?.width ?? 300,
    height: size?.height ?? 300
  }

  // 只有明确传入位置时才设置，否则让 boundsStore 恢复
  if (position) {
    overrides.x = position.x
    overrides.y = position.y
  }

  return {
    instanceId,
    query: {
      widgetId,
      instanceId
    } as Record<string, string>,
    overrides,
    showImmediately: false // 小组件需要等待 dom-ready 后再显示
  }
}
