import { app, BrowserWindow, globalShortcut } from 'electron'
import { createMainWindow } from './windows/mainWindow.js'

import { setupMainIPC } from './ipc/mainHandlers.js'
import { setupAssistantTogetherIPC } from './ipc/assistantHandlers.js'

import { getPermission } from './permission/permission.js'

// 初始化 IPC
setupMainIPC()
setupAssistantTogetherIPC()

app.whenReady().then(() => {
  // 获取权限
  getPermission()

  createMainWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
