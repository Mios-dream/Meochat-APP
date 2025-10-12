// electron/windows/mainWindow.js
import { BrowserWindow, powerMonitor } from 'electron'
import { PARAMS, VALUE, MicaBrowserWindow, IS_WINDOWS_11, WIN10 } from 'mica-electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// 在 ESM 中获取 __dirname 的等效方法
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow = null

export function createMainWindow() {
  if (mainWindow) {
    return mainWindow
  }
  // mainWindow = new BrowserWindow({
  //   width: 800,
  //   height: 600,
  //   transparent: true,
  //   skipTaskbar: true,
  //   autoHideMenuBar: true,
  //   frame: false,
  //   resizable: true,
  //   backgroundMaterial: 'acrylic',
  //   webPreferences: {
  //     contextIsolation: true,
  //     preload: path.join(__dirname, '../preload/mainPreload.js'), // 👈 主窗口专用 preload
  //   },
  // })

  mainWindow = new MicaBrowserWindow({
    width: 800,
    height: 600,

    frame: false,
    resizable: true,
    webPreferences: {
      // 启用 backdrop-filter
      devTools: true,
      preload: path.join(__dirname, '../preload/mainPreload.js'), // 👈 主窗口专用 preload
    },
  })
  updateWindowEffect()

  powerMonitor.on('on-ac', () => {
    updateWindowEffect()
  })

  powerMonitor.on('on-battery', () => {
    updateWindowEffect()
  })

  mainWindow.setRoundedCorner()

  mainWindow.loadURL('http://localhost:5173')
  mainWindow.webContents.openDevTools({ mode: 'detach' })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

// 检查并设置窗口效果
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

export function getMainWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}
