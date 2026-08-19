/**
 * 小组件隐藏宿主窗口配置
 *
 * 用途：
 * 所有小组件实例通过 window.open 从该宿主窗口打开，从而共享宿主渲染进程，
 * 避免每个小组件各占一个独立渲染进程导致的内存膨胀。
 * 宿主窗口本身永不显示，仅作为「窗口开启者（opener）」存在。

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
