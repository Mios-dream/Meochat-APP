import { app, globalShortcut, BrowserWindow } from 'electron'
import { createWindow, mainWindowConfig } from './windows'
import {
  setupMainIPC,
  setupUpdaterIPC,
  setupKernelIPC,
  setupAssistantTogetherIPC,
  setupAssistantServerIPC,
  setupLoggerIPC,
  setupUtilityIPC,
  setupOnboardingIPC,
  setupSystemEventIPC,
  setupLocationIPC,
  setupWeatherIPC,
  setupWsIPC
} from './ipc'
import { setupWidgetIPC } from './ipc/widgetHandlers'
import { setupConfigIPC } from './config/configManager'
import { getPermission } from './permission/permission'
import { createTray } from './tray/appTray'
import { startAutoService } from './services/autoService'
import { registerFileProtocol, handleFileProtocol } from './protocol/fileProtocol'
import { KernelManager } from './services/kernelManager'
import { WidgetService } from './services/widgetService'
import { setupAssistantSettingsIPC } from './ipc/assistantSettingsHandlers'
import { dispatchCenter } from './dispatch/DispatchCenter'
import { CHANNELS } from '@shared/ipc/channels'
import log from './utils/logger'

// Linux 下强制使用 X11 (XWayland) 后端：
// 1. 原生 Wayland 下 getNativeWindowHandle() 返回的不是 X11 Window id，
//    electron-click-drag-plugin 的 X11 拖拽逻辑会因 BadWindow 直接崩溃；
// 2. 助手窗口依赖 alwaysOnTop / transparent / skipTaskbar / focusable:false 等能力，
//    这些在原生 Wayland 上并不生效，X11 后端才能保证行为与 Windows 一致。
// 必须在 app ready 之前调用，否则不生效。
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform', 'x11')
}

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
  // 设置位置IPC（基于IP定位，用于小组件自动填充城市）
  setupLocationIPC()
  // 设置天气IPC
  setupWeatherIPC()
  // 设置 WebSocket IPC
  setupWsIPC()
  // 设置小组件IPC
  setupWidgetIPC()
  // 初始化统一调度中心
  dispatchCenter.setupIPC()
  // 设置桌宠悬浮设置窗口 IPC
  setupAssistantSettingsIPC()
  // 注册文件协议
  registerFileProtocol()
} catch (error) {
  log.error('初始化IPC失败:', error)
}

app.whenReady().then(() => {
  try {
    // 获取权限
    getPermission()
    createWindow(mainWindowConfig) // 工厂会自动处理主窗口显示逻辑
    // 创建系统托盘
    createTray()
    // 处理文件协议
    handleFileProtocol()
    // 启动自启服务
    startAutoService()

    // 初始化小组件服务
    WidgetService.getInstance()

    // 初始化时自动检测内核是否存在，推送初始状态给渲染进程
    const kernelMgr = KernelManager.getInstance()
    const initialState = kernelMgr.getState()
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.once('dom-ready', () => {
          win.webContents.send(CHANNELS.KERNEL_STATE_UPDATE_EVENT, { ...initialState })
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
