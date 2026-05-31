/**
 * 聊天框窗口配置
 */

import type { WindowConfig } from '../types'

export const chatBoxWindowConfig: WindowConfig = {
  type: 'chatBox',
  htmlFile: 'chatbox.html',
  preload: 'chatBoxPreload',
  singleton: true,
  options: {
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    autoHideMenuBar: true
  }
}
