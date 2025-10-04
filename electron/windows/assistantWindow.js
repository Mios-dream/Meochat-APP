import { BrowserWindow, globalShortcut } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createChatBoxWindow } from './chatBoxWindow.js'

// 在 ESM 中获取 __dirname 的等效方法
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let assistantWindow = null

export function createAssistantWindow() {
  if (assistantWindow && !assistantWindow.isDestroyed()) {
    assistantWindow.focus()
    return
  }

  assistantWindow = new BrowserWindow({
    width: 300,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/assistantPreload.js'),
    },
  })

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
    globalShortcut.unregisterAll()
  })

  return assistantWindow
}

// 提供外部访问当前宠物窗口的方法
export function getAssistantWindow() {
  return assistantWindow && !assistantWindow.isDestroyed() ? assistantWindow : null
}
