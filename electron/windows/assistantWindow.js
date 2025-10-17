import { BrowserWindow, globalShortcut } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createChatBoxWindow } from './chatBoxWindow.js'
import Store from 'electron-store'

// 在 ESM 中获取 __dirname 的等效方法
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 创建配置存储实例
const store = new Store()

let assistantWindow = null

function createAssistantWindow() {
  if (assistantWindow && !assistantWindow.isDestroyed()) {
    assistantWindow.focus()
    return
  }

  // 从存储中读取窗口配置，如果不存在则使用默认值
  const savedBounds = store.get('assistantWindowBounds')
  const defaultBounds = {
    width: 300,
    height: 500,
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
    ignoreMouseEvents: true, // 默认忽略鼠标事件
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/assistantPreload.js'),
    },
  })
  assistantWindow.setIgnoreMouseEvents(false) // 初始可交互

  // 注册快捷回复的快捷键
  const ret = globalShortcut.register('Alt+A', () => {
    createChatBoxWindow()
  })

  // 加载助手页面
  assistantWindow.loadURL(`http://localhost:5173/#/assistant`)

  assistantWindow.webContents.openDevTools({ mode: 'detach' })

  assistantWindow.once('ready-to-show', () => {
    assistantWindow.show()
  })

  assistantWindow.on('closed', () => {
    if (assistantWindow) {
      store.set('assistantWindowBounds', assistantWindow.getBounds())
    }
    assistantWindow = null

    globalShortcut.unregisterAll()
  })

  return assistantWindow
}

// 提供外部访问当前宠物窗口的方法
function getAssistantWindow() {
  return assistantWindow && !assistantWindow.isDestroyed() ? assistantWindow : null
}

export { createAssistantWindow, getAssistantWindow }
