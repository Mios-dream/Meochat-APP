/**
 * 小组件隐藏宿主窗口配置
 *
 * 用途：
 * 所有小组件实例通过 window.open 从该宿主窗口打开，从而共享宿主渲染进程，
 * 避免每个小组件各占一个独立渲染进程导致的内存膨胀。
 * 宿主窗口本身永不显示，仅作为「窗口开启者（opener）」存在。
 *
 * 说明：
 * - 该窗口不经过窗口工厂的 ready-to-show 显示逻辑，由 widgetWindowService 直接创建；
 * - 渲染进程的 window-type 固定为 widget，确保子窗口继承的 preload 暴露小组件 API。
 */
import type { WindowConfig } from '../types'

export const widgetHostWindowConfig: WindowConfig = {
  type: 'widgetHost',
  htmlFile: 'widget.html',
  preload: 'unifiedPreload',
  singleton: true,
  options: {
    show: false,
    transparent: true,
    frame: false,
    skipTaskbar: true,
    resizable: false,
    autoHideMenuBar: true,
    hasShadow: false,
    width: 300,
    height: 300,
    webPreferences: {
      devTools: false
    }
  }
}
