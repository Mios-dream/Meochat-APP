import { BrowserWindow } from 'electron'
import { getAppUrl, getPreloadPath, isDevelopment } from '../utils/pathResolve'
import { getConfig } from '../config/configManager'
import log from '../utils/logger'

// 检查是否是开机自启
const isAutoStarted = process.argv.includes('--auto-start')

// 主窗口的实例
let mainWindow: BrowserWindow | null = null

/*
 * 创建主窗口
 */
function createMainWindow(): BrowserWindow {
  if (mainWindow) {
    mainWindow.show()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200, // 添加最小宽度
    minHeight: 600,
    resizable: true,
    autoHideMenuBar: true,
    frame: false,
    show: false,
    icon: '../../resources/icon/app.ico',
    // transparent: true,
    webPreferences: {
      devTools: true,
      preload: getPreloadPath('mainPreload'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  log.info('isDevelopment:', isDevelopment())
  // 加载页面
  if (isDevelopment()) {
    mainWindow.loadURL(getAppUrl())
  } else {
    mainWindow.loadFile(getAppUrl())
  }

  if (getConfig('debugMode')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.webContents.once('dom-ready', () => {
    if (getConfig('silentMode') && isAutoStarted) {
      return
    }
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

/*
 * 获取主窗口
 */
function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export { createMainWindow, getMainWindow }
