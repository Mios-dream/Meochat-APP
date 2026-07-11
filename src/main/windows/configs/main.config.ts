/**
 * 主窗口配置
 */

import type { WindowConfig } from '../types'

export const mainWindowConfig: WindowConfig = {
  type: 'main',
  htmlFile: 'index.html',
  preload: 'unifiedPreload',
  singleton: true,
  options: {
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 600,
    resizable: true,
    autoHideMenuBar: true,
    frame: false,
    show: false,
    icon: '../../resources/icon/app.ico',
    webPreferences: {
      devTools: true
    }
  }
}
