/**
 * 聊天框窗口配置
 */

import type { WindowConfig } from '../types'

export const chatBoxWindowConfig: WindowConfig = {
  type: 'chatBox',
  htmlFile: 'chatbox.html',
  preload: 'unifiedPreload',
  singleton: true,
  options: {
    transparent: true,
    frame: false,
    // alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    hasShadow: false,
    width: 350,
    height: 170,
    maxWidth: 900,
    maxHeight: 500,
    minWidth: 350,
    minHeight: 170
  }
}
