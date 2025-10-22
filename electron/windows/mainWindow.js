// electron/windows/mainWindow.js
import { powerMonitor, app } from 'electron'
import { MicaBrowserWindow, IS_WINDOWS_11, WIN10 } from 'mica-electron'
import path from 'path'
import { getAppUrl, getPreloadPath, isDevelopment } from '../utils/pathResolve.js'
/*
 * 根据当前电源配置和系统更新窗口效果
 */
function updateWindowEffect() {
  // 省电模式下使用纯色背景
  if (powerMonitor.isOnBatteryPower()) {
    mainWindow.setBackgroundColor('#eff4f9')
    return
  }
  // 否则使用Acrylic
  if (IS_WINDOWS_11) {
    mainWindow.setMicaAcrylicEffect()
    // mainWindow.setMicaEffect()
    return
  }
  if (WIN10) {
    mainWindow.setAcrylic()
    return
  }
}

// 主窗口的实例
let mainWindow = null

/*
 * 创建主窗口
 */
function createMainWindow() {
  if (mainWindow) {
    mainWindow.show()
    return mainWindow
  }

  mainWindow = new MicaBrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(app.getAppPath(), 'asset', 'icon', 'app_small.ico'),
    frame: false,
    resizable: true,
    webPreferences: {
      devTools: true,
      preload: getPreloadPath('mainPreload.js'),
      sandbox: false,
      nodeIntegration: false,
    },
  })
  updateWindowEffect()

  powerMonitor.on('on-ac', () => {
    updateWindowEffect()
  })

  powerMonitor.on('on-battery', () => {
    updateWindowEffect()
  })

  // 设置窗口圆角
  mainWindow.setRoundedCorner()

  console.log('isDevelopment:', isDevelopment())
  // 加载页面
  if (isDevelopment()) {
    mainWindow.loadURL(getAppUrl())
  } else {
    mainWindow.loadFile(getAppUrl())
  }
  // 打开开发者工具
  mainWindow.webContents.openDevTools({ mode: 'detach' })

  mainWindow.once('did-finish-load', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

/*
 * 获取主窗口
 */
function getMainWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export { createMainWindow, getMainWindow }
