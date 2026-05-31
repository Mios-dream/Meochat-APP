/**
 * 聊天框窗口配置
 */

import type { WindowConfig } from '../types'

export const chatBoxWindowConfig: WindowConfig = {
  type: 'chatBox',
  htmlFile: 'index.html',
  preload: 'assistantPreload',
  singleton: true,
  route: '/chat-box',
  options: {
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    autoHideMenuBar: true
  }
}
