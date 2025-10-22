// electron/windows/chatBoxWindow.js
import { BrowserWindow, screen } from 'electron'
import { getAppUrl, getPreloadPath, isDevelopment } from '../utils/pathResolve.js'

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
  // 距离底部抬升
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
      sandbox: false,
      nodeIntegration: false,
      preload: getPreloadPath('assistantPreload.js'),
    },
  })

  if (isDevelopment()) {
    chatBoxWindow.loadURL(getAppUrl() + '#/chat-box')
  } else {
    chatBoxWindow.loadFile(getAppUrl(), {
      hash: '/chat-box',
    })
  }

  chatBoxWindow.webContents.openDevTools({ mode: 'detach' })

  chatBoxWindow.on('closed', () => {
    chatBoxWindow = null
  })

  return chatBoxWindow
}

export function getChatBoxWindow() {
  return chatBoxWindow
}
