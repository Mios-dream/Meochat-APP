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
  preload: 'widgetPreload',
  singleton: false, // 小组件支持多实例
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
 * @returns 创建选项
 */
export function createWidgetOptions(
  instanceId: string,
  widgetId: string,
  position?: { x: number; y: number },
  size?: { width: number; height: number }
): CreateWindowOptions {
  return {
    instanceId,
    query: {
      widgetId,
      instanceId
    } as Record<string, string>,
    overrides: {
      x: position?.x,
      y: position?.y,
      width: size?.width ?? 300,
      height: size?.height ?? 300
    },
    showImmediately: false // 小组件需要等待 dom-ready 后再显示
  }
}
