import { BrowserWindow, globalShortcut, screen } from 'electron'
import { createChatBoxWindow } from './chatBoxWindow'

import { getAppUrl, getPreloadPath, isDevelopment } from '../utils/pathResolve'
import log from '../utils/logger'
import { getConfig, setConfig } from '../config/configManager'

let assistantWindow: BrowserWindow | null

function createAssistantWindow(): void | BrowserWindow {
  if (assistantWindow && !assistantWindow.isDestroyed()) {
    assistantWindow.focus()
    return assistantWindow
  }

  // 从存储中读取窗口配置，如果不存在则使用默认值
  const savedBounds = getConfig('assistantWindowBounds') as Electron.Rectangle
  const defaultBounds = {
    width: 300,
    height: 500
  }

  // 验证保存的位置是否在当前屏幕范围内
  let windowBounds = defaultBounds
  if (savedBounds) {
    const primaryDisplay = screen.getPrimaryDisplay()
    const displayBounds = primaryDisplay.bounds

    // 检查保存的位置是否在屏幕范围内
    if (
      savedBounds.x >= displayBounds.x &&
      savedBounds.y >= displayBounds.y &&
      savedBounds.x + savedBounds.width <= displayBounds.x + displayBounds.width &&
      savedBounds.y + savedBounds.height <= displayBounds.y + displayBounds.height
    ) {
      windowBounds = savedBounds
    }
  }

  assistantWindow = new BrowserWindow({
    ...windowBounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    focusable: false, // 使窗口不可获得焦点
    hasShadow: false,
    webPreferences: {
      preload: getPreloadPath('assistantPreload'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  })
  assistantWindow.setIgnoreMouseEvents(false) // 初始可交互

  // 注册快捷回复的快捷键
  const chatShortcut = getConfig('chatShortcut')
  globalShortcut.register(chatShortcut, () => {
    createChatBoxWindow()
  })

  log.info('getAppUrl:', getAppUrl())
  if (isDevelopment()) {
    assistantWindow.loadURL(getAppUrl() + '#/assistant')
  } else {
    assistantWindow.loadFile(getAppUrl(), {
      hash: '/assistant'
    })
  }

  if (getConfig('debugMode')) {
    assistantWindow.webContents.openDevTools({ mode: 'detach' })
  }

  assistantWindow.on('close', () => {
    if (assistantWindow) {
      setConfig('assistantWindowBounds', assistantWindow.getBounds())
    } else {
      log.info('assistantWindow is null')
    }
  })

  assistantWindow.on('closed', () => {
    assistantWindow = null
    globalShortcut.unregisterAll()
  })

  return assistantWindow
}

// 提供外部访问当前助手窗口的方法
function getAssistantWindow(): BrowserWindow | null {
  return assistantWindow && !assistantWindow.isDestroyed() ? assistantWindow : null
}

export { createAssistantWindow, getAssistantWindow }
