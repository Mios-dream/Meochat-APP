import { BrowserWindow, screen } from 'electron'
import { getAppUrl, getPreloadPath, isDevelopment } from '../utils/pathResolve'
import { getConfig } from '../config/configManager'

let tipsWindow: BrowserWindow | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

function createTipsWindow(): BrowserWindow {
  if (tipsWindow && !tipsWindow.isDestroyed()) {
    return tipsWindow
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workArea

  const windowWidth = 380
  const windowHeight = 130
  const x = screenWidth - windowWidth - 20
  const y = 20

  tipsWindow = new BrowserWindow({
    x,
    y,
    width: windowWidth,
    height: windowHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: getPreloadPath('assistantPreload'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  })
  tipsWindow.setIgnoreMouseEvents(true) // 不允许交互
  tipsWindow.setAlwaysOnTop(true, 'screen-saver')
  tipsWindow.setVisibleOnAllWorkspaces(true)

  if (getConfig('debugMode')) {
    tipsWindow.webContents.openDevTools({ mode: 'detach' })
  }

  if (isDevelopment()) {
    tipsWindow.loadURL(getAppUrl() + '#/tips')
  } else {
    tipsWindow.loadFile(getAppUrl(), {
      hash: '/tips'
    })
  }

  tipsWindow.on('closed', () => {
    tipsWindow = null
  })

  tipsWindow.hide()

  return tipsWindow
}

function getTipsWindow(): BrowserWindow | null {
  return tipsWindow && !tipsWindow.isDestroyed() ? tipsWindow : null
}

function showTipsWindow(message?: string, avatarUrl?: string): void {
  // 取消待执行的隐藏定时器，防止竞态导致窗口被意外隐藏
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  const win = getTipsWindow() || createTipsWindow()
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workArea
  const [w] = win.getSize()
  win.setPosition(screenWidth - w - 20, 20)
  win.show()
  win.webContents.send('tips:show', { message, avatarUrl })
}

function hideTipsWindow(): void {
  const win = getTipsWindow()
  if (win) {
    win.webContents.send('tips:hide')
    hideTimer = setTimeout(() => {
      hideTimer = null
      if (win && !win.isDestroyed()) {
        win.hide()
      }
    }, 400)
  }
}

function sendMessageToTips(message: string, avatarUrl?: string): void {
  const win = getTipsWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('tips:message', { message, avatarUrl })
  }
}

export { createTipsWindow, getTipsWindow, showTipsWindow, hideTipsWindow, sendMessageToTips }
