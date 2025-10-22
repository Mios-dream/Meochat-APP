import { app, globalShortcut } from 'electron'
import { createMainWindow } from './windows/mainWindow.js'

import { setupMainIPC } from './ipc/mainHandlers.js'
import { setupConfigIPC } from './config/configManager.js'

import { setupAssistantTogetherIPC } from './ipc/assistantHandlers.js'

import { getPermission } from './permission/permission.js'

import { createTray } from './tray/appTray.js'

// 初始化 IPC
setupMainIPC()
setupConfigIPC()
setupAssistantTogetherIPC()

app.whenReady().then(() => {
  // 获取权限
  getPermission()

  // 创建主窗口
  createMainWindow()

  // 创建系统托盘
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
