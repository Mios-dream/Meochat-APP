// electron/windows/chatBoxWindow.js
import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// 在 ESM 中获取 __dirname 的等效方法
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let chatBoxWindow = null

export function createChatBoxWindow() {
  if (chatBoxWindow) {
    chatBoxWindow.show()
    return chatBoxWindow
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  // 计算窗口尺寸和位置
  const windowWidth = Math.floor(screenWidth / 2)
  const windowHeight = 200
  const x = Math.floor((screenWidth - windowWidth) / 2)
  const targetY = screenHeight - 200 // 目标位置

  chatBoxWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: targetY,
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/assistantPreload.js'),
    },
  })

  chatBoxWindow.loadURL('http://localhost:5173/#/chat-box')
  chatBoxWindow.webContents.openDevTools({ mode: 'detach' })

  chatBoxWindow.on('closed', () => {
    chatBoxWindow = null
  })

  return chatBoxWindow
}

export function getChatBoxWindow() {
  return chatBoxWindow
}
