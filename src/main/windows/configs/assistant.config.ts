/**
 * 助手窗口配置
 */

import type { WindowConfig } from '../types'

export const assistantWindowConfig: WindowConfig = {
  type: 'assistant',
  htmlFile: 'index.html',
  preload: 'assistantPreload',
  singleton: true,
  route: '/assistant',
  boundsKey: 'assistantWindowBounds',
  options: {
    width: 300,
    height: 500,
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
