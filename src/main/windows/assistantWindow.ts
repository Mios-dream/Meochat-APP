import { BrowserWindow, globalShortcut, screen } from 'electron'
import { createChatBoxWindow } from './chatBoxWindow'
import Store from 'electron-store'
import { getAppUrl, getPreloadPath, isDevelopment } from '../utils/pathResolve'

// 创建配置存储实例
const store = new Store()

let assistantWindow: BrowserWindow | null

function createAssistantWindow(): void | BrowserWindow {
  if (assistantWindow && !assistantWindow.isDestroyed()) {
    assistantWindow.focus()
    return assistantWindow
  }

  // 从存储中读取窗口配置，如果不存在则使用默认值
  const savedBounds = store.get('assistantWindowBounds') as Electron.Rectangle
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
      // preload: path.join(__dirname, '../preload/assistantPreload.js'),
      preload: getPreloadPath('assistantPreload'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  })
  assistantWindow.setIgnoreMouseEvents(false) // 初始可交互

  // 注册快捷回复的快捷键
  globalShortcut.register('Alt+A', () => {
    createChatBoxWindow()
  })

  console.log('getAppUrl:', getAppUrl())
  if (isDevelopment()) {
    assistantWindow.loadURL(getAppUrl() + '#/assistant')
  } else {
    assistantWindow.loadFile(getAppUrl(), {
      hash: '/assistant'
    })
  }

  if (store.get('debugMode')) {
    assistantWindow.webContents.openDevTools({ mode: 'detach' })
  }

  assistantWindow.once('ready-to-show', () => {
    assistantWindow?.show()
  })

  assistantWindow.on('close', () => {
    if (assistantWindow) {
      store.set('assistantWindowBounds', assistantWindow.getBounds())
    } else {
      console.log('assistantWindow is null')
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
