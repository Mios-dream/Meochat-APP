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
    // 窗口图标按平台选择：Windows 用 .ico；Linux/macOS 用 .png（Electron 在 Linux 无法解码 .ico）
    icon:
      process.platform === 'win32'
        ? '../../resources/icon/app.ico'
        : '../../resources/icon/app.png',
    webPreferences: {
      devTools: true
    }
  }
}
