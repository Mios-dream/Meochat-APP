import { app, globalShortcut } from 'electron'
import { createMainWindow } from './windows/mainWindow'

import { setupMainIPC } from './ipc/mainHandlers'
import { setupConfigIPC } from './config/configManager'

import { setupAssistantTogetherIPC } from './ipc/assistantHandlers'

import { getPermission } from './permission/permission'

import { createTray } from './tray/appTray'

import { startAutoService } from './utils/autoService'

import { registerFileProtocol, handleFileProtocol } from './protocol/fileProtocol'

// 初始化 IPC
setupMainIPC()
setupConfigIPC()
setupAssistantTogetherIPC()
// 注册文件协议
registerFileProtocol()

app.whenReady().then(() => {
  // 获取权限
  getPermission()

  // 创建主窗口
  createMainWindow()

  // 创建系统托盘
  createTray()
  // 处理文件协议
  handleFileProtocol()
  // 启动自启服务
  startAutoService()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
