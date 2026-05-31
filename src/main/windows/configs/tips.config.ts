/**
 * 提示窗口配置
 */

import type { WindowConfig } from '../types'

export const tipsWindowConfig: WindowConfig = {
  type: 'tips',
  htmlFile: 'index.html',
  preload: 'assistantPreload',
  singleton: true,
  route: '/tips',
  hideOnClose: true, // 提示窗口隐藏而非关闭
  options: {
    width: 380,
    height: 130,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    focusable: false,
    hasShadow: false
  }
}
