import { app, globalShortcut, BrowserWindow } from 'electron'
import { createMainWindow } from './windows/mainWindow'
import {
  setupMainIPC,
  setupUpdaterIPC,
  setupKernelIPC,
  setupAssistantTogetherIPC,
  setupAssistantServerIPC,
  setupLoggerIPC,
  setupUtilityIPC,
  setupOnboardingIPC,
  setupSystemEventIPC
} from './ipc'
import { setupConfigIPC } from './config/configManager'
import { getPermission } from './permission/permission'
import { createTray } from './tray/appTray'
import { startAutoService } from './services/autoService'
import { registerFileProtocol, handleFileProtocol } from './protocol/fileProtocol'
import { KernelManager } from './services/kernelManager'
import log from './utils/logger'

try {
  // 初始化 IPC
  setupMainIPC()
  // 设置更新器IPC
  setupUpdaterIPC()
  // 设置内核管理IPC
  setupKernelIPC()
  // 设置配置IPC
  setupConfigIPC()
  // 设置助手Together IPC
  setupAssistantTogetherIPC()
  // 设置助手服务IPC
  setupAssistantServerIPC()
  // 设置日志IPC
  setupLoggerIPC()
  // 设置工具IPC
  setupUtilityIPC()
  // 设置新手引导IPC
  setupOnboardingIPC()
  // 设置系统事件IPC
  setupSystemEventIPC()
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

    // 初始化时自动检测内核是否存在，推送初始状态给渲染进程
    const kernelMgr = KernelManager.getInstance()
    const initialState = kernelMgr.getState()
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.once('dom-ready', () => {
          win.webContents.send('kernel:state-update', { ...initialState })
        })
      }
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
