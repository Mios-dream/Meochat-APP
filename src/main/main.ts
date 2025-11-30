import { app, globalShortcut } from 'electron'
import { createMainWindow } from './windows/mainWindow'
import { setupMainIPC } from './ipc/mainHandlers'
import { setupConfigIPC } from './config/configManager'
import { setupAssistantTogetherIPC } from './ipc/assistantHandlers'
import { getPermission } from './permission/permission'
import { createTray } from './tray/appTray'
import { startAutoService } from './utils/autoService'
import { registerFileProtocol, handleFileProtocol } from './protocol/fileProtocol'
import setupUpdaterIPC from './ipc/updaterHandlers'

import log from './utils/logger'
import { AssistantService } from './services/assistantService'

try {
  // 初始化 IPC
  setupMainIPC()
  // 设置更新器IPC
  setupUpdaterIPC()
  // 设置配置IPC
  setupConfigIPC()
  // 设置助手Together IPC
  setupAssistantTogetherIPC()
  // 注册文件协议
  registerFileProtocol()
} catch (error) {
  log.error('初始化IPC失败:', error)
}

app.whenReady().then(() => {
  try {
    // 获取权限
    getPermission()
    createMainWindow()
    // 创建系统托盘
    createTray()
    // 处理文件协议
    handleFileProtocol()
    // 启动自启服务
    startAutoService()

    // 初始化助手服务
    const assistantService = AssistantService.getInstance()
    // 预加载助手数据
    assistantService.loadAssistants().catch((error) => {
      log.error('预加载助手数据失败:', error)
    })
  } catch (error) {
    log.error('应用初始化失败:', error)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  log.error('未捕获的异常:', error)
})
