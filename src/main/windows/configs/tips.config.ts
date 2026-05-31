/**
 * 提示窗口配置
 */

import type { WindowConfig } from '../types'

export const tipsWindowConfig: WindowConfig = {
  type: 'tips',
  htmlFile: 'assistantTips.html',
  preload: 'tipsPreload',
  singleton: true,
  hideOnClose: true, // 提示窗口隐藏而非关闭
  options: {
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
