import { powerMonitor } from 'electron'
import { MicaBrowserWindow, IS_WINDOWS_11 } from 'mica-electron'
import { getAppUrl, getPreloadPath, isDevelopment } from '../utils/pathResolve'
import { getConfig } from '../config/configManager'

// 检查是否是开机自启
const isAutoStarted = process.argv.includes('--auto-start')

/*
 * 根据当前电源配置和系统更新窗口效果
 */
function updateWindowEffect(): void {
  if (!mainWindow) return
  // 省电模式下使用纯色背景
  if (powerMonitor.isOnBatteryPower()) {
    mainWindow.setBackgroundColor('#eff4f9')
    return
  }
  // 否则使用Acrylic
  if (IS_WINDOWS_11) {
    mainWindow.setMicaAcrylicEffect()
    // 设置窗口圆角
    mainWindow.setRoundedCorner()
  } else {
    mainWindow.setAcrylic()
  }
}

// 主窗口的实例
let mainWindow: MicaBrowserWindow | null = null

/*
 * 创建主窗口
 */
function createMainWindow(): MicaBrowserWindow {
  if (mainWindow) {
    mainWindow.show()
    return mainWindow
  }

  mainWindow = new MicaBrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200, // 添加最小宽度
    minHeight: 800,
    resizable: true,
    autoHideMenuBar: true,
    frame: false,
    thickFrame: true,
    show: false,
    transparent: true,
    webPreferences: {
      devTools: true,
      preload: getPreloadPath('mainPreload'),
      sandbox: false,
      nodeIntegration: false
    }
  })
  updateWindowEffect()

  mainWindow.resizable = true

  powerMonitor.on('on-ac', () => {
    updateWindowEffect()
  })

  powerMonitor.on('on-battery', () => {
    updateWindowEffect()
  })

  console.log('isDevelopment:', isDevelopment())
  // 加载页面
  if (isDevelopment()) {
    mainWindow.loadURL(getAppUrl())
  } else {
    mainWindow.loadFile(getAppUrl())
  }

  if (getConfig('debugMode')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
  // mainWindow.webContents.openDevTools({ mode: 'detach' })

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
function getMainWindow(): MicaBrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export { createMainWindow, getMainWindow }
